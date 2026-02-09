from datetime import datetime, timedelta

def is_odds_fresh(last_update: datetime, max_age_minutes: int = 30) -> bool:
    """
    Check if odds are recent enough to be actionable
    """
    if not last_update:
        return False
    
    age = datetime.utcnow() - last_update
    return age < timedelta(minutes=max_age_minutes)

def format_time_until(commence_time: datetime) -> str:
    """
    Human-readable time until game starts
    """
    delta = commence_time - datetime.utcnow()
    
    if delta.days > 0:
        return f"{delta.days}d {delta.seconds // 3600}h"
    elif delta.seconds >= 3600:
        return f"{delta.seconds // 3600}h {(delta.seconds % 3600) // 60}m"
    else:
        return f"{delta.seconds // 60}m"