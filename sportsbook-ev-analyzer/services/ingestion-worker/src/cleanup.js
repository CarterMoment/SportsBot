import { getFirestore } from './firebase.js';
import admin from 'firebase-admin';

export async function cleanupOldOdds() {
  console.log('🧹 Cleaning up old odds...');
  
  const db = getFirestore();
  
  // Delete ANY game that has already started (commence_time is in the past)
  // Add a small buffer (3 hours) to account for games still in progress
  const cutoffTime = new Date(Date.now() - (3 * 60 * 60 * 1000));
  
  try {
    const snapshot = await db.collection('odds')
      .where('commence_time', '<', admin.firestore.Timestamp.fromDate(cutoffTime))
      .limit(500)
      .get();
    
    if (snapshot.empty) {
      console.log('✅ No old odds to clean up');
      return 0;
    }
    
    // Log what we're deleting for visibility
    const gamesToDelete = new Set();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      gamesToDelete.add(`${data.home_team} vs ${data.away_team}`);
    });
    
    console.log(`🗑️  Cleaning up ${snapshot.size} records from games:`);
    gamesToDelete.forEach(game => console.log(`   - ${game}`));
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`✅ Deleted ${snapshot.size} old odds records`);
    return snapshot.size;
    
  } catch (error) {
    console.error('❌ Cleanup error:', error.message);
    return 0;
  }
}