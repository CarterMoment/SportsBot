#!/bin/bash

echo "🏀 Creating Sportsbook EV Analyzer project structure..."

# Root directory
mkdir -p sportsbook-ev-analyzer
cd sportsbook-ev-analyzer

# Create directory structure
mkdir -p services/ingestion-worker/{src,config,tests}
mkdir -p services/api/{app,config,tests}
mkdir -p shared/{schemas,utils,constants}
mkdir -p config/{firebase,env-templates}
mkdir -p infra/{docker,k8s}
mkdir -p docs

# ==========================================
# INGESTION WORKER (Node.js)
# ==========================================

# package.json
cat > services/ingestion-worker/package.json << 'EOF'
{
  "name": "ingestion-worker",
  "version": "1.0.0",
  "description": "NBA odds ingestion worker",
  "main": "src/index.js",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "dotenv": "^16.4.0",
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "@types/node": "^20.11.0"
  }
}
EOF

# Ingestion worker main file
cat > services/ingestion-worker/src/index.js << 'EOF'
import dotenv from 'dotenv';
import { initializeFirebase } from './firebase.js';
import { fetchNBAOdds } from './oddsApi.js';
import { normalizeAndStore } from './processor.js';

dotenv.config();

const INGESTION_INTERVAL = (parseInt(process.env.INGESTION_INTERVAL_MINUTES) || 10) * 60 * 1000;

async function runIngestion() {
  console.log('🏀 Starting NBA odds ingestion...');
  
  try {
    const oddsData = await fetchNBAOdds();
    console.log(`✅ Fetched ${oddsData.length} NBA games`);
    
    const stored = await normalizeAndStore(oddsData);
    console.log(`💾 Stored ${stored} odds records to Firestore`);
    
  } catch (error) {
    console.error('❌ Ingestion error:', error.message);
  }
}

async function main() {
  console.log('🚀 Initializing Sportsbook EV Analyzer - Ingestion Worker');
  
  // Initialize Firebase
  await initializeFirebase();
  
  // Run immediately
  await runIngestion();
  
  // Schedule recurring ingestion
  setInterval(runIngestion, INGESTION_INTERVAL);
  console.log(`⏰ Scheduled ingestion every ${process.env.INGESTION_INTERVAL_MINUTES || 10} minutes`);
}

main().catch(console.error);
EOF

# Firebase initialization
cat > services/ingestion-worker/src/firebase.js << 'EOF'
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let db;

export async function initializeFirebase() {
  try {
    const serviceAccount = JSON.parse(
      readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8')
    );
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });
    
    db = admin.firestore();
    console.log('✅ Firebase initialized');
    return db;
    
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    process.exit(1);
  }
}

export function getFirestore() {
  if (!db) {
    throw new Error('Firestore not initialized. Call initializeFirebase() first.');
  }
  return db;
}
EOF

# Odds API client
cat > services/ingestion-worker/src/oddsApi.js << 'EOF'
import fetch from 'node-fetch';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

export async function fetchNBAOdds() {
  const apiKey = process.env.ODDS_API_KEY;
  const bookmakers = process.env.BOOKMAKER_ALLOWLIST || 'draftkings,fanduel';
  
  const url = new URL(`${ODDS_API_BASE}/sports/basketball_nba/odds`);
  url.searchParams.append('apiKey', apiKey);
  url.searchParams.append('regions', 'us');
  url.searchParams.append('markets', 'spreads');
  url.searchParams.append('oddsFormat', 'american');
  url.searchParams.append('bookmakers', bookmakers);
  
  console.log(`📡 Fetching odds from: ${url.pathname}`);
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`Odds API error: ${response.status} ${response.statusText}`);
  }
  
  // Check rate limit headers
  const remaining = response.headers.get('x-requests-remaining');
  const used = response.headers.get('x-requests-used');
  console.log(`📊 API Usage: ${used} used, ${remaining} remaining`);
  
  return await response.json();
}
EOF

# Data processor
cat > services/ingestion-worker/src/processor.js << 'EOF'
import { getFirestore } from './firebase.js';

