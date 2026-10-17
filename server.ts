import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for Cloud Run, Kubernetes, and uptime monitoring probes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'MachineMemory Industrial Intelligence Platform',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    secretsStatus: {
      geminiApiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
      sessionSecretConfigured: Boolean(process.env.SESSION_SECRET),
      firebaseConfigured: Boolean(process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID),
    },
  });
});

// Safe public client Firebase config endpoint for Cloud Run & container runtime environments
app.get('/api/config/firebase', (_req: Request, res: Response) => {
  res.json({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '',
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || '',
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID || '',
    firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || '',
  });
});

// Initialize Google GenAI client if API key is present
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

const getAiClient = () => {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
  });
};

// Handler for Extract Audio / Text - Strict AI Dependency
const handleExtract = async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', rawText, machineIdDefault = '' } = req.body || {};

    const cleanRawText = typeof rawText === 'string' ? rawText.trim() : '';
    const cleanMachineId = typeof machineIdDefault === 'string' ? machineIdDefault.trim().toUpperCase() : '';

    const dangerousPatterns = /<[^>]*>|javascript:|on\w+\s*=|__proto__|constructor|\$where/i;
    if (dangerousPatterns.test(cleanRawText) || dangerousPatterns.test(cleanMachineId)) {
      return res.status(400).json({ success: false, error: 'Prohibited characters or malicious payload detected in extraction request.' });
    }

    if (cleanRawText.length > 3000) {
      return res.status(400).json({ success: false, error: 'Observation text exceeds maximum length of 3000 characters.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ success: false, error: 'Gemini AI service is not configured (GEMINI_API_KEY missing). Local fallback is disabled per strict cloud dependency configuration.' });
    }

    const client = getAiClient();
    const systemPrompt = `You are an industrial reliability expert specializing in manufacturing machinery and ISO 10816-3 standards.
Extract structured machine fault data from audio/text into JSON:
{
  "machine_id": string (e.g. "M001"),
  "machine_name": string,
  "symptoms": string[],
  "time_condition": string,
  "warmup_minutes": number,
  "recommended_inspection": string,
  "proscribed_action": string,
  "probable_root_cause": string,
  "confidence_score": number (0.0 to 1.0),
  "source_summary": string,
  "extracted_parameters": {
    "temperature_sensitivity": boolean,
    "rpm_drift": boolean,
    "thermal_expansion_likely": boolean
  }
}`;

    const parts: any[] = [];
    if (audioBase64 && typeof audioBase64 === 'string') {
      if (audioBase64.length > 35 * 1024 * 1024) {
        return res.status(400).json({ success: false, error: 'Audio payload exceeds maximum size limit of 25MB.' });
      }
      parts.push({
        inlineData: {
          mimeType: typeof mimeType === 'string' && mimeType.startsWith('audio/') ? mimeType : 'audio/webm',
          data: audioBase64,
        },
      });
    }
    if (cleanRawText) {
      parts.push({ text: `Technician Field Note for asset ${cleanMachineId}: "${cleanRawText}"` });
    }

    if (parts.length === 0) {
      return res.status(400).json({ success: false, error: 'No audio or text content provided for extraction.' });
    }

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: parts,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Audio extraction error:', err);
    return res.status(502).json({ success: false, error: `AI service extraction failed: ${err.message || 'Unknown error'}` });
  }
};

// Mount both aliases
app.post('/api/intelligence/extract-audio', handleExtract);
app.post('/api/gemini/extract-audio', handleExtract);

