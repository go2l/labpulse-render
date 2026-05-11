import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { signInWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const Login: React.FC = () => {
    const { signIn, signUp, continueAsGuest, signInWithGoogle } = useAuth();
    const { t } = useLanguage();
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                await signIn(email, password);
            } else {
                try {
                    await signUp(email, password, name);
                    setVerificationSent(true);
                } catch (signUpErr: any) {
                    if (signUpErr.code === 'auth/email-already-in-use') {
                        // Try to sign in. If successful and unverified, assume this is a retry and update details.
                        try {
                            const userCredential = await signInWithEmailAndPassword(auth, email, password);
                            if (userCredential.user && !userCredential.user.emailVerified) {
                                // Account exists, password correct, but unverified. Recover it.
                                await updateProfile(userCredential.user, { displayName: name });
                                await sendEmailVerification(userCredential.user);
                                setVerificationSent(true);
                                return; // Success, allow auto-login via AuthContext
                            }
                            // If verified, throw original error to show "Email already in use"
                        } catch (signInErr) {
                            // Sign in failed (wrong password?), throw original error
                        }
                    }
                    throw signUpErr;
                }
            }
        } catch (err: any) {
            console.error(err);
            let message = t.login.loginError;
            if (err.code === 'auth/wrong-password') message = t.login.wrongPassword;
            if (err.code === 'auth/user-not-found') message = t.login.userNotFound;
            if (err.code === 'auth/email-already-in-use') message = t.login.emailInUse;
            if (err.code === 'auth/weak-password') message = t.login.weakPassword;
            if (err.code === 'auth/invalid-credential') message = t.login.invalidCredential;
            if (message === t.login.loginError) {
                message += ` (${err.code})`;
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    if (verificationSent) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700 text-center">
                    <div className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{t.login.verificationSentTitle}</h2>
                    <p className="text-slate-600 dark:text-slate-300 mb-6">
                        {t.login.verificationSentMessage.replace('{email}', email)}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                    >
                        {t.login.backToLogin}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700">
                <h2 className="text-3xl font-bold text-center mb-6 text-slate-900 dark:text-white">
                    {isLogin ? t.login.loginTitle : t.login.signupTitle}
                </h2>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 p-3 rounded-lg mb-4 text-center text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                {t.login.fullName}
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required={!isLogin}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                placeholder={t.login.fullNamePlaceholder}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {t.login.email}
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                            placeholder={t.login.emailPlaceholder}
                            dir="ltr"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {t.login.password}
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                            placeholder={t.login.passwordPlaceholder}
                            dir="ltr"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? t.common.loading : (isLogin ? t.login.loginBtn : t.login.signupBtn)}
                    </button>
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-300 dark:border-slate-600"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white dark:bg-slate-800 text-slate-500">{t.login.or}</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={async () => {
                            setError('');
                            try {
                                setLoading(true);
                                await signInWithGoogle();
                            } catch (err: any) {
                                console.error(err);
                                setError(t.login.googleLoginError + ' (' + err.code + ')');
                            } finally {
                                setLoading(false);
                            }
                        }}
                        disabled={loading}
                        className="w-full bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 font-bold py-3 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="currentColor"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="currentColor"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        {t.login.googleLogin}
                    </button>

                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium"
                    >
                        {isLogin ? t.login.noAccount : t.login.hasAccount}
                    </button>

                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button
                            onClick={continueAsGuest}
                            type="button"
                            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-medium transition-colors"
                        >
                            {t.login.guestMode}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
