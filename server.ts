import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';
import os from 'os';
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
      geminiApiKeyConfigured: hasGeminiCredentials(),
      geminiApiKeysLoaded: GEMINI_API_KEYS.length,
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

// ==========================================
// GEMINI API KEY POOL
// ==========================================
const GEMINI_API_KEYS: string[] = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
]
  .map((key) => (typeof key === 'string' ? key.trim() : ''))
  .filter((key) => key.length > 0);

const hasGeminiCredentials = (): boolean => GEMINI_API_KEYS.length > 0;

let activeKeyIndex = 0;

const getAiClient = (keyIndex: number = activeKeyIndex) => {
  return new GoogleGenAI({
    apiKey: GEMINI_API_KEYS[keyIndex] || '',
  });
};


const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 20);
const AI_QUERY_RESERVE = Number(process.env.AI_QUERY_RESERVE || 3);
// Written to a writable scratch location by default: on Cloud Run the app
// directory is read-only for the runtime user, so /tmp is the durable choice
// within a running instance.
const AI_CACHE_FILE =
  process.env.AI_CACHE_FILE || path.join(os.tmpdir(), 'machinememory-ai-cache.json');

interface CachedAiEntry {
  payload: any;
  storedAt: string;
}

const aiCache = new Map<string, CachedAiEntry>();
let aiUsageDay = new Date().toISOString().slice(0, 10);
// One counter per pooled key, since each project's allowance is tracked separately
let aiUsageByKey: number[] = GEMINI_API_KEYS.map(() => 0);

// Warm the cache from disk so repeated demo runs survive a server restart
try {
  if (fs.existsSync(AI_CACHE_FILE)) {
    const storedCache = JSON.parse(fs.readFileSync(AI_CACHE_FILE, 'utf-8')) || {};
    for (const [key, value] of Object.entries(storedCache)) {
      aiCache.set(key, value as CachedAiEntry);
    }
  }
} catch (err) {
  console.warn('AI cache load skipped:', err);
}

const persistAiCache = () => {
  try {
    fs.mkdirSync(path.dirname(AI_CACHE_FILE), { recursive: true });
    fs.writeFileSync(AI_CACHE_FILE, JSON.stringify(Object.fromEntries(aiCache), null, 2));
  } catch (err) {
    console.warn('AI cache persist skipped:', err);
  }
};

const buildCacheKey = (scope: string, payload: unknown): string =>
  crypto.createHash('sha256').update(`${scope}:${JSON.stringify(payload)}`).digest('hex');

const readAiCache = (key: string): any | null => aiCache.get(key)?.payload ?? null;

const writeAiCache = (key: string, payload: any) => {
  aiCache.set(key, { payload, storedAt: new Date().toISOString() });
  persistAiCache();
};

const rollAiUsageDay = () => {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== aiUsageDay) {
    aiUsageDay = today;
    aiUsageByKey = GEMINI_API_KEYS.map(() => 0);
    activeKeyIndex = 0;
  }
};

const totalAiUsage = (): number => aiUsageByKey.reduce((sum, used) => sum + used, 0);

const totalAiAllowance = (): number => AI_DAILY_LIMIT * GEMINI_API_KEYS.length;

// Extraction stops at the reserve line; repository queries may spend the full allowance
const keyCeiling = (reserved: boolean): number =>
  reserved ? AI_DAILY_LIMIT : AI_DAILY_LIMIT - AI_QUERY_RESERVE;

const hasAiBudget = (reserved = false): boolean => {
  rollAiUsageDay();
  const ceiling = keyCeiling(reserved);
  return aiUsageByKey.some((used) => used < ceiling);
};

// Quota rejections are the only failure worth retrying on another key
const isQuotaError = (err: any): boolean => {
  const status = err?.status ?? err?.code ?? err?.response?.status;
  if (status === 429) return true;
  const message = `${err?.message || ''}`.toUpperCase();
  return message.includes('RESOURCE_EXHAUSTED') || message.includes('QUOTA') || message.includes('429');
};

