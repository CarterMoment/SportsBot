import admin from 'firebase-admin';
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
