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
