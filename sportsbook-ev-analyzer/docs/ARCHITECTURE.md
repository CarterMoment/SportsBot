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
