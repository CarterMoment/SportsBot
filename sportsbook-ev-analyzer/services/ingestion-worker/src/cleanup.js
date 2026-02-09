import { getFirestore } from './firebase.js';
import admin from 'firebase-admin';

export async function cleanupOldOdds() {
  console.log('🧹 Cleaning up old odds...');
  
  const db = getFirestore();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const snapshot = await db.collection('odds')
    .where('commence_time', '<', admin.firestore.Timestamp.fromDate(oneDayAgo))
    .limit(500)
    .get();
  
  if (snapshot.empty) {
    console.log('✅ No old odds to clean up');
    return 0;
  }
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`🗑️  Deleted ${snapshot.size} old odds records`);
  return snapshot.size;
}