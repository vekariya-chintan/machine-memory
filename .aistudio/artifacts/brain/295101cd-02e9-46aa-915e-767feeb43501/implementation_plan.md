# Google Cloud Secret Manager Migration & Multi-Environment Deployment Plan

Establish an enterprise-grade secret management architecture moving sensitive credentials (Gemini API key, JWT/Session signing secret) to Google Cloud Secret Manager, ensuring zero secrets leak to GitHub, while enabling smooth operation across Local Development, AI Studio, and Google Cloud Run / Firebase.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed based on your requirements:
> - **Secret Access Pattern**: Google Cloud Run native secret environment mapping via `--set-secrets` flags. Cloud Run mounts secrets directly into `process.env` at container launch without needing heavy runtime SDK calls or extra latency.
> - **Production Deployment Target**: Unified full-stack Node container on Google Cloud Run serving both the Express backend API proxy and the pre-built React Vite static frontend on port 3000 / 8080.
> - **Target Secrets**: `GEMINI_API_KEY` and `SESSION_SECRET` moved to Google Cloud Secret Manager. Client-facing Firebase configuration (`projectId`, `appId`, etc.) is safely parameterized via environment variables and gitignored if desired.

- **Confirmed Decision 1**: Store `GEMINI_API_KEY` and `SESSION_SECRET` in Google Cloud Secret Manager with versioned payloads.
- **Confirmed Decision 2**: Cloud Run service account is granted `roles/secretmanager.secretAccessor` IAM role to automatically inject secrets into the container environment.
- **Confirmed Decision 3**: Local development uses a gitignored `.env` file; Google AI Studio continues to inject credentials via its built-in environment injection; GitHub uses GitHub Actions encrypted secrets for automated CI/CD deployment.

---

## 1. Overview & Core Concept

When publishing code to GitHub and deploying to Google Cloud (Cloud Run / Firebase), hardcoded API keys or checked-in environment files represent critical security vulnerabilities. 

This implementation provides a unified configuration strategy:
1. **GitHub Protection**: Sanitizes the repository so no `.env`, private keys, or API tokens can ever be committed to git.
2. **Google Cloud Secret Manager**: Centrally stores sensitive tokens (`GEMINI_API_KEY`, `SESSION_SECRET`) in your GCP project.
3. **Multi-Environment Harmony**:
   - **Local Machine**: Runs via local `.env` (gitignored) or dynamic `gcloud secrets versions access` generation.
   - **AI Studio**: Operates without changes; AI Studio natively injects `GEMINI_API_KEY` and `APP_URL` into `process.env`.
   - **Google Cloud Run**: Automatically binds Secret Manager secrets to standard environment variables at runtime (`--set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest`).
   - **Firebase Integration**: Firebase Firestore client configuration is decoupled from static files and read from `process.env` / Vite env with fallback defaults.

---

## 2. Developer Workflow & Operational Sequences

