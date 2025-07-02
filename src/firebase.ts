// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

// ✅ Your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyAiEWug483-fiM0kI68EiYYYdbfgssC5C0",
  authDomain: "splitfin-609c9.firebaseapp.com",
  projectId: "splitfin-609c9",
  storageBucket: "splitfin-609c9.firebasestorage.app",
  messagingSenderId: "435717447836",
  appId: "1:435717447836:web:3005216a01d6bf85220d59",
  measurementId: "G-Y3KY63QS1Q"
};

// ✅ Initialize core Firebase services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth    = getAuth(app)
setPersistence(auth, browserLocalPersistence).catch(console.error);


// ✅ Optional: only initialize Analytics if the browser supports it
let analytics: ReturnType<typeof getAnalytics> | null = null;
isSupported().then((yes) => {
  if (yes) analytics = getAnalytics(app);
});

export { app, db, storage, analytics, auth };
