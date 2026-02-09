/**
 * Market Analyzer
 * 
 * Analyzes betting markets across multiple bookmakers to determine
 * consensus probabilities and identify pricing inefficiencies.
 */

import { americanToImpliedProbability, removeVig } from './evCalculator.js';

/**
 * Calculate market average probability for a specific outcome
 * 
 * Strategy: Take the average of all bookmaker implied probabilities
 * after removing vig. This gives us the "true market" probability.
 * 
 * @param {Array} bookmakerOdds - Array of odds objects from different bookmakers
 * @returns {number} Market average probability (0 to 1)
 * 
 * @example
 * const odds = [
 *   { bookmaker: 'draftkings', odds: -110 },
 *   { bookmaker: 'fanduel', odds: -105 },
 *   { bookmaker: 'betmgm', odds: -115 }
 * ];
 * calculateMarketAverageProbability(odds) // Returns ~0.512
 */
export function calculateMarketAverageProbability(bookmakerOdds) {
  if (!bookmakerOdds || bookmakerOdds.length === 0) {
    return null;
  }

  // Convert all odds to implied probabilities
  const probabilities = bookmakerOdds.map(book => 
    americanToImpliedProbability(book.odds)
  );

  // Calculate average (simple mean)
  const sum = probabilities.reduce((acc, prob) => acc + prob, 0);
  return sum / probabilities.length;
}

/**
 * Calculate sharp market probability
 * 
 * Weights sharp bookmakers (Pinnacle, Circa) more heavily than softer books
 * This gives a more accurate "true" probability
 * 
 * @param {Array} bookmakerOdds - Array with bookmaker names and odds
 * @returns {number} Weighted market probability
 */
export function calculateSharpMarketProbability(bookmakerOdds) {
  if (!bookmakerOdds || bookmakerOdds.length === 0) {
    return null;
  }

  // Bookmaker weights (sharp books weighted higher)
  const bookmakerWeights = {
    'pinnacle': 3.0,      // Sharpest book
    'circa': 2.0,         // Very sharp
    'draftkings': 1.0,    // Standard weight
    'fanduel': 1.0,
    'betmgm': 1.0,
    'betrivers': 1.0,
    'williamhill_us': 0.8,
    'pointsbetus': 0.8
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const book of bookmakerOdds) {
    const weight = bookmakerWeights[book.bookmaker] || 1.0;
    const prob = americanToImpliedProbability(book.odds);
    
    weightedSum += prob * weight;
    totalWeight += weight;
  }

  return weightedSum / totalWeight;
}

/**
 * Analyze spread market for a single game
 * 
 * Groups odds by team and calculates market average for each side
 * 
 * @param {Array} spreadOdds - All spread odds for a game from all bookmakers
 * @returns {Object} Market analysis with probabilities for each team
 * 
 * @example
 * const odds = [
 *   { team: 'Lakers', point_spread: -5.5, odds: -110, bookmaker: 'draftkings' },
 *   { team: 'Lakers', point_spread: -5.5, odds: -108, bookmaker: 'fanduel' },
 *   { team: 'Celtics', point_spread: 5.5, odds: -110, bookmaker: 'draftkings' },
 * ];
 * analyzeSpreadMarket(odds)
 * // Returns: {
 * //   'Lakers': { probability: 0.517, spread: -5.5, count: 2 },
 * //   'Celtics': { probability: 0.524, spread: 5.5, count: 1 }
 * // }
 */
export function analyzeSpreadMarket(spreadOdds) {
  if (!spreadOdds || spreadOdds.length === 0) {
    return {};
  }

  // Group by team
  const teamGroups = {};
  
  for (const odd of spreadOdds) {
    if (!teamGroups[odd.team]) {
      teamGroups[odd.team] = [];
    }
    teamGroups[odd.team].push({
      bookmaker: odd.bookmaker,
      odds: odd.odds,
      spread: odd.point_spread
    });
  }

  // Calculate market average for each team
  const analysis = {};
  
  for (const [team, odds] of Object.entries(teamGroups)) {
    analysis[team] = {
      probability: calculateMarketAverageProbability(odds),
      spread: odds[0].spread, // Should be consistent across books
      count: odds.length
    };
  }

  return analysis;
}

/**
 * Find market inefficiencies (outlier odds)
 * 
 * Identifies bookmakers offering odds significantly different from market average
 * These are potential +EV opportunities
 * 
 * @param {Array} spreadOdds - All spread odds for a game
 * @param {number} threshold - Minimum probability difference to flag (default 0.02 = 2%)
 * @returns {Array} Outlier bets with potential value
 */
