import dotenv from 'dotenv';
import { initializeFirebase } from './firebase.js';
import { fetchNBAOdds } from './oddsApi.js';
import { normalizeAndStore } from './processor.js';
import { cleanupOldOdds } from './cleanup.js';

dotenv.config();

const INGESTION_INTERVAL = (parseInt(process.env.INGESTION_INTERVAL_MINUTES) || 10) * 60 * 1000;
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

async function runIngestion() {
  console.log('🏀 Starting NBA odds ingestion...');
  
  try {
    const oddsData = await fetchNBAOdds();
    console.log(`✅ Fetched ${oddsData.length} NBA games`);
    
    const stored = await normalizeAndStore(oddsData);
    console.log(`💾 Stored ${stored} odds records to Firestore`);
    
  } catch (error) {
    console.error('❌ Ingestion error:', error.message);
  }
}

async function main() {
  console.log('🚀 Initializing Sportsbook EV Analyzer - Ingestion Worker');
  console.log(`⏰ Ingestion interval: ${process.env.INGESTION_INTERVAL_MINUTES || 10} minutes`);
  console.log(`🧹 Cleanup interval: 24 hours`);
  
  // Initialize Firebase
  await initializeFirebase();
  
  // Run immediate ingestion
  await runIngestion();
  
  // Run immediate cleanup
  await cleanupOldOdds();
  
  // Schedule recurring ingestion
  setInterval(runIngestion, INGESTION_INTERVAL);
  console.log(`✅ Ingestion scheduled every ${process.env.INGESTION_INTERVAL_MINUTES || 10} minutes`);
  
  // Schedule daily cleanup (runs every 24 hours)
  setInterval(cleanupOldOdds, CLEANUP_INTERVAL);
  console.log('✅ Cleanup scheduled every 24 hours');
}

main().catch(console.error);