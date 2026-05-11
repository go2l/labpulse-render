import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCvjn8YwirU-KpkJpLfomyypu1UCsAeZwY",
    authDomain: "labpulse-ohad-app.firebaseapp.com",
    projectId: "labpulse-ohad-app",
    storageBucket: "labpulse-ohad-app.firebasestorage.app",
    messagingSenderId: "86812606140",
    appId: "1:86812606140:web:1199194408be9e4bdb9ab9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addWhitelist() {
    try {
        await setDoc(doc(db, "whitelisted_users", "ohad126@gmail.com"), {
            enabled: true,
            role: "Admin"
        });
        console.log("Successfully added ohad126@gmail.com to whitelist");
        process.exit(0);
    } catch (e) {
        console.error("Error adding to whitelist", e);
        process.exit(1);
    }
}

addWhitelist();
