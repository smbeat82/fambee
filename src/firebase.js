import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCAIDzNe_7TxZysgHAA-_HXi_wJ1NK0wsA",
  authDomain: "fambee-ba9e6.firebaseapp.com",
  projectId: "fambee-ba9e6",
  storageBucket: "fambee-ba9e6.firebasestorage.app",
  messagingSenderId: "192098105782",
  appId: "1:192098105782:web:949c04f890c2c9f74de917",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