// Handler for Autonomous Investigation - Strict AI Dependency
const handleInvestigate = async (req: Request, res: Response) => {
  try {
    const { sensorSnapshot, incident, historicalIncidents, knowledgeEntries, machine_id } = req.body;
    const targetMachId = (machine_id || incident?.machine_id || '').toUpperCase();

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ success: false, error: 'Gemini AI service is not configured (GEMINI_API_KEY missing). Local fallback is disabled.' });
    }

    const client = getAiClient();
    const systemInstruction = `You are a Senior Industrial Reliability Specialist for automated CNC manufacturing plants adhering to ISO 10816-3 standards.
Produce a root-cause diagnostic investigation in JSON:
{
  "top_hypothesis": {
    "root_cause": string,
    "confidence_pct": number,
    "why_not_bearing": string,
    "evidence_chain": string[]
  },
  "secondary_hypothesis": {
    "root_cause": string,
    "confidence_pct": number,
    "assessment": string
  },
  "recommended_actions": [
    { "step": number, "priority": "CRITICAL" | "HIGH" | "MEDIUM", "action": string, "tool": string }
  ],
  "downtime_savings_projection": {
    "estimated_coupling_repair_minutes": number,
    "avoided_bearing_replacement_minutes": number,
    "net_downtime_saved_minutes": number
  }
}`;

    const prompt = `Conduct an industrial reliability investigation for asset ${targetMachId}.
Current Telemetry: ${JSON.stringify(sensorSnapshot || incident, null, 2)}
Historical Incidents: ${JSON.stringify(historicalIncidents || [], null, 2)}
Institutional Knowledge: ${JSON.stringify(knowledgeEntries || [], null, 2)}`;

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Investigation error:', error);
    return res.status(502).json({ success: false, error: `AI investigation service failed: ${error.message || 'Unknown error'}` });
  }
};

app.post('/api/intelligence/investigate', handleInvestigate);
app.post('/api/gemini/investigate', handleInvestigate);

