import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAHBetL12-jRB21BTjkeufPYzhpeg-6K9w",
  authDomain: "neuro-ai-music.firebaseapp.com",
  projectId: "neuro-ai-music",
  storageBucket: "neuro-ai-music.firebasestorage.app",
  messagingSenderId: "472873480624",
  appId: "1:472873480624:web:53b452a2cedba4021be675",
  measurementId: "G-67DZH76F7K"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
