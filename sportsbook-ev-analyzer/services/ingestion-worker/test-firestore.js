import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccount = JSON.parse(
  readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Test write
const testDoc = {
  test: true,
  timestamp: new Date().toISOString()
};

db.collection('_test').doc('connection-test').set(testDoc)
  .then(() => {
    console.log('✅ Firestore write successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Firestore write failed:', error);
    process.exit(1);
  });