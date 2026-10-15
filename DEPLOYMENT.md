# PromptNova MachineMemory - Multi-Environment Deployment & Secret Manager Guide

This guide details how to manage sensitive secrets via **Google Cloud Secret Manager**, safely push this repository to **GitHub**, and run or deploy the application across **Local Development**, **Google AI Studio**, **Google Cloud Run**, and **Firebase**.

---

## 1. System Architecture Overview

```
                               ┌────────────────────────────────────────────────────────┐
                               │           Google Cloud Secret Manager                  │
                               │  - GEMINI_API_KEY (Gemini 2.5/Flash AI key)            │
                               │  - SESSION_SECRET (Backend JWT signing secret)         │
                               └──────────────────────────┬─────────────────────────────┘
                                                          │
                   ┌──────────────────────────────────────┼─────────────────────────────────────┐
                   │ (Mounted via IAM)                    │ (Extracted for local)               │ (Injected in container)
                   ▼                                      ▼                                     ▼
     ┌───────────────────────────┐          ┌───────────────────────────┐         ┌───────────────────────────┐
     │     Google AI Studio      │          │     Local Development     │         │     Google Cloud Run      │
     │                           │          │                           │         │                           │
     │ • Built-in secrets panel  │          │ • Reads from gitignored   │         │ • Automatically injected  │
     │ • Injected into           │          │   local '.env'            │         │   via --set-secrets flag  │
     │   process.env             │          │ • Runs 'npm run dev'      │         │ • Container port 8080     │
     └───────────────────────────┘          └─────────────┬─────────────┘         └─────────────▲─────────────┘
                                                          │                                     │
                                                          │ Push clean code                     │ Automated deploy
                                                          ▼                                     │
                                            ┌───────────────────────────┐                       │
                                            │     GitHub Repository     │───────────────────────┘
                                            │ • .gitignore excludes .env│ (GitHub Actions CI/CD)
                                            │ • Dockerfile included     │
                                            └───────────────────────────┘
```

---

## 2. Step 1: Create Secrets in Google Cloud Secret Manager

Open your terminal with the `gcloud` CLI logged into your Google Cloud project:

```bash
# 1. Select your Google Cloud project
gcloud config set project YOUR_PROJECT_ID

# 2. Enable Secret Manager, Cloud Run, and Cloud Build APIs
gcloud services enable \
  secretmanager.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com

# 3. Create the GEMINI_API_KEY secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_ACTUAL_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 4. Create the SESSION_SECRET (Generate a strong 32-byte hex key)
STRONG_SESSION_SECRET=$(openssl rand -hex 32)
gcloud secrets create SESSION_SECRET --replication-policy="automatic"
echo -n "$STRONG_SESSION_SECRET" | gcloud secrets versions add SESSION_SECRET --data-file=-
```

---

## 3. Step 2: Grant Cloud Run Permission to Access Secrets

Google Cloud Run uses the Default Compute Service Account (or a custom service account) to pull secrets at startup:

```bash
# Retrieve your project number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')
RUN_SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant the Secret Accessor role to the service account
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${RUN_SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding SESSION_SECRET \
  --member="serviceAccount:${RUN_SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Step 3: Running Locally

For local development, keep your secrets in a local `.env` file. **The `.env` file is excluded in `.gitignore` and will never be committed to GitHub.**

### Option A: Manual Setup
```bash
# 1. Copy the template
cp .env.example .env

# 2. Edit .env with your keys
# GEMINI_API_KEY="your-gemini-key"
# SESSION_SECRET="your-session-secret"
# PORT=3000

# 3. Start local development
npm run dev
```

### Option B: Sync Directly from Secret Manager (Automated)
If you have `gcloud` CLI installed, fetch the secrets directly into `.env`:
```bash
echo "PORT=3000" > .env
echo "NODE_ENV=development" >> .env
echo "GEMINI_API_KEY=$(gcloud secrets versions access latest --secret=GEMINI_API_KEY)" >> .env
echo "SESSION_SECRET=$(gcloud secrets versions access latest --secret=SESSION_SECRET)" >> .env

npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Step 4: Running in Google AI Studio

In Google AI Studio:
1. **Zero Configuration**: AI Studio automatically injects `GEMINI_API_KEY` and `APP_URL` into `process.env`.
2. The server detects `process.env.GEMINI_API_KEY` and connects seamlessly to Gemini 2.5 / Flash models.
3. If no key is set, the server automatically operates in intelligent fallback mode without crashing.

---

## 6. Step 5: Uploading Safely to GitHub

Before uploading to GitHub, verify that no credentials or `.env` files are tracked:

```bash
# 1. Check git status to ensure .env is NOT staged
git status

# 2. Initialize repository (if not already done)
git init
git add .
git commit -m "chore: initial commit with secure Secret Manager architecture"

# 3. Add your GitHub remote and push
git remote add origin https://github.com/YOUR_USERNAME/promptnova-machinememory.git
git branch -M main
git push -u origin main
```

> **Security Verification**: Look at your GitHub repository online. Ensure you only see `.env.example`, `Dockerfile`, `server.ts`, and `src/`. Neither `.env` nor private keys will be present.

---

## 7. Step 6: Deploying to Google Cloud Run with Secret Manager

In Google Cloud Run, both your backend secrets and Firebase configuration parameters can be mapped from Google Cloud Secret Manager.

### Option A: Create Secret for Firebase Configuration
```bash
# 1. Create a secret containing your Firebase client parameters
gcloud secrets create FIREBASE_API_KEY --replication-policy="automatic"
echo -n "AIzaSyA_iLOEDSoDGSRiIjFd1wGW7UutmM_ax78" | gcloud secrets versions add FIREBASE_API_KEY --data-file=-

# 2. Grant Cloud Run access
gcloud secrets add-iam-policy-binding FIREBASE_API_KEY \
  --member="serviceAccount:${RUN_SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

### Option B: Deploy with Combined Secrets & Environment Variables
Deploy directly from your project directory using Google Cloud Build and Cloud Run:

```bash
# Deploy unified container to Cloud Run with automatic Secret Manager injection:
gcloud run deploy promptnova-machinememory \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest,SESSION_SECRET=SESSION_SECRET:latest,VITE_FIREBASE_API_KEY=FIREBASE_API_KEY:latest" \
  --set-env-vars="NODE_ENV=production,VITE_FIREBASE_PROJECT_ID=smiling-agility-vxtlg,VITE_FIREBASE_APP_ID=1:567344177413:web:55807dda85b5361d60176c,VITE_FIREBASE_AUTH_DOMAIN=smiling-agility-vxtlg.firebaseapp.com,VITE_FIREBASE_STORAGE_BUCKET=smiling-agility-vxtlg.firebasestorage.app,VITE_FIREBASE_DATABASE_ID=ai-studio-295101cd-02e9-46aa-915e-767feeb43501,VITE_FIREBASE_MESSAGING_SENDER_ID=567344177413"
```

### What Happens Behind the Scenes:
1. Cloud Build compiles the multi-stage `Dockerfile` (with zero references to `firebase-applet-config.json`).
2. Vite builds the React production frontend into `dist/`.
3. Cloud Run spins up the container and maps the Secret Manager versions directly into `process.env`.
4. The backend exposes `/api/config/firebase` so the frontend can retrieve runtime parameters if needed.
5. Cloud Run gives you a live HTTPS URL (e.g. `https://promptnova-machinememory-xyz-as.a.run.app`).

### Verify Deployment:
Check the health-check endpoint:
```bash
curl https://YOUR_CLOUD_RUN_URL/api/health
```
Expected response:
```json
{
  "status": "healthy",
  "service": "MachineMemory Industrial Intelligence Platform",
  "environment": "production",
  "secretsStatus": {
    "geminiApiKeyConfigured": true,
    "sessionSecretConfigured": true,
    "firebaseConfigured": true
  }
}
```

---

## 8. Step 7: Connecting with Firebase

### A. Firestore Database & Storage
The application connects to Firestore database `ai-studio-295101cd-02e9-46aa-915e-767feeb43501` and Firebase Storage bucket `smiling-agility-vxtlg.firebasestorage.app`.
- **Zero Static Config Files**: `firebase-applet-config.json` has been eliminated from the repository.
- **Environment Driven**: `src/lib/firebase.ts` dynamically reads all connection details from `import.meta.env.VITE_FIREBASE_*` (loaded locally from `.env` and in cloud from container environment).
- Database access is strictly governed by `firestore.rules`.
- Make sure to deploy rules if modified:
  ```bash
  firebase deploy --only firestore:rules
  ```

### B. Firebase Hosting (Custom Domain Routing)
If you want to use Firebase Hosting with a custom domain pointing to your Cloud Run service, add a `firebase.json` rewrite:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "run": {
          "serviceId": "promptnova-machinememory",
          "region": "asia-southeast1"
        }
      }
    ]
  }
}
```

Then deploy hosting:
```bash
firebase deploy --only hosting
```

---

## 9. Automated CI/CD: GitHub Actions (Optional)

To automatically deploy to Cloud Run whenever you push to GitHub `main`:

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy promptnova-machinememory \
            --source . \
            --region asia-southeast1 \
            --platform managed \
            --allow-unauthenticated \
            --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest,SESSION_SECRET=SESSION_SECRET:latest,VITE_FIREBASE_API_KEY=FIREBASE_API_KEY:latest" \
            --set-env-vars="NODE_ENV=production,VITE_FIREBASE_PROJECT_ID=smiling-agility-vxtlg,VITE_FIREBASE_APP_ID=1:567344177413:web:55807dda85b5361d60176c,VITE_FIREBASE_AUTH_DOMAIN=smiling-agility-vxtlg.firebaseapp.com,VITE_FIREBASE_STORAGE_BUCKET=smiling-agility-vxtlg.firebasestorage.app,VITE_FIREBASE_DATABASE_ID=ai-studio-295101cd-02e9-46aa-915e-767feeb43501,VITE_FIREBASE_MESSAGING_SENDER_ID=567344177413"
```

Add your service account key as a secret named `GCP_SA_KEY` in GitHub (Settings > Secrets and variables > Actions).

---

## 10. Summary of Secrets & Environment Matrix

| Secret / Config | Local Machine | Google AI Studio | Google Cloud Run | GitHub Repository |
| :--- | :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | `.env` file | AI Studio Secrets UI | Secret Manager (`--set-secrets`) | Never stored |
| `SESSION_SECRET` | `.env` file | Env / Default Key | Secret Manager (`--set-secrets`) | Never stored |
| `PORT` | `3000` | `3000` | `8080` (auto-set) | `.env.example` |
| `NODE_ENV` | `development` | `development` | `production` | Default in Docker |
| `VITE_FIREBASE_API_KEY` | `.env` file | `.env` / Process Env | Secret Manager / Env | `.env.example` (template) |
| `VITE_FIREBASE_PROJECT_ID`| `.env` file | `.env` / Process Env | Cloud Run Env | `.env.example` (template) |
| `VITE_FIREBASE_STORAGE_BUCKET`| `.env` file | `.env` / Process Env | Cloud Run Env | `.env.example` (template) |
| `firebase-applet-config.json` | Removed | Removed | Removed | Ignored in `.gitignore` |

