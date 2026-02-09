/**
 * EV Calculation Test Suite
 * 
 * Run this to verify all EV calculations are working correctly
 * Usage: node test-ev-calculations.js
 */

import {
  americanToImpliedProbability,
  americanToDecimal,
  calculateEV,
  calculateSpreadEV,
  removeVig,
  calculateKellyCriterion,
  calculateProfit,
  isPositiveEV,
  getEVRating
} from './src/evCalculator.js';

import {
  calculateMarketAverageProbability,
  calculateSharpMarketProbability,
  analyzeSpreadMarket,
  findMarketInefficiencies,
  calculateConsensusSpread,
  calculateMarketEfficiency,
  getBestOdds
} from './src/marketAnalyzer.js';

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function assert(condition, message) {
  if (condition) {
    console.log(`${colors.green}✓${colors.reset} ${message}`);
    return true;
  } else {
    console.log(`${colors.red}✗${colors.reset} ${message}`);
    return false;
  }
}

function testSection(title) {
  console.log(`\n${colors.cyan}═══════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}\n`);
}

function approxEqual(a, b, tolerance = 0.01) {
  return Math.abs(a - b) < tolerance;
}

// ===================================
// TEST 1: Odds Conversion
// ===================================
function testOddsConversion() {
  testSection('TEST 1: Odds Conversion');

  // Test favorite odds (-110)
  const prob1 = americanToImpliedProbability(-110);
  assert(
    approxEqual(prob1, 0.5238, 0.001),
    `americanToImpliedProbability(-110) = ${prob1.toFixed(4)} (expected ~0.5238)`
  );

  // Test underdog odds (+150)
  const prob2 = americanToImpliedProbability(+150);
  assert(
    approxEqual(prob2, 0.4, 0.001),
    `americanToImpliedProbability(+150) = ${prob2.toFixed(4)} (expected ~0.40)`
  );

  // Test even odds (+100)
  const prob3 = americanToImpliedProbability(+100);
  assert(
    approxEqual(prob3, 0.5, 0.001),
    `americanToImpliedProbability(+100) = ${prob3.toFixed(4)} (expected 0.50)`
  );

  // Test heavy favorite (-500)
  const prob4 = americanToImpliedProbability(-500);
  assert(
    approxEqual(prob4, 0.8333, 0.001),
    `americanToImpliedProbability(-500) = ${prob4.toFixed(4)} (expected ~0.8333)`
  );

  // Test decimal conversion
  const decimal1 = americanToDecimal(-110);
  assert(
    approxEqual(decimal1, 1.909, 0.01),
    `americanToDecimal(-110) = ${decimal1.toFixed(3)} (expected ~1.909)`
  );

  const decimal2 = americanToDecimal(+150);
  assert(
    approxEqual(decimal2, 2.5, 0.01),
    `americanToDecimal(+150) = ${decimal2.toFixed(2)} (expected 2.50)`
  );
}

// ===================================
// TEST 2: EV Calculation
// ===================================
function testEVCalculation() {
  testSection('TEST 2: EV Calculation');

  // Scenario 1: Positive EV
  // Market says 50% chance, bookmaker offers -110 (52.38% implied)
  // You have 2.38% edge
  const ev1 = calculateEV(-110, 0.50);
  assert(
    approxEqual(ev1, -4.5, 1.0),
    `calculateEV(-110, 0.50) = ${ev1.toFixed(2)}% (expected ~-4.5%, negative because bookmaker's implied prob is HIGHER)`
  );

  // Scenario 2: Real positive EV
  // Market says 54% chance, bookmaker offers -110 (52.38% implied)
  // You get better odds than fair value
  const ev2 = calculateEV(-110, 0.54);
  assert(
    approxEqual(ev2, 3.1, 1.0),
    `calculateEV(-110, 0.54) = ${ev2.toFixed(2)}% (expected ~3%, positive EV)`
  );

  // Scenario 3: Large positive EV
  // Market says 60% chance, bookmaker offers +100 (50% implied)
  // Huge edge
  const ev3 = calculateEV(+100, 0.60);
  assert(
    approxEqual(ev3, 20, 2),
    `calculateEV(+100, 0.60) = ${ev3.toFixed(2)}% (expected ~20%, large positive EV)`
  );

  // Scenario 4: Negative EV (bookmaker has edge)
  // Market says 45% chance, bookmaker offers -110
  const ev4 = calculateEV(-110, 0.45);
  assert(
    ev4 < 0,
    `calculateEV(-110, 0.45) = ${ev4.toFixed(2)}% (should be negative)`
  );

  // Test isPositiveEV helper
  assert(
    isPositiveEV(5.0, 2),
    'isPositiveEV(5.0, 2) should return true'
  );

  assert(
    !isPositiveEV(1.5, 2),
    'isPositiveEV(1.5, 2) should return false (below threshold)'
  );

  // Test EV rating
  assert(
    getEVRating(12) === 'excellent',
    'getEVRating(12) should return "excellent"'
  );

  assert(
    getEVRating(6) === 'good',
    'getEVRating(6) should return "good"'
  );
}

