import admin from 'firebase-admin'
import fs from 'fs'

// Load service account from file
const serviceAccount = JSON.parse(
  fs.readFileSync('./server/serviceAccountKey.json', 'utf8')
);

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })
}

const db = admin.firestore()

async function migrateUserDocs() {
  const usersRef = db.collection('users')
  const snapshot = await usersRef.get()

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const currentId = doc.id
    const uid = data.uid

    if (!uid || uid === currentId) {
      console.log(`✅ Skipped: ${currentId} (no uid or already matches)`)
      continue
    }

    // Copy to new doc with UID as ID
    const newDocRef = usersRef.doc(uid)
    await newDocRef.set(data, { merge: true })

    // Delete old doc
    await doc.ref.delete()

    console.log(`🔁 Migrated ${currentId} → ${uid}`)
  }

  console.log('✅ Migration complete.')
}

migrateUserDocs().catch((err) => {
  console.error('❌ Migration failed:', err)
})