export function findMarketInefficiencies(spreadOdds, threshold = 0.02) {
  const marketAnalysis = analyzeSpreadMarket(spreadOdds);
  const inefficiencies = [];

  for (const odd of spreadOdds) {
    const teamMarket = marketAnalysis[odd.team];
    if (!teamMarket) continue;

    const bookProb = americanToImpliedProbability(odd.odds);
    const marketProb = teamMarket.probability;
    const difference = marketProb - bookProb;

    // If bookmaker's implied prob is lower than market (they're offering better odds)
    if (difference >= threshold) {
      inefficiencies.push({
        ...odd,
        marketProbability: marketProb,
        bookmakerProbability: bookProb,
        edgePercentage: difference * 100
      });
    }
  }

  // Sort by edge (highest first)
  return inefficiencies.sort((a, b) => b.edgePercentage - a.edgePercentage);
}

/**
 * Calculate consensus spread
 * 
 * Finds the most common spread across bookmakers
 * Useful for identifying when one book has a different line
 * 
 * @param {Array} spreadOdds - Spread odds from multiple bookmakers
 * @returns {number} Most common spread value
 */
export function calculateConsensusSpread(spreadOdds) {
  if (!spreadOdds || spreadOdds.length === 0) {
    return null;
  }

  // Count frequency of each spread
  const spreadCounts = {};
  
  for (const odd of spreadOdds) {
    const spread = odd.point_spread;
    spreadCounts[spread] = (spreadCounts[spread] || 0) + 1;
  }

  // Find most common
  let maxCount = 0;
  let consensusSpread = null;

  for (const [spread, count] of Object.entries(spreadCounts)) {
    if (count > maxCount) {
      maxCount = count;
      consensusSpread = parseFloat(spread);
    }
  }

  return consensusSpread;
}

/**
 * Calculate market efficiency score
 * 
 * Measures how tight the market is (low variance = efficient market)
 * 
 * @param {Array} bookmakerOdds - Odds from multiple bookmakers
 * @returns {number} Efficiency score (0-100, higher = more efficient)
 */
export function calculateMarketEfficiency(bookmakerOdds) {
  if (!bookmakerOdds || bookmakerOdds.length < 2) {
    return null;
  }

  const probabilities = bookmakerOdds.map(book => 
    americanToImpliedProbability(book.odds)
  );

  // Calculate standard deviation
  const mean = probabilities.reduce((sum, p) => sum + p, 0) / probabilities.length;
  const variance = probabilities.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / probabilities.length;
  const stdDev = Math.sqrt(variance);

  // Convert to efficiency score (lower std dev = higher efficiency)
  // Scale so 0.01 std dev = 90+ efficiency, 0.05 std dev = ~50 efficiency
  const efficiency = Math.max(0, 100 - (stdDev * 1000));

  return Math.min(100, efficiency);
}

/**
 * Get best available odds for an outcome
 * 
 * @param {Array} bookmakerOdds - Odds from multiple bookmakers
 * @param {string} side - 'favorite' or 'underdog'
 * @returns {Object} Best odds with bookmaker info
 */
export function getBestOdds(bookmakerOdds, side = 'favorite') {
  if (!bookmakerOdds || bookmakerOdds.length === 0) {
    return null;
  }

  let best = bookmakerOdds[0];

  for (const book of bookmakerOdds) {
    if (side === 'favorite') {
      // For favorites (negative odds), closer to 0 is better
      // -105 is better than -110
      if (book.odds > best.odds) {
        best = book;
      }
    } else {
      // For underdogs (positive odds), higher is better
      // +150 is better than +140
      if (book.odds > best.odds) {
        best = book;
      }
    }
  }

  return best;
}

/**
 * Calculate market averages for all games at once
 * 
 * This is the main function used by the ingestion worker
 * 
 * @param {Array} oddsData - Raw odds data from The Odds API
 * @returns {Object} Map of game_id → market analysis
 */
export function calculateMarketAveragesForAllGames(oddsData) {
  const marketAverages = {};

  for (const game of oddsData) {
    const gameId = game.id;
    
    // Collect all spread odds for this game
    const allSpreads = [];
    
    for (const bookmaker of game.bookmakers) {
      const spreadsMarket = bookmaker.markets?.find(m => m.key === 'spreads');
      if (!spreadsMarket) continue;

      for (const outcome of spreadsMarket.outcomes) {
        allSpreads.push({
          team: outcome.name,
          point_spread: outcome.point,
          odds: outcome.price,
          bookmaker: bookmaker.key
        });
      }
    }

    // Analyze the market
    if (allSpreads.length > 0) {
      marketAverages[gameId] = analyzeSpreadMarket(allSpreads);
    }
  }

  return marketAverages;
}