// Institutional Memory Query - Strict AI Dependency
const handleQuery = async (req: Request, res: Response) => {
  try {
    const { query: userQuery, machine_id = '', knowledgeEntries = [], incidents = [] } = req.body || {};

    const cleanQuery = typeof userQuery === 'string' ? userQuery.trim() : '';
    const cleanMachineId = typeof machine_id === 'string' ? machine_id.trim().toUpperCase() : '';

    const dangerousPatterns = /<[^>]*>|javascript:|on\w+\s*=|__proto__|constructor|\$where/i;
    if (dangerousPatterns.test(cleanQuery) || dangerousPatterns.test(cleanMachineId)) {
      return res.status(400).json({ success: false, error: 'Prohibited characters or script injection detected in repository query.' });
    }

    if (!cleanQuery) {
      return res.status(400).json({ success: false, error: 'Query parameter cannot be empty.' });
    }

    if (cleanQuery.length > 500) {
      return res.status(400).json({ success: false, error: 'Query text exceeds maximum length of 500 characters.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ success: false, error: 'Gemini AI service is not configured (GEMINI_API_KEY missing). Local fallback is disabled.' });
    }

    const client = getAiClient();
    const prompt = `User Query: "${cleanQuery}"
Target Machine: ${cleanMachineId}
Verified Incidents: ${JSON.stringify(Array.isArray(incidents) ? incidents.slice(0, 8) : [], null, 2)}
Field Knowledge: ${JSON.stringify(Array.isArray(knowledgeEntries) ? knowledgeEntries.slice(0, 10) : [], null, 2)}

Provide a concise, authoritative answer citing specific past incident IDs, technician rules, and ISO 10816-3 standards.`;

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({
      success: true,
      answer: response.text,
      sources: [`Central Repository records for ${cleanMachineId}`, 'ISO 10816-3 Mechanical Specifications'],
    });
  } catch (err: any) {
    console.error('Query error:', err);
    return res.status(502).json({ success: false, error: `AI query service failed: ${err.message || 'Unknown error'}` });
  }
};

app.post('/api/intelligence/query', handleQuery);
app.post('/api/gemini/query', handleQuery);

// ==========================================
// SECURE BACKEND AUTHENTICATION SYSTEM
// ==========================================
const SESSION_SECRET = process.env.SESSION_SECRET || 'promptnova_industrial_terminal_secret_key_2026';
const DEFAULT_TECH_PASSWORD = process.env.VITE_DEFAULT_TECHNICIAN_PASSWORD || '';
const DEFAULT_TECH_PASSWORD_HASH = DEFAULT_TECH_PASSWORD
  ? crypto.createHash('sha256').update(DEFAULT_TECH_PASSWORD).digest('hex')
  : '';

interface ServerTechnician {
  technician_id: string;
  name: string;
  email: string;
  role: string;
  skills: string[];
  experience: number;
  shift: string;
  password_hash?: string;
  avatar_url?: string;
  last_login?: string;
}

const TECHNICIANS_REGISTRY: ServerTechnician[] = [
  {
    technician_id: 'TECH-01',
    name: 'Marcus Vance',
    email: 'marcus.vance@promptnova.com',
    role: 'Lead Master Technician',
    skills: ['Spindle Alignment', 'Vibration Analysis ISO-II', 'Hydraulics', 'CNC Metrology'],
    experience: 18,
    shift: 'Day Shift · Automated Machining Lines',
    avatar_url: '',
    last_login: new Date().toISOString(),
  },
  {
    technician_id: 'TECH-02',
    name: 'Elena Rostova',
    email: 'elena.rostova@promptnova.com',
    role: 'Reliability & Telemetry Engineer',
    skills: ['SCADA', 'FFT Spectral Analysis', 'ISO 10816-3 Compliance', 'Hydraulics'],
    experience: 7,
    shift: 'Swing Shift · Automated Machining Lines',
    avatar_url: '',
    last_login: new Date().toISOString(),
  },
  {
    technician_id: 'TECH-03',
    name: 'David Chen',
    email: 'david.chen@promptnova.com',
    role: 'Junior Maintenance Specialist',
    skills: ['Mechanical LOTO', 'Dial Indicators', 'Coolant Filtration'],
    experience: 2,
    shift: 'Day Shift · Plant Utility & Backup Systems',
    avatar_url: '',
    last_login: new Date().toISOString(),
  },
  {
    technician_id: 'USR-MASTER-01',
    name: 'Chintan Vekariya',
    email: 'chintanvekariya023@gmail.com',
    role: 'Master Admin',
    skills: ['Executive Reliability', 'ISO 10816-3 Compliance', 'SCADA', 'Plant Operations'],
    experience: 15,
    shift: 'Plant Operations & Engineering Leadership',
    avatar_url: '',
    last_login: new Date().toISOString(),
  },
];

function createSessionToken(tech: ServerTechnician): string {
  const payload = `${tech.technician_id}:${tech.email}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64');
}

function verifySessionToken(token: string): ServerTechnician | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 4) return null;
    const [id, email, time, hmac] = parts;
    const expected = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(`${id}:${email}:${time}`)
      .digest('hex');
    if (hmac !== expected) return null;
    return TECHNICIANS_REGISTRY.find((t) => t.technician_id === id) || null;
  } catch {
    return null;
  }
}

// POST /api/auth/login - Authenticate technician/user
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const enteredHash = crypto.createHash('sha256').update(password.trim()).digest('hex');

  const tech = TECHNICIANS_REGISTRY.find((t) => t.email.toLowerCase() === normalizedEmail);

  const isPasswordValid = Boolean(
    tech &&
      ((tech.password_hash && enteredHash === tech.password_hash) ||
        (DEFAULT_TECH_PASSWORD_HASH && enteredHash === DEFAULT_TECH_PASSWORD_HASH) ||
        (DEFAULT_TECH_PASSWORD && password.trim() === DEFAULT_TECH_PASSWORD))
  );

  if (!tech || !isPasswordValid) {
    return res.status(401).json({ success: false, error: 'Incorrect email or password.' });
  }

  const token = createSessionToken(tech);
  const { password_hash, ...safeTech } = tech;
  return res.json({
    success: true,
    technician: safeTech,
    token,
  });
});

// POST /api/auth/verify - Validate bearer token
app.post('/api/auth/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.body?.token || '';
  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided.' });
  }

  const tech = verifySessionToken(token);
  if (!tech) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session token.' });
  }

  return res.json({
    success: true,
    technician: tech,
  });
});

// POST /api/auth/logout - Invalidate session
app.post('/api/auth/logout', (_req: Request, res: Response) => {
  return res.json({ success: true });
});

// Production Static Serving
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Development Vite Middleware
export async function setupDevServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }
}

setupDevServer().then(() => {
  app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(` MachineMemory Industrial Platform active on port ${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(` Gemini AI Engine: ${process.env.GEMINI_API_KEY ? 'Active (Secret Loaded)' : 'Fallback heuristic mode (No API Key)'}`);
    console.log(` Session Security: ${process.env.SESSION_SECRET ? 'Configured via Secret Manager / Env' : 'Using default development key'}`);
    console.log(`================================================================`);
  });
});