export async function normalizeAndStore(oddsData) {
  const db = getFirestore();
  const batch = db.batch();
  let count = 0;
  
  for (const game of oddsData) {
    const gameId = game.id;
    const commenceTime = new Date(game.commence_time);
    
    for (const bookmaker of game.bookmakers) {
      // Only process allowed bookmakers
      const allowlist = process.env.BOOKMAKER_ALLOWLIST.split(',');
      if (!allowlist.includes(bookmaker.key)) continue;
      
      // Extract spreads market
      const spreadsMarket = bookmaker.markets.find(m => m.key === 'spreads');
      if (!spreadsMarket) continue;
      
      for (const outcome of spreadsMarket.outcomes) {
        const docId = `${gameId}_${bookmaker.key}_${outcome.name}`;
        const docRef = db.collection('odds').doc(docId);
        
        const normalized = {
          // Game identifiers
          game_id: gameId,
          sport: game.sport_key,
          home_team: game.home_team,
          away_team: game.away_team,
          commence_time: admin.firestore.Timestamp.fromDate(commenceTime),
          
          // Bookmaker & outcome
          bookmaker: bookmaker.key,
          team: outcome.name,
          
          // Spreads data
          point_spread: outcome.point,
          odds: outcome.price,
          
          // Metadata
          last_update: admin.firestore.FieldValue.serverTimestamp(),
          ingested_at: admin.firestore.FieldValue.serverTimestamp(),
          
          // Placeholder for EV calculation (later milestone)
          ev_percentage: null,
          is_positive_ev: false
        };
        
        batch.set(docRef, normalized, { merge: true });
        count++;
      }
    }
  }
  
  await batch.commit();
  return count;
}
EOF

# Worker .env template
cat > services/ingestion-worker/.env.example << 'EOF'
# The Odds API
ODDS_API_KEY=your_odds_api_key_here

# Firebase
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=../../config/firebase-service-account.json

# Worker Configuration
INGESTION_INTERVAL_MINUTES=10
BOOKMAKER_ALLOWLIST=draftkings,fanduel,betmgm,betrivers

# Environment
NODE_ENV=development
EOF

# Worker Dockerfile
cat > services/ingestion-worker/Dockerfile << 'EOF'
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY config/ ./config/

CMD ["npm", "start"]
EOF

# ==========================================
# API SERVICE (FastAPI)
# ==========================================

# requirements.txt
cat > services/api/requirements.txt << 'EOF'
fastapi==0.109.0
uvicorn[standard]==0.27.0
firebase-admin==6.4.0
pydantic==2.5.3
python-dotenv==1.0.0
pydantic-settings==2.1.0
EOF

# API main file
cat > services/api/app/main.py << 'EOF'
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
from .models import OddsResponse, HealthResponse
from .config import settings

