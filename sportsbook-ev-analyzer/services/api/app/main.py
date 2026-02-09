from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta
from .config import settings

app = FastAPI(
    title="Sportsbook EV Analyzer API",
    description="Market-based +EV analysis for NBA spreads",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Firebase
cred = credentials.Certificate(settings.firebase_service_account_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

@app.get("/")
async def root():
    return {
        "status": "healthy",
        "service": "Sportsbook EV Analyzer API",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/odds")
async def get_odds(
    bookmaker: Optional[str] = Query(None, description="Filter by bookmaker"),
    team: Optional[str] = Query(None, description="Filter by team name"),
    min_ev: Optional[float] = Query(None, description="Minimum EV percentage"),
    hours_ahead: int = Query(48, ge=1, le=168, description="Only show games starting within X hours"),
    limit: int = Query(100, le=500, description="Max results")
) -> List[Dict[str, Any]]:
    """
    Retrieve NBA spreads odds with relevance filtering
    
    Default behavior:
    - Only returns games starting in the next 48 hours
    - Ordered by commence time (soonest first)
    """
    
    # Calculate cutoff time (only future games)
    now = datetime.utcnow()
    max_time = now + timedelta(hours=hours_ahead)
    
    # SIMPLE QUERY - only filter by time in database
    query = db.collection('odds')
    query = query.where(filter=firestore.FieldFilter('commence_time', '>', now))
    query = query.where(filter=firestore.FieldFilter('commence_time', '<=', max_time))
    query = query.order_by('commence_time', direction=firestore.Query.ASCENDING)
    query = query.limit(limit * 5)  # Fetch extra to account for Python filtering
    
    try:
        docs = list(query.stream())
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Query failed. You may need to create a Firestore index. Error: {str(e)}"
        )
    
    # Filter results in Python (not in database)
    results = []
    for doc in docs:
        data = doc.to_dict()
        
        # Apply bookmaker filter (in Python)
        if bookmaker and data.get('bookmaker') != bookmaker:
            continue
        
        # Apply team filter (in Python)
        if team and data.get('team') != team:
            continue
        
        # Apply EV filter (in Python)
        if min_ev is not None:
            if data.get('ev_percentage') is None or data.get('ev_percentage') < min_ev:
                continue
        
        # Add document ID
        data['id'] = doc.id
        
        # Convert Firestore timestamps to ISO strings
        for field in ['commence_time', 'last_update', 'ingested_at']:
            if field in data and data[field] is not None:
                val = data[field]
                if hasattr(val, 'isoformat'):
                    data[field] = val.isoformat()
                elif hasattr(val, 'timestamp'):
                    data[field] = datetime.fromtimestamp(val.timestamp()).isoformat()
        
        results.append(data)
        
        # Stop when we hit the limit
        if len(results) >= limit:
            break
    
    return results

@app.get("/api/games")
async def get_upcoming_games(
    hours_ahead: int = Query(48, ge=1, le=168, description="Games starting within X hours")
) -> List[Dict[str, Any]]:
    """
    Get list of upcoming games (deduplicated)
    Returns one entry per game with all bookmaker odds grouped
    """
    now = datetime.utcnow()
    max_time = now + timedelta(hours=hours_ahead)
    
    query = db.collection('odds')
    query = query.where(filter=firestore.FieldFilter('commence_time', '>', now))
    query = query.where(filter=firestore.FieldFilter('commence_time', '<=', max_time))
    query = query.order_by('commence_time', direction=firestore.Query.ASCENDING)
    query = query.limit(500)
    
    docs = query.stream()
    
    # Group by game_id
    games_dict = {}
    for doc in docs:
        data = doc.to_dict()
        game_id = data['game_id']
        
        if game_id not in games_dict:
            # Convert timestamp
            commence_time = data['commence_time']
            if hasattr(commence_time, 'isoformat'):
                commence_time = commence_time.isoformat()
            elif hasattr(commence_time, 'timestamp'):
                commence_time = datetime.fromtimestamp(commence_time.timestamp()).isoformat()
            
            games_dict[game_id] = {
                'game_id': game_id,
                'home_team': data['home_team'],
                'away_team': data['away_team'],
                'commence_time': commence_time,
                'bookmakers': {}
            }
        
        # Add bookmaker odds
        bookmaker = data['bookmaker']
        if bookmaker not in games_dict[game_id]['bookmakers']:
            games_dict[game_id]['bookmakers'][bookmaker] = []
        
        games_dict[game_id]['bookmakers'][bookmaker].append({
            'team': data['team'],
            'point_spread': data['point_spread'],
            'odds': data['odds']
        })
    
    return list(games_dict.values())

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}