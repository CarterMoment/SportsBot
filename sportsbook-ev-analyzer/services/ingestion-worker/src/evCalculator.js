/**
 * EV Calculator
 * 
 * Converts American odds to probabilities and calculates Expected Value (EV)
 * for sports betting markets.
 */

/**
 * Convert American odds to implied probability
 * 
 * American odds format:
 * - Negative (e.g., -110): Favorite, you risk this amount to win $100
 * - Positive (e.g., +150): Underdog, you win this amount on a $100 bet
 * 
 * @param {number} americanOdds - American format odds (e.g., -110, +150)
 * @returns {number} Implied probability (0 to 1)
 * 
 * @example
 * americanToImpliedProbability(-110) // Returns 0.5238 (52.38%)
 * americanToImpliedProbability(+150) // Returns 0.4 (40%)
 */
export function americanToImpliedProbability(americanOdds) {
  if (americanOdds < 0) {
    // Favorite: probability = |odds| / (|odds| + 100)
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  } else {
    // Underdog: probability = 100 / (odds + 100)
    return 100 / (americanOdds + 100);
  }
}

/**
 * Convert American odds to decimal odds
 * Useful for EV calculations
 * 
 * @param {number} americanOdds - American format odds
 * @returns {number} Decimal odds (e.g., 1.91, 2.50)
 * 
 * @example
 * americanToDecimal(-110) // Returns 1.909
 * americanToDecimal(+150) // Returns 2.50
 */
export function americanToDecimal(americanOdds) {
  if (americanOdds < 0) {
    return (100 / Math.abs(americanOdds)) + 1;
  } else {
    return (americanOdds / 100) + 1;
  }
}

/**
 * Calculate Expected Value (EV) percentage
 * 
 * EV Formula: EV = (True Probability × Decimal Odds) - 1
 * 
 * Positive EV means the bet has value (bookmaker's odds are better than fair market)
 * Negative EV means the bet has no value (bookmaker's odds are worse than fair market)
 * 
 * @param {number} bookmakerOdds - Bookmaker's American odds
 * @param {number} trueProbability - Market's true probability (0 to 1)
 * @returns {number} EV as a percentage (-100 to +infinity)
 * 
 * @example
 * // Bookmaker offers -110, but fair odds should be -105 (you have edge)
 * calculateEV(-110, 0.50) // Returns ~4.5% (positive EV)
 * 
 * // Bookmaker offers -110, but fair odds should be -115 (no edge)
 * calculateEV(-110, 0.54) // Returns ~-3% (negative EV)
 */
export function calculateEV(bookmakerOdds, trueProbability) {
  const decimalOdds = americanToDecimal(bookmakerOdds);
  const ev = (trueProbability * decimalOdds) - 1;
  return ev * 100; // Convert to percentage
}

/**
 * Calculate EV for a spread bet specifically
 * Takes into account the point spread and market average
 * 
 * @param {number} bookmakerOdds - Bookmaker's odds for the spread
 * @param {number} pointSpread - The spread (e.g., -5.5)
 * @param {number} marketAverageProbability - Market consensus probability
 * @returns {number} EV percentage
 */
export function calculateSpreadEV(bookmakerOdds, pointSpread, marketAverageProbability) {
  // For spreads, we use the market average probability directly
  // The point spread itself is already factored into the odds
  return calculateEV(bookmakerOdds, marketAverageProbability);
}

/**
 * Remove vig (bookmaker margin) from implied probabilities
 * 
 * When you add up both sides of a bet, the total is usually > 100%
 * This "overround" is the bookmaker's margin (vig/juice)
 * 
 * @param {number} prob1 - First side implied probability
 * @param {number} prob2 - Second side implied probability
 * @returns {Object} De-vigged probabilities that sum to 1.0
 * 
 * @example
 * removeVig(0.5238, 0.5238) // Both sides -110
 * // Returns { prob1: 0.50, prob2: 0.50 } (true 50/50)
 */
export function removeVig(prob1, prob2) {
  const total = prob1 + prob2;
  return {
    prob1: prob1 / total,
    prob2: prob2 / total
  };
}

/**
 * Calculate Kelly Criterion bet size
 * 
 * Kelly Formula: f = (bp - q) / b
 * where:
 *   f = fraction of bankroll to bet
 *   b = decimal odds - 1
 *   p = true probability of winning
 *   q = probability of losing (1 - p)
 * 
 * @param {number} trueProbability - Your estimated probability of winning
 * @param {number} decimalOdds - Bookmaker's decimal odds
 * @returns {number} Fraction of bankroll to bet (0 to 1)
 * 
 * @example
 * // You think true prob is 55%, bookmaker offers 1.91 (implies 52.4%)
 * calculateKellyCriterion(0.55, 1.91) // Returns ~0.03 (bet 3% of bankroll)
 */
export function calculateKellyCriterion(trueProbability, decimalOdds) {
  const b = decimalOdds - 1;
  const p = trueProbability;
  const q = 1 - p;
  
  const kelly = (b * p - q) / b;
  
  // Never bet if Kelly is negative (no edge)
  return Math.max(0, kelly);
}

/**
 * Calculate potential profit for a bet
 * 
 * @param {number} stake - Amount wagered
 * @param {number} americanOdds - American format odds
 * @returns {number} Profit (not including stake returned)
 * 
 * @example
 * calculateProfit(100, -110) // Returns 90.91
 * calculateProfit(100, +150) // Returns 150
 */
export function calculateProfit(stake, americanOdds) {
  if (americanOdds < 0) {
    return stake * (100 / Math.abs(americanOdds));
  } else {
    return stake * (americanOdds / 100);
  }
}

/**
 * Check if a bet has positive EV
 * 
 * @param {number} evPercentage - EV as percentage
 * @param {number} threshold - Minimum EV to consider (default 2%)
 * @returns {boolean} True if bet has sufficient positive EV
 */
export function isPositiveEV(evPercentage, threshold = 2) {
  return evPercentage >= threshold;
}

/**
 * Get EV rating (for UI display)
 * 
 * @param {number} evPercentage - EV as percentage
 * @returns {string} Rating: 'excellent', 'good', 'fair', 'poor'
 */
export function getEVRating(evPercentage) {
  if (evPercentage >= 10) return 'excellent';
  if (evPercentage >= 5) return 'good';
  if (evPercentage >= 2) return 'fair';
  return 'poor';
}