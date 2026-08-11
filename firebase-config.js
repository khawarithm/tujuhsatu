// js/firebase-config.js
// Konfigurasi Firebase — diambil langsung dari firebase.txt yang diberikan.
// Jangan mengubah nilai-nilai ini kecuali project Firebase diganti.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  get,
  set,
  push,
  update,
  remove,
  child,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDXGZXwtRncGLoevDcJkrHAL7CNDZGAO-4",
  authDomain: "spaceshipx1-87e9b.firebaseapp.com",
  databaseURL:
    "https://spaceshipx1-87e9b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "spaceshipx1-87e9b",
  storageBucket: "spaceshipx1-87e9b.firebasestorage.app",
  messagingSenderId: "943759467178",
  appId: "1:943759467178:web:649ee21c2739a114ef66d3",
  measurementId: "G-MLFN0Y3DT5",
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

export {
  ref,
  onValue,
  get,
  set,
  push,
  update,
  remove,
  child,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
};
