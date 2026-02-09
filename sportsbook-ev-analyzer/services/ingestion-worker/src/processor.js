import admin from 'firebase-admin';
import { getFirestore } from './firebase.js';
import { calculateMarketAveragesForAllGames } from './marketAnalyzer.js';
import { calculateEV, americanToImpliedProbability } from './evCalculator.js';

/**
 * Normalize odds data and calculate EV before storing to Firestore
 * 
 * Process:
 * 1. Calculate market averages across all bookmakers
 * 2. For each bookmaker, calculate EV vs market
 * 3. Store normalized data with EV fields
 */
export async function normalizeAndStore(oddsData) {
  const db = getFirestore();
  const batch = db.batch();
  let count = 0;

  console.log('📊 Calculating market averages...');
  
  // STEP 1: Calculate market averages for all games
  const marketAverages = calculateMarketAveragesForAllGames(oddsData);
  
  console.log(`✅ Analyzed ${Object.keys(marketAverages).length} games`);

  // STEP 2: Process each game and calculate EV
  for (const game of oddsData) {
    const gameId = game.id;
    const commenceTime = new Date(game.commence_time);
    const gameMarket = marketAverages[gameId];

    // Skip if we couldn't calculate market average for this game
    if (!gameMarket) {
      console.warn(`⚠️  No market data for game ${gameId}, skipping EV calculation`);
    }

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

        // Calculate EV if we have market data
        let evPercentage = null;
        let isPositiveEV = false;

        if (gameMarket && gameMarket[outcome.name]) {
          const marketProbability = gameMarket[outcome.name].probability;
          const bookmakerOdds = outcome.price;

          // Calculate EV
          evPercentage = calculateEV(bookmakerOdds, marketProbability);
          isPositiveEV = evPercentage > 0;

          // Log significant +EV finds
          if (evPercentage > 2) {
            console.log(`🎯 +EV Found: ${outcome.name} @ ${bookmaker.key} | Spread: ${outcome.point} | Odds: ${bookmakerOdds} | EV: ${evPercentage.toFixed(2)}%`);
          }
        }

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

          // EV Calculation (NEW)
          ev_percentage: evPercentage,
          is_positive_ev: isPositiveEV,
          market_probability: gameMarket?.[outcome.name]?.probability || null,
          bookmaker_implied_probability: americanToImpliedProbability(outcome.price),

          // Metadata
          last_update: admin.firestore.FieldValue.serverTimestamp(),
          ingested_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        batch.set(docRef, normalized, { merge: true });
        count++;
      }
    }
  }

  await batch.commit();
  return count;
}

/**
 * Get EV summary statistics for logging
 * 
 * @param {Array} oddsData - Raw odds data
 * @returns {Object} Summary stats
 */
export function getEVSummary(oddsData) {
  const marketAverages = calculateMarketAveragesForAllGames(oddsData);
  let totalBets = 0;
  let positiveEVCount = 0;
  let bestEV = 0;

  for (const game of oddsData) {
    const gameId = game.id;
    const gameMarket = marketAverages[gameId];
    if (!gameMarket) continue;

    for (const bookmaker of game.bookmakers) {
      const spreadsMarket = bookmaker.markets.find(m => m.key === 'spreads');
      if (!spreadsMarket) continue;

      for (const outcome of spreadsMarket.outcomes) {
        totalBets++;

        if (gameMarket[outcome.name]) {
          const marketProb = gameMarket[outcome.name].probability;
          const ev = calculateEV(outcome.price, marketProb);

          if (ev > 0) {
            positiveEVCount++;
            bestEV = Math.max(bestEV, ev);
          }
        }
      }
    }
  }

  return {
    totalBets,
    positiveEVCount,
    positiveEVPercentage: totalBets > 0 ? (positiveEVCount / totalBets * 100) : 0,
    bestEV
  };
}