// Issues the request on the first key with allowance left, moving to the next
// key when one is exhausted mid-session
const generateWithFailover = async (request: any, reserved = false): Promise<any> => {
  rollAiUsageDay();
  const ceiling = keyCeiling(reserved);
  let lastError: any = null;

  for (let attempt = 0; attempt < GEMINI_API_KEYS.length; attempt++) {
    const keyIndex = (activeKeyIndex + attempt) % GEMINI_API_KEYS.length;
    if (aiUsageByKey[keyIndex] >= ceiling) continue;

    try {
      const response = await getAiClient(keyIndex).models.generateContent(request);
      aiUsageByKey[keyIndex] += 1;
      activeKeyIndex = keyIndex;
      return response;
    } catch (err: any) {
      lastError = err;
      if (!isQuotaError(err)) {
        aiUsageByKey[keyIndex] += 1;
        throw err;
      }
      // Key is spent for today: retire it and try the next project's allowance
      console.warn(`Gemini key #${keyIndex + 1} exhausted, failing over to the next key.`);
      aiUsageByKey[keyIndex] = AI_DAILY_LIMIT;
      activeKeyIndex = (keyIndex + 1) % GEMINI_API_KEYS.length;
    }
  }

  throw lastError || new Error('All configured Gemini API keys have reached their daily request allowance.');
};

// Live quota telemetry so the console can pace itself during a session
app.get('/api/intelligence/usage', (_req: Request, res: Response) => {
  rollAiUsageDay();
  res.json({
    success: true,
    day: aiUsageDay,
    used: totalAiUsage(),
    limit: totalAiAllowance(),
    perKeyLimit: AI_DAILY_LIMIT,
    reserve: AI_QUERY_RESERVE,
    remaining: Math.max(0, totalAiAllowance() - totalAiUsage()),
    keys: aiUsageByKey.map((used, index) => ({
      key: `GEMINI_API_KEY${index === 0 ? '' : `_${index + 1}`}`,
      used,
      remaining: Math.max(0, AI_DAILY_LIMIT - used),
      active: index === activeKeyIndex,
    })),
    cachedResponses: aiCache.size,
  });
});


// Handler for Extract Audio / Text - Strict AI Dependency
const handleExtract = async (req: Request, res: Response) => {
  try {
    const {
      audioBase64,
      mimeType = 'audio/webm',
      rawText,
      machineIdDefault = '',
      knowledgeEntries = [],
      incidents = [],
    } = req.body || {};

    const cleanRawText = typeof rawText === 'string' ? rawText.trim() : '';
    const cleanMachineId = typeof machineIdDefault === 'string' ? machineIdDefault.trim().toUpperCase() : '';

    const dangerousPatterns = /<[^>]*>|javascript:|on\w+\s*=|__proto__|constructor|\$where/i;
    if (dangerousPatterns.test(cleanRawText) || dangerousPatterns.test(cleanMachineId)) {
      return res.status(400).json({ success: false, error: 'Prohibited characters or malicious payload detected in extraction request.' });
    }

    if (cleanRawText.length > 3000) {
      return res.status(400).json({ success: false, error: 'Observation text exceeds maximum length of 3000 characters.' });
    }

    if (!hasGeminiCredentials()) {
      return res.status(503).json({ success: false, error: 'Gemini AI service is not configured (GEMINI_API_KEY missing). Local fallback is disabled per strict cloud dependency configuration.' });
    }

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
  },
  "institutional_answer": string
}