app = FastAPI(
    title="Sportsbook EV Analyzer API",
    description="Market-based +EV analysis for NBA spreads",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firebase
cred = credentials.Certificate(settings.firebase_service_account_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

@app.get("/", response_model=HealthResponse)
async def root():
    return {
        "status": "healthy",
        "service": "Sportsbook EV Analyzer API",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/odds", response_model=List[OddsResponse])
async def get_odds(
    bookmaker: Optional[str] = Query(None, description="Filter by bookmaker"),
    team: Optional[str] = Query(None, description="Filter by team name"),
    min_ev: Optional[float] = Query(None, description="Minimum EV percentage"),
    limit: int = Query(100, le=500, description="Max results")
):
    """
    Retrieve NBA spreads odds with optional filtering
    """
    query = db.collection('odds')
    
    # Apply filters
    if bookmaker:
        query = query.where('bookmaker', '==', bookmaker)
    if team:
        query = query.where('team', '==', team)
    if min_ev is not None:
        query = query.where('ev_percentage', '>=', min_ev)
    
    # Order by commence time
    query = query.order_by('commence_time', direction=firestore.Query.DESCENDING)
    query = query.limit(limit)
    
    docs = query.stream()
    
    results = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        results.append(data)
    
    return results

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
EOF

# Pydantic models
cat > services/api/app/models.py << 'EOF'
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class OddsResponse(BaseModel):
    id: str
    game_id: str
    sport: str
    home_team: str
    away_team: str
    commence_time: datetime
    bookmaker: str
    team: str
    point_spread: float
    odds: int
    ev_percentage: Optional[float]
    is_positive_ev: bool
    last_update: datetime

class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str
EOF

# API config
cat > services/api/app/config.py << 'EOF'
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    firebase_project_id: str
    firebase_service_account_path: str = "./config/firebase-service-account.json"
    api_port: int = 8000
    
    class Config:
        env_file = ".env"

settings = Settings()
EOF

# API __init__
cat > services/api/app/__init__.py << 'EOF'
# API package
EOF

# API .env template
cat > services/api/.env.example << 'EOF'
# Firebase
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=../../config/firebase-service-account.json

# API Configuration
API_PORT=8000
EOF

# API Dockerfile
cat > services/api/Dockerfile << 'EOF'
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY config/ ./config/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF

# ==========================================
# SHARED RESOURCES
# ==========================================

# Shared constants
cat > shared/constants/bookmakers.js << 'EOF'
export const ALLOWED_BOOKMAKERS = [
  'draftkings',
  'fanduel',
  'betmgm',
  'betrivers',
  'williamhill_us',
  'pointsbetus'
];

export const BOOKMAKER_DISPLAY_NAMES = {
  'draftkings': 'DraftKings',
  'fanduel': 'FanDuel',
  'betmgm': 'BetMGM',
  'betrivers': 'BetRivers',
  'williamhill_us': 'William Hill',
  'pointsbetus': 'PointsBet'
};
EOF

cat > shared/constants/markets.js << 'EOF'
export const MARKETS = {
  SPREADS: 'spreads',
  H2H: 'h2h',
  TOTALS: 'totals'
};

export const SUPPORTED_MARKETS = [MARKETS.SPREADS];
EOF

# ==========================================
# CONFIGURATION FILES
# ==========================================

# Root .gitignore
cat > .gitignore << 'EOF'
# Environment variables
.env
.env.local
.env.*.local

# Service account credentials
**/firebase-service-account.json
config/firebase-service-account.json

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
ENV/
env/

# IDEs
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log

# Build outputs
dist/
build/
EOF

# Root README
cat > README.md << 'EOF'
# 🏀 Sportsbook EV Analyzer

Market-based +EV analysis platform for NBA spreads betting.

## Project Structure
```
sportsbook-ev-analyzer/
├── services/
│   ├── ingestion-worker/    # Node.js odds ingestion
│   └── api/                 # FastAPI REST API
├── shared/                  # Shared constants & schemas
├── config/                  # Configuration files
└── infra/                   # Deployment configs
```

## Quick Start

See [docs/SETUP.md](docs/SETUP.md) for complete setup instructions.

## Services

- **Ingestion Worker**: Fetches NBA spreads from The Odds API every 10 minutes
- **API**: REST API for querying odds and EV opportunities

## Tech Stack

- **Database**: Firebase Firestore
- **Worker**: Node.js 20+
- **API**: FastAPI (Python 3.11+)
- **Deployment**: Cloud Run (planned)
EOF

# Docker Compose
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  ingestion-worker:
    build:
      context: ./services/ingestion-worker
      dockerfile: Dockerfile
    env_file:
      - ./services/ingestion-worker/.env
    volumes:
      - ./config:/app/config:ro
    restart: unless-stopped

  api:
    build:
      context: ./services/api
      dockerfile: Dockerfile
    env_file:
      - ./services/api/.env
    volumes:
      - ./config:/app/config:ro
    ports:
      - "8000:8000"
    restart: unless-stopped
EOF

# ==========================================
# DOCUMENTATION
# ==========================================

cat > docs/SETUP.md << 'EOF'
# Setup Instructions

## Prerequisites
- Node.js 20+
- Python 3.11+
- Firebase project created
- The Odds API key

## Setup Steps

1. Copy environment templates
2. Add Firebase service account JSON
3. Install dependencies
4. Run services

See main README for detailed instructions.
EOF

cat > docs/ARCHITECTURE.md << 'EOF'
# Architecture Overview

## Data Flow

1. **Ingestion Worker** polls The Odds API every 10 minutes
2. Normalizes odds data (spreads only, NBA only)
3. Writes to Firestore collection: `odds`
4. **API** serves filtered queries to clients

## Database Schema

### Collection: `odds`

- `game_id`: string
- `home_team`: string
- `away_team`: string
- `commence_time`: timestamp
- `bookmaker`: string
- `team`: string
- `point_spread`: number
- `odds`: number (American format)
- `ev_percentage`: number (nullable)
- `is_positive_ev`: boolean

## Future Milestones

- [ ] EV calculation engine
- [ ] Ranking algorithm
- [ ] iOS app integration
- [ ] Real-time updates
EOF

echo ""
echo "✅ Project structure created successfully!"
echo ""
echo "📁 Your project is ready in: ./sportsbook-ev-analyzer"
echo ""
echo "Next steps:"
echo "  1. cd sportsbook-ev-analyzer"
echo "  2. Follow setup instructions in the guide"
echo ""