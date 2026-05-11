import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    User,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    updateProfile,
    sendEmailVerification,
    signInWithPopup
} from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { APP_STORAGE_KEY } from '../constants';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, name: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    isGuest: boolean;
    continueAsGuest: () => void;
    previousLoginTime: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGuest, setIsGuest] = useState(false);
    const [previousLoginTime, setPreviousLoginTime] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                const uid = currentUser.uid;
                const currentSignInTime = currentUser.metadata.lastSignInTime;
                const storageKeyCurrent = `auth_last_login_current:${uid}`;
                const storageKeyPrevious = `auth_last_login_previous:${uid}`;

                const storedCurrent = localStorage.getItem(storageKeyCurrent);
                const storedPrevious = localStorage.getItem(storageKeyPrevious);

                if (currentSignInTime && storedCurrent !== currentSignInTime) {
                    // New session detected
                    localStorage.setItem(storageKeyPrevious, storedCurrent || '');
                    localStorage.setItem(storageKeyCurrent, currentSignInTime);
                    setPreviousLoginTime(storedCurrent);
                } else {
                    // Same session (refresh), stick with stored previous
                    setPreviousLoginTime(storedPrevious || null);
                }
            } else {
                setPreviousLoginTime(null);
            }
            setUser(currentUser);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const signIn = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const signUp = async (email: string, password: string, name: string) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        await sendEmailVerification(userCredential.user);
    };

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    };

    const signOut = async () => {
        await firebaseSignOut(auth);
        // Clear local app data to prevent next user/guest from seeing previous data
        localStorage.removeItem(APP_STORAGE_KEY);
        setIsGuest(false);
        setPreviousLoginTime(null);
    };

    const continueAsGuest = () => {
        // Clear any authenticated user data from local storage so guest starts fresh
        localStorage.removeItem(APP_STORAGE_KEY);
        setIsGuest(true);
    };

    const value = {
        user,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        isGuest,
        continueAsGuest,
        previousLoginTime
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
