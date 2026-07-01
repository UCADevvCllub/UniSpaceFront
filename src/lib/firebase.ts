import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "dummy-key",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy-auth",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dummy-project",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy-storage",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "dummy-sender",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "dummy-app",
};

// Initialize Firebase app if it hasn't been initialized already
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Only export the firestore database
export const db = getFirestore(app);
