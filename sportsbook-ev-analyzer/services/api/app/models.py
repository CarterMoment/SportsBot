from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Any

class OddsResponse(BaseModel):
    id: str
    game_id: str
    sport: str
    home_team: str
    away_team: str
    commence_time: Any  # Accept string or datetime
    bookmaker: str
    team: str
    point_spread: float
    odds: int
    ev_percentage: Optional[float] = None
    is_positive_ev: bool
    last_update: Any  # Accept string or datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str