### End-to-End Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           1. LOCAL ENVIRONMENT                              │
│                                                                             │
│   Developer Workstation                                                     │
│   ├── .env (GITIGNORED: contains local GEMINI_API_KEY & SESSION_SECRET)    │
│   ├── .gitignore (Blocks .env, .env.local, service-account*.json)           │
│   └── npm run dev (Loads .env via dotenv, starts Express + Vite)            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ git push (No secrets committed)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           2. GITHUB REPOSITORY                              │
│                                                                             │
│   GitHub Remote (Public or Private)                                         │
│   ├── Clean source code + Dockerfile + .env.example (Templates only)        │
│   └── GitHub Actions CI/CD (Optional: Workload Identity / GCP Deploy)       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Build & Deploy
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   3. GOOGLE CLOUD PLATFORM (PRODUCTION)                     │
│                                                                             │
│   ┌────────────────────────────────┐    ┌───────────────────────────────┐   │
│   │  Google Cloud Secret Manager   │    │      Google Artifact Registry │   │
│   │  ├── GEMINI_API_KEY (v1)       │    │      (Production Docker Image)│   │
│   │  └── SESSION_SECRET (v1)       │    └──────────────┬────────────────┘   │
│   └──────────────┬─────────────────┘                   │                    │
│                  │                                     │                    │
│                  │ Automatic Injection via IAM         │ Pulls container    │
│                  ▼                                     ▼                    │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │              Google Cloud Run Service (Port 8080/3000)              │   │
│   │  - Service Account: <project-number>-compute@developer.gservice... │   │
│   │  - IAM Role: roles/secretmanager.secretAccessor                     │   │
│   │  - process.env.GEMINI_API_KEY  ◄── GEMINI_API_KEY:latest            │   │
│   │  - process.env.SESSION_SECRET  ◄── SESSION_SECRET:latest            │   │
│   │  - Serves API routes (/api/*) + React Single Page App               │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Cloud Run Native Secret Mounting vs. In-Code Secret Manager SDK**
  - *Chosen Approach*: Cloud Run Native Secret Mounting via `--set-secrets`.
  - *Why*: Eliminates application boot latency (no extra HTTP handshakes to Secret Manager API on every startup), removes `@google-cloud/secret-manager` runtime package overhead, and allows identical code (`process.env.GEMINI_API_KEY`) to run across Local, AI Studio, and Cloud Run without branching logic.
  - *Alternatives Considered*: Fetching secrets asynchronously inside `server.ts` before server start. Demoted because it breaks local offline development when GCP credentials are not active.

- **Decision 2: Docker Containerization for Cloud Run**
  - *Chosen Approach*: Multi-stage `Dockerfile` optimizing image size. Stage 1 builds the Vite frontend assets into `/dist`; Stage 2 runs Express and static file serving with Node runtime.
  - *Why*: Self-contained, portable, reproducible, and ready for one-command deployment to Cloud Run.

- **Decision 3: Firebase Config Management**
  - *Chosen Approach*: Keep client Firebase config in environment-driven format (`process.env.VITE_FIREBASE_*` with fallback to `firebase-applet-config.json`).
  - *Why*: Firebase web API keys are client-side public identifiers restricted by Firebase Security Rules and domain allowlists; separating private backend keys (`GEMINI_API_KEY`, `SESSION_SECRET`) from public client IDs prevents configuration confusion.

---

## 4. Technical Architecture & Step-by-Step Runbook

### Phase A: Google Cloud Secret Manager Setup

Execute these commands using `gcloud` CLI in your Google Cloud Project:

```bash
# 1. Enable Required GCP APIs
gcloud services enable secretmanager.googleapis.com run.googleapis.com cloudbuild.googleapis.com

# 2. Create the Secrets
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
gcloud secrets create SESSION_SECRET --replication-policy="automatic"

# 3. Add Values to the Secrets
echo -n "YOUR_ACTUAL_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
echo -n "YOUR_RANDOM_LONG_HEX_SESSION_SECRET" | gcloud secrets versions add SESSION_SECRET --data-file=-

# 4. Grant Cloud Run Service Account Access to the Secrets
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding SESSION_SECRET \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

---

### Phase B: Codebase Hardening & Files to Add/Update

1. **Update `.gitignore`**:
   - Ensure `.env`, `.env.*`, `*.pem`, `service-account*.json`, and any secrets cannot be tracked.
2. **Create Production `Dockerfile`**:
   - Multi-stage build running `npm run build` and launching `tsx server.ts` or Node with `PORT=8080`.
3. **Create `.dockerignore`**:
   - Exclude `node_modules`, `.git`, `.env`, and documentation to ensure fast container builds.
4. **Update `server.ts`**:
   - Read `PORT` defaults (supporting both Cloud Run `PORT=8080` and dev `PORT=3000`).
   - Validate environment variable availability on startup with helpful diagnostics if `GEMINI_API_KEY` or `SESSION_SECRET` is unset.
5. **Update `.env.example`**:
   - Document all required variables (`GEMINI_API_KEY`, `SESSION_SECRET`, `PORT`, `NODE_ENV`).
6. **Provide `DEPLOYMENT.md`**:
   - Step-by-step developer guide with exact shell commands for GitHub, Secret Manager, Cloud Run, and Firebase Hosting.

---

### Phase C: How It Runs Across Environments

| Environment | Secret Source | How It Works |
| :--- | :--- | :--- |
| **Local Machine** | `.env` file | Developers copy `.env.example` to `.env`. `dotenv.config()` loads variables into `process.env`. |
| **AI Studio** | AI Studio Secrets Panel | AI Studio automatically injects `process.env.GEMINI_API_KEY`. No changes required. |
| **Google Cloud Run** | Cloud Run `--set-secrets` | Cloud Run securely pulls from Secret Manager at container initialization. |
| **Firebase / GitHub** | GitHub Secrets (CI/CD) | Automated deployment workflow passes credentials to Cloud Run without committing them. |

---

## 5. Verification & Validation Steps

1. **Verify Git Cleanliness**:
   - Run `git status` check to ensure no sensitive files (`.env`, private keys) are staged.
2. **Verify Local Startup**:
   - Test `npm run build` and `npm start` with environment variables.
3. **Verify Dev Server**:
   - Ensure AI Studio dev server (`npm run dev`) continues serving smoothly on port 3000.
4. **Compile & Lint Check**:
   - Run `npm run lint` and `npm run build` to verify zero build errors.