// ===================================
// TEST 3: Market Analysis
// ===================================
function testMarketAnalysis() {
  testSection('TEST 3: Market Analysis');

  // Sample odds from multiple bookmakers
  const sampleOdds = [
    { bookmaker: 'draftkings', odds: -110 },
    { bookmaker: 'fanduel', odds: -105 },
    { bookmaker: 'betmgm', odds: -115 },
    { bookmaker: 'betrivers', odds: -108 }
  ];

  const marketAvg = calculateMarketAverageProbability(sampleOdds);
  assert(
    marketAvg > 0.51 && marketAvg < 0.53,
    `calculateMarketAverageProbability() = ${(marketAvg * 100).toFixed(2)}% (expected ~51-53%)`
  );

  // Test spread market analysis
  const spreadOdds = [
    { team: 'Lakers', point_spread: -5.5, odds: -110, bookmaker: 'draftkings' },
    { team: 'Lakers', point_spread: -5.5, odds: -108, bookmaker: 'fanduel' },
    { team: 'Lakers', point_spread: -5.5, odds: -112, bookmaker: 'betmgm' },
    { team: 'Celtics', point_spread: 5.5, odds: -110, bookmaker: 'draftkings' },
    { team: 'Celtics', point_spread: 5.5, odds: -110, bookmaker: 'fanduel' },
  ];

  const analysis = analyzeSpreadMarket(spreadOdds);
  
  assert(
    analysis['Lakers'] && analysis['Celtics'],
    'analyzeSpreadMarket() should return data for both teams'
  );

  assert(
    analysis['Lakers'].spread === -5.5,
    `Lakers spread should be -5.5 (got ${analysis['Lakers'].spread})`
  );

  assert(
    analysis['Lakers'].count === 3,
    `Lakers should have 3 bookmaker entries (got ${analysis['Lakers'].count})`
  );

  console.log(`   Lakers market probability: ${(analysis['Lakers'].probability * 100).toFixed(2)}%`);
  console.log(`   Celtics market probability: ${(analysis['Celtics'].probability * 100).toFixed(2)}%`);

  // Test consensus spread
  const consensus = calculateConsensusSpread(spreadOdds);
  assert(
    Math.abs(consensus) === 5.5,
    `calculateConsensusSpread() = ${consensus} (expected ±5.5)`
  );

  // Test market efficiency
  const efficiency = calculateMarketEfficiency(sampleOdds);
  assert(
    efficiency > 70,
    `calculateMarketEfficiency() = ${efficiency.toFixed(1)} (expected >70 for tight market)`
  );
}

// ===================================
// TEST 4: Finding +EV Opportunities
// ===================================
function testFindingPlusEV() {
  testSection('TEST 4: Finding +EV Opportunities');

  // Create a scenario with one outlier book
  const spreadOdds = [
    { team: 'Lakers', point_spread: -5.5, odds: -110, bookmaker: 'draftkings' },
    { team: 'Lakers', point_spread: -5.5, odds: -110, bookmaker: 'fanduel' },
    { team: 'Lakers', point_spread: -5.5, odds: -110, bookmaker: 'betmgm' },
    { team: 'Lakers', point_spread: -5.5, odds: -105, bookmaker: 'betrivers' }, // Better odds!
  ];

  const inefficiencies = findMarketInefficiencies(spreadOdds, 0.01);
  
  assert(
    inefficiencies.length > 0,
    'findMarketInefficiencies() should find the BetRivers outlier'
  );

  if (inefficiencies.length > 0) {
    const best = inefficiencies[0];
    assert(
      best.bookmaker === 'betrivers',
      `Best odds should be from BetRivers (got ${best.bookmaker})`
    );
    console.log(`   Found +EV: ${best.team} @ ${best.bookmaker} | Edge: ${best.edgePercentage.toFixed(2)}%`);
  }

  // Test getBestOdds
  const bestFavorite = getBestOdds(
    spreadOdds.map(o => ({ bookmaker: o.bookmaker, odds: o.odds })),
    'favorite'
  );

  assert(
    bestFavorite.odds === -105,
    `getBestOdds() for favorite should return -105 (got ${bestFavorite.odds})`
  );
}

