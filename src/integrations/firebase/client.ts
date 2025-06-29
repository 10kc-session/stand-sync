/**
 * Initializes and exports Firebase services (Auth, Firestore, Storage) using configuration
 * from environment variables. This module sets up the Firebase app instance and provides
 * ready-to-use exports for authentication, database, and storage functionalities.
 *
 * @module firebase/client
 *
 * @remarks
 * - Uses Vite environment variables prefixed with `VITE_FIREBASE_`.
 * - Exports:
 *   - `auth`: Firebase Authentication instance.
 *   - `db`: Firestore database instance.
 *   - `storage`: Firebase Storage instance.
 */
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // <-- IMPORT FIRESTORE
import { getStorage } from "firebase/storage";

// Your Firebase configuration using environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app); // <-- INITIALIZE AND EXPORT DB
export const storage = getStorage(app); // <-- INITIALIZE AND EXPORT STORAGE