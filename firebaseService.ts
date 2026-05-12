import {
    collection,
    doc,
    setDoc,
    getDoc,
    onSnapshot,
    updateDoc
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { AppData, Experiment, Task } from './types';

// Collection References
const USERS_COLLECTION = 'users';

export const saveUserData = async (userId: string, data: AppData) => {
    try {
        const userRef = doc(db, USERS_COLLECTION, userId);
        await setDoc(userRef, data, { merge: true });
    } catch (error) {
        console.error("Error saving user data:", error);
        throw error;
    }
};

export const loadUserData = async (userId: string): Promise<AppData | null> => {
    try {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            return docSnap.data() as AppData;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error loading user data:", error);
        throw error;
    }
};

export const subscribeToUserData = (userId: string, callback: (data: AppData) => void) => {
    const userRef = doc(db, USERS_COLLECTION, userId);
    return onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
            callback(doc.data() as AppData);
        }
    });
};

export const checkIfWhitelisted = async (email: string): Promise<boolean> => {
    if (!email) return false;

    // Auto-whitelist the owner
    if (email.toLowerCase() === 'ohad126@gmail.com') return true;
    try {
        const whitelistRef = doc(db, 'whitelisted_users', email.toLowerCase());
        const docSnap = await getDoc(whitelistRef);
        // Check if document exists and optionally if 'enabled' is true (default logic: existence is enough or check enabled)
        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.enabled === true;
        }
        return false;
    } catch (error) {
        console.error("Error checking whitelist for:", email, error);
        return false;
    }
};

export interface WhitelistedUser {
    email: string;
    enabled: boolean;
}

export const getWhitelistedUsers = async (): Promise<WhitelistedUser[]> => {
    try {
        const { getDocs, collection } = await import('firebase/firestore');
        const querySnapshot = await getDocs(collection(db, 'whitelisted_users'));
        const users: WhitelistedUser[] = [];
        querySnapshot.forEach((doc) => {
            users.push({ email: doc.id, enabled: doc.data().enabled });
        });
        return users;
    } catch (error) {
        console.error("Error getting whitelisted users:", error);
        return [];
    }
};

export const addWhitelistedUser = async (email: string): Promise<void> => {
    try {
        const whitelistRef = doc(db, 'whitelisted_users', email.toLowerCase());
        await setDoc(whitelistRef, { enabled: true });
    } catch (error) {
        console.error("Error adding whitelisted user:", error);
        throw error;
    }
};

export const removeWhitelistedUser = async (email: string): Promise<void> => {
    try {
        const { deleteDoc } = await import('firebase/firestore');
        const whitelistRef = doc(db, 'whitelisted_users', email.toLowerCase());
        await deleteDoc(whitelistRef);
    } catch (error) {
        console.error("Error removing whitelisted user:", error);
        throw error;
    }
};

export const toggleWhitelistedUser = async (email: string, enabled: boolean): Promise<void> => {
    try {
        const whitelistRef = doc(db, 'whitelisted_users', email.toLowerCase());
        await updateDoc(whitelistRef, { enabled });
    } catch (error) {
        console.error("Error toggling whitelisted user:", error);
        throw error;
    }
};