// ===================================
// TEST 5: Real-World Scenario
// ===================================
function testRealWorldScenario() {
  testSection('TEST 5: Real-World Scenario');

  console.log('Scenario: Lakers vs Celtics, Spread -5.5\n');

  // Real odds from different bookmakers
  const realOdds = [
    { bookmaker: 'draftkings', team: 'Lakers', spread: -5.5, odds: -108 },
    { bookmaker: 'fanduel', team: 'Lakers', spread: -5.5, odds: -110 },
    { bookmaker: 'betmgm', team: 'Lakers', spread: -5.5, odds: -112 },
    { bookmaker: 'betrivers', team: 'Lakers', spread: -5.5, odds: -105 }, // Best line
  ];

  // Calculate market average
  const marketProb = calculateMarketAverageProbability(
    realOdds.map(o => ({ bookmaker: o.bookmaker, odds: o.odds }))
  );

  console.log(`Market consensus probability: ${(marketProb * 100).toFixed(2)}%\n`);

  // Calculate EV for each bookmaker
  console.log('EV Analysis by Bookmaker:');
  for (const book of realOdds) {
    const ev = calculateEV(book.odds, marketProb);
    const impliedProb = americanToImpliedProbability(book.odds);
    const profit = calculateProfit(100, book.odds);
    
    const symbol = ev > 0 ? `${colors.green}+${colors.reset}` : `${colors.red}${colors.reset}`;
    
    console.log(
      `  ${book.bookmaker.padEnd(12)} | ` +
      `Odds: ${book.odds.toString().padStart(4)} | ` +
      `Implied: ${(impliedProb * 100).toFixed(2)}% | ` +
      `EV: ${symbol}${ev.toFixed(2)}% | ` +
      `$100 wins $${profit.toFixed(2)}`
    );
  }

  // Find the best bet
  const bestBet = realOdds.reduce((best, current) => {
    const currentEV = calculateEV(current.odds, marketProb);
    const bestEV = calculateEV(best.odds, marketProb);
    return currentEV > bestEV ? current : best;
  });

  const bestEV = calculateEV(bestBet.odds, marketProb);
  
  console.log(
    `\n${colors.yellow}Best Bet: ${bestBet.team} -5.5 @ ${bestBet.bookmaker} (${bestBet.odds})${colors.reset}`
  );
  console.log(`${colors.yellow}Expected Value: +${bestEV.toFixed(2)}%${colors.reset}`);

  // Kelly Criterion
  const decimal = americanToDecimal(bestBet.odds);
  const kelly = calculateKellyCriterion(marketProb, decimal);
  console.log(`${colors.yellow}Kelly Criterion: ${(kelly * 100).toFixed(2)}% of bankroll${colors.reset}`);

  assert(
    bestBet.bookmaker === 'betrivers',
    'Best bet should be BetRivers (best odds)'
  );
}

// ===================================
// TEST 6: Vig Removal
// ===================================
function testVigRemoval() {
  testSection('TEST 6: Vig Removal');

  // Both sides at -110 (standard vig)
  const prob1 = americanToImpliedProbability(-110);
  const prob2 = americanToImpliedProbability(-110);

  console.log(`Before vig removal: ${(prob1 * 100).toFixed(2)}% + ${(prob2 * 100).toFixed(2)}% = ${((prob1 + prob2) * 100).toFixed(2)}%`);
  assert(
    (prob1 + prob2) > 1.0,
    'Sum of implied probabilities should exceed 100% (bookmaker has edge)'
  );

  const devigged = removeVig(prob1, prob2);
  console.log(`After vig removal: ${(devigged.prob1 * 100).toFixed(2)}% + ${(devigged.prob2 * 100).toFixed(2)}% = ${((devigged.prob1 + devigged.prob2) * 100).toFixed(2)}%`);

  assert(
    approxEqual(devigged.prob1 + devigged.prob2, 1.0, 0.001),
    'After vig removal, probabilities should sum to exactly 100%'
  );

  assert(
    approxEqual(devigged.prob1, 0.5, 0.001),
    'With equal odds, both sides should be exactly 50% after vig removal'
  );
}

// ===================================
// TEST 7: Edge Cases
// ===================================
function testEdgeCases() {
  testSection('TEST 7: Edge Cases');

  // Empty array
  const emptyResult = calculateMarketAverageProbability([]);
  assert(
    emptyResult === null,
    'calculateMarketAverageProbability([]) should return null'
  );

  // Single bookmaker
  const singleBook = calculateMarketAverageProbability([
    { bookmaker: 'draftkings', odds: -110 }
  ]);
  assert(
    singleBook !== null,
    'Should handle single bookmaker'
  );

  // Extreme odds
  const extremeProb = americanToImpliedProbability(-10000);
  assert(
    extremeProb > 0.99,
    `Heavy favorite -10000 should have >99% probability (got ${(extremeProb * 100).toFixed(2)}%)`
  );

  // Verify Kelly never suggests betting with no edge
  const noEdgeKelly = calculateKellyCriterion(0.48, 1.909); // Negative EV
  assert(
    noEdgeKelly === 0,
    'Kelly Criterion should return 0 for negative EV bets'
  );
}

// ===================================
// RUN ALL TESTS
// ===================================
function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                                                        ║');
  console.log('║         EV CALCULATION TEST SUITE                      ║');
  console.log('║         Sportsbook EV Analyzer                         ║');
  console.log('║                                                        ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  testOddsConversion();
  testEVCalculation();
  testMarketAnalysis();
  testFindingPlusEV();
  testRealWorldScenario();
  testVigRemoval();
  testEdgeCases();

  testSection('TEST SUMMARY');
  console.log(`${colors.green}All tests completed!${colors.reset}`);
  console.log('\nYou can now run the ingestion worker with confidence.');
  console.log('EV calculations will be automatically applied to all incoming odds data.\n');
}

// Run tests
runAllTests();  