For "institutional_answer", write a concise authoritative paragraph answering what a
technician would ask next about this asset - whether the fault has occurred before,
what resolved it, and which ISO 10816-3 limits apply - citing specific past incident
IDs and technician rules from the supplied repository context. Return an empty string
when no repository context is supplied.`;

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

    // Repository context travels with the extraction so the institutional answer
    // is produced in the same call instead of a second round trip
    const contextIncidents = Array.isArray(incidents) ? incidents.slice(0, 8) : [];
    const contextKnowledge = Array.isArray(knowledgeEntries) ? knowledgeEntries.slice(0, 10) : [];
    if (parts.length > 0 && (contextIncidents.length > 0 || contextKnowledge.length > 0)) {
      parts.push({
        text: `Verified Incidents: ${JSON.stringify(contextIncidents)}\nField Knowledge: ${JSON.stringify(contextKnowledge)}`,
      });
    }

    if (parts.length === 0) {
      return res.status(400).json({ success: false, error: 'No audio or text content provided for extraction.' });
    }

    const extractCacheKey = buildCacheKey('extract', {
      audio: audioBase64 ? crypto.createHash('sha256').update(audioBase64).digest('hex') : '',
      rawText: cleanRawText,
      machineId: cleanMachineId,
      incidents: contextIncidents,
      knowledge: contextKnowledge,
    });

    const cachedExtract = readAiCache(extractCacheKey);
    if (cachedExtract) {
      return res.json({ success: true, data: cachedExtract, cached: true });
    }

    if (!hasAiBudget()) {
      return res.status(429).json({
        success: false,
        error: `Daily AI extraction allowance reached (${totalAiUsage()}/${totalAiAllowance()} requests used). Previously analysed observations remain available from cache.`,
      });
    }

    const response = await generateWithFailover({
      model: 'gemini-3.8-flash',
      contents: parts,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    writeAiCache(extractCacheKey, parsed);
    return res.json({ success: true, data: parsed, cached: false });
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

    if (!hasGeminiCredentials()) {
      return res.status(503).json({ success: false, error: 'Gemini AI service is not configured (GEMINI_API_KEY missing). Local fallback is disabled.' });
    }

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

    const investigateCacheKey = buildCacheKey('investigate', {
      machineId: targetMachId,
      snapshot: sensorSnapshot || incident || null,
      historicalIncidents: historicalIncidents || [],
      knowledgeEntries: knowledgeEntries || [],
    });

    const cachedInvestigation = readAiCache(investigateCacheKey);
    if (cachedInvestigation) {
      return res.json({ success: true, data: cachedInvestigation, cached: true });
    }

    if (!hasAiBudget()) {
      return res.status(429).json({
        success: false,
        error: `Daily AI investigation allowance reached (${totalAiUsage()}/${totalAiAllowance()} requests used). Cached investigations remain available.`,
      });
    }

    const response = await generateWithFailover({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    writeAiCache(investigateCacheKey, parsed);
    return res.json({ success: true, data: parsed, cached: false });
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

    if (!hasGeminiCredentials()) {
      return res.status(503).json({ success: false, error: 'Gemini AI service is not configured (GEMINI_API_KEY missing). Local fallback is disabled.' });
    }

    const prompt = `User Query: "${cleanQuery}"
Target Machine: ${cleanMachineId}
Verified Incidents: ${JSON.stringify(Array.isArray(incidents) ? incidents.slice(0, 8) : [], null, 2)}
Field Knowledge: ${JSON.stringify(Array.isArray(knowledgeEntries) ? knowledgeEntries.slice(0, 10) : [], null, 2)}

Provide a concise, authoritative answer citing specific past incident IDs, technician rules, and ISO 10816-3 standards.`;

    const querySources = [
      `Central Repository records for ${cleanMachineId}`,
      'ISO 10816-3 Mechanical Specifications',
    ];

    const queryCacheKey = buildCacheKey('query', {
      query: cleanQuery.toLowerCase(),
      machineId: cleanMachineId,
      incidents: Array.isArray(incidents) ? incidents.slice(0, 8) : [],
      knowledge: Array.isArray(knowledgeEntries) ? knowledgeEntries.slice(0, 10) : [],
    });

    const cachedAnswer = readAiCache(queryCacheKey);
    if (cachedAnswer) {
      return res.json({ success: true, answer: cachedAnswer, sources: querySources, cached: true });
    }

    // Repository queries draw on the reserved portion of the daily allowance
    if (!hasAiBudget(true)) {
      return res.status(429).json({
        success: false,
        error: `Daily AI allowance reached (${totalAiUsage()}/${totalAiAllowance()} requests used). Previously answered repository queries remain available.`,
      });
    }

    const response = await generateWithFailover(
      {
        model: 'gemini-3.8-flash',
        contents: prompt,
      },
      true
    );

    writeAiCache(queryCacheKey, response.text);
    return res.json({
      success: true,
      answer: response.text,
      sources: querySources,
      cached: false,
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

// GET /api/users - List users
app.get('/api/users', (_req: Request, res: Response) => {
  const safeUsers = TECHNICIANS_REGISTRY.map(({ password_hash, ...u }) => u);
  return res.json({ success: true, users: safeUsers });
});

// POST /api/users - Create/register user
app.post('/api/users', (req: Request, res: Response) => {
  const { technician_id, name, email, role, shift, experience, skills, password } = req.body || {};
  if (!technician_id || !name || !email) {
    return res.status(400).json({ success: false, error: 'Missing required user fields.' });
  }

  const id = String(technician_id).trim().toUpperCase();
  const existingIdx = TECHNICIANS_REGISTRY.findIndex((t) => t.technician_id === id);

  const password_hash = password && String(password).trim()
    ? crypto.createHash('sha256').update(String(password).trim()).digest('hex')
    : DEFAULT_TECH_PASSWORD_HASH;

  const newUser: ServerTechnician = {
    technician_id: id,
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    role: String(role || 'Maintenance Specialist').trim(),
    shift: String(shift || 'Day Shift').trim(),
    experience: Number(experience || 0),
    skills: Array.isArray(skills) ? skills : [],
    password_hash,
    last_login: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    TECHNICIANS_REGISTRY[existingIdx] = newUser;
  } else {
    TECHNICIANS_REGISTRY.push(newUser);
  }

  const { password_hash: _, ...safeUser } = newUser;
  return res.json({ success: true, user: safeUser });
});

// PUT /api/users/:id - Update user
app.put('/api/users/:id', (req: Request, res: Response) => {
  const targetId = decodeURIComponent(req.params.id || '').trim().toUpperCase();
  const { name, email, role, shift, experience, skills, password } = req.body || {};

  const existingIdx = TECHNICIANS_REGISTRY.findIndex((t) => t.technician_id === targetId);
  const password_hash = password && String(password).trim()
    ? crypto.createHash('sha256').update(String(password).trim()).digest('hex')
    : existingIdx >= 0 ? TECHNICIANS_REGISTRY[existingIdx].password_hash : DEFAULT_TECH_PASSWORD_HASH;

  const updatedUser: ServerTechnician = {
    technician_id: targetId,
    name: name ? String(name).trim() : (existingIdx >= 0 ? TECHNICIANS_REGISTRY[existingIdx].name : 'User'),
    email: email ? String(email).trim().toLowerCase() : (existingIdx >= 0 ? TECHNICIANS_REGISTRY[existingIdx].email : ''),
    role: role ? String(role).trim() : (existingIdx >= 0 ? TECHNICIANS_REGISTRY[existingIdx].role : 'Maintenance Specialist'),
    shift: shift ? String(shift).trim() : (existingIdx >= 0 ? TECHNICIANS_REGISTRY[existingIdx].shift : 'Day Shift'),
    experience: experience !== undefined ? Number(experience) : (existingIdx >= 0 ? TECHNICIANS_REGISTRY[existingIdx].experience : 0),
    skills: Array.isArray(skills) ? skills : (existingIdx >= 0 ? TECHNICIANS_REGISTRY[existingIdx].skills : []),
    password_hash,
    last_login: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    TECHNICIANS_REGISTRY[existingIdx] = updatedUser;
  } else {
    TECHNICIANS_REGISTRY.push(updatedUser);
  }

  const { password_hash: _, ...safeUser } = updatedUser;
  return res.json({ success: true, user: safeUser });
});

// DELETE /api/users/:id - Delete user
app.delete('/api/users/:id', (req: Request, res: Response) => {
  const targetId = decodeURIComponent(req.params.id || '').trim().toUpperCase();
  const existingIdx = TECHNICIANS_REGISTRY.findIndex((t) => t.technician_id === targetId);
  if (existingIdx >= 0) {
    TECHNICIANS_REGISTRY.splice(existingIdx, 1);
  }
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
    console.log(` Gemini AI Engine: ${hasGeminiCredentials() ? `Active (${GEMINI_API_KEYS.length} key${GEMINI_API_KEYS.length > 1 ? 's' : ''} loaded, ${totalAiAllowance()} requests/day)` : 'Fallback heuristic mode (No API Key)'}`);
    console.log(` Session Security: ${process.env.SESSION_SECRET ? 'Configured via Secret Manager / Env' : 'Using default development key'}`);
    console.log(`================================================================`);
  });
});
