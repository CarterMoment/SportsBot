import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let db;

export async function initializeFirebase() {
  try {
    const serviceAccount = JSON.parse(
      readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8')
    );
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });
    
    db = admin.firestore();
    console.log('✅ Firebase initialized');
    return db;
    
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    process.exit(1);
  }
}

export function getFirestore() {
  if (!db) {
    throw new Error('Firestore not initialized. Call initializeFirebase() first.');
  }
  return db;
}
