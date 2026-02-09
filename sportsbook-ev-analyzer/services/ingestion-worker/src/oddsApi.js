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
