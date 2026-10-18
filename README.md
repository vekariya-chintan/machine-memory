# Machine Memory: Industrial Operations Platform

Machine Memory is a robust, autonomous industrial operations and diagnostic platform designed to bridge the gap between real-time sensor telemetry and institutional technical expertise. It helps maintenance teams monitor assets, investigate incidents, and maintain a centralized repository of diagnostic knowledge.

## Key Features

- **Fleet Health Monitoring**: Real-time dashboard with aggregate KPI metrics (vibration, active load, ISO compliance) for automated manufacturing cells.
- **Asset Management**: Centralized registry for industrial assets with configurable baseline thresholds based on ISO 10816-3 standards.
- **Autonomous Incident Investigation**: A structured 6-step workflow for diagnosing machine failures:
    1. Incident Report (Voice Memo)
    2. Fact Extraction
    3. Telemetry Analysis
    4. Semantic Memory Retrieval
    5. Grounded Root-Cause Hypothesis
    6. Human Verification & Learning
- **Institutional Repository**: A searchable database of past incidents, technician heuristics, and verified maintenance procedures, augmented by AI-powered semantic search.

## Technology Stack

- **Frontend**: React (SPA), TypeScript, Vite
- **Styling**: Tailwind CSS
- **Data & Auth**: Firebase (Firestore, Authentication)
- **Icons**: Lucide React
- **Diagnostics**: Custom autonomous diagnostic engine grounded in historical memory

## Setup Instructions

This project requires a Firebase project for data persistence and authentication.

1. **Clone the repository.**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure environment variables:**
   Create a `.env` file based on `.env.example` and populate it with your Firebase configuration.
4. **Run the development server:**
   ```bash
   npm run dev
   ```

## Project Structure

- `src/components/`: Core UI components (Dashboard, Asset Management, Investigation Workflow, Repository, etc.)
- `src/services/`: Services for Firebase interactions, auth, and data management.
- `src/types/`: TypeScript definitions for the industrial domain (Assets, Incidents, Knowledge).
- `src/lib/`: Security validation and utility libraries.
