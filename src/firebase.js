import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCbSgCc4lPesPRfPm5h4watKeE98f_8aiw",
  authDomain: "mi-alquiler-9c64b.firebaseapp.com",
  projectId: "mi-alquiler-9c64b",
  storageBucket: "mi-alquiler-9c64b.firebasestorage.app",
  messagingSenderId: "126094627090",
  appId: "1:126094627090:web:9a3b88c0bedbc9c1c7a3cb"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Secondary app/auth for tenant account creation so owner session is not affected
const tenantApp = initializeApp(firebaseConfig, "tenantApp");
export const tenantAuth = getAuth(tenantApp);