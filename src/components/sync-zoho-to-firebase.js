// server/sync-zoho-to-firebase.js
import admin from 'firebase-admin';
import { fetchItems } from './api/zoho';  // your paginated fetchItems()
import serviceAccount from './serviceAccountKey.json';  // download from Firebase console

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

async function syncInventory() {
  console.log('⏳ Fetching all items from Zoho…');
  const items = await fetchItems();
  console.log(`Got ${items.length} items, writing to Firestore…`);

  const batch = db.batch();
  items.forEach(item => {
    const ref = db.collection('products').doc(item.item_code);
    batch.set(
      ref,
      {
        sku: item.item_code,
        name: item.item_name,
        available_stock: item.available_stock,
        actual_available_stock: item.actual_available_stock,
        lastSynced: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
  await batch.commit();
  console.log('✅ Sync complete.');
}

syncInventory().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});