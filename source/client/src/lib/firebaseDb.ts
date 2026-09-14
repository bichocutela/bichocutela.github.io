import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

/** Firestore mínimo para a Home. Evita carregar Auth e Storage na abertura do PWA. */
const firebaseConfig = {
  apiKey: "AIzaSyA6oHEJzOH3m4j8CuMWoXlceQKSy8Viqmw",
  authDomain: "appcodigo-7f245.firebaseapp.com",
  projectId: "appcodigo-7f245",
  storageBucket: "appcodigo-7f245.firebasestorage.app",
  messagingSenderId: "146947124596",
  appId: "1:146947124596:web:87eba84ff229e14e37d021",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const nrdDb = getFirestore(app);
