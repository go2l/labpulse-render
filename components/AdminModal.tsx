import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { getWhitelistedUsers, addWhitelistedUser, removeWhitelistedUser, toggleWhitelistedUser, WhitelistedUser } from '../firebaseService';
import { XMarkIcon, PlusIcon, TrashIcon, CheckCircleIcon, NoSymbolIcon } from '@heroicons/react/24/outline';

interface AdminModalProps {
    onClose: () => void;
}

const AdminModal: React.FC<AdminModalProps> = ({ onClose }) => {
    const { t } = useLanguage();
    const [users, setUsers] = useState<WhitelistedUser[]>([]);
    const [newEmail, setNewEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getWhitelistedUsers();
            setUsers(data);
        } catch (err) {
            console.error(err);
            setError(t.admin.error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail.trim() || !newEmail.includes('@')) return;
        
        // Don't allow adding the hardcoded owner explicitly here if we want to avoid confusion,
        // but it's fine if they do.
        setError('');
        try {
            await addWhitelistedUser(newEmail.trim());
            setNewEmail('');
            fetchUsers();
        } catch (err) {
            console.error(err);
            setError(t.admin.error);
        }
    };

    const handleToggle = async (email: string, currentStatus: boolean) => {
        try {
            await toggleWhitelistedUser(email, !currentStatus);
            fetchUsers();
        } catch (err) {
            console.error(err);
            setError(t.admin.error);
        }
    };

    const handleRemove = async (email: string) => {
        if (!window.confirm(t.common.delete + ' ' + email + '?')) return;
        try {
            await removeWhitelistedUser(email);
            fetchUsers();
        } catch (err) {
            console.error(err);
            setError(t.admin.error);
        }
    };

    // Owner is hardcoded to be whitelisted
    const ownerEmail = 'ohad126@gmail.com';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-right">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-2 md:mx-0 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        {t.admin.title}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 md:p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                    
                    {error && (
                        <div className="p-3 bg-red-100 text-red-700 rounded-xl text-sm font-bold">
                            {error}
                        </div>
                    )}

                    {/* Add User Form */}
                    <form onSubmit={handleAddUser} className="flex gap-2">
                        <input 
                            type="email" 
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder={t.admin.emailPlaceholder}
                            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white text-sm"
                            required
                        />
                        <button 
                            type="submit"
                            disabled={!newEmail.trim()}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm"
                        >
                            <PlusIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">{t.admin.addUser}</span>
                        </button>
                    </form>

                    {/* Users List */}
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                        {loading ? (
                            <div className="p-8 text-center text-slate-500">{t.common.loading}</div>
                        ) : (
                            <table className="w-full text-right text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3">{t.admin.email}</th>
                                        <th className="px-4 py-3 w-32">{t.admin.status}</th>
                                        <th className="px-4 py-3 w-24 text-center">{t.admin.actions}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Hardcoded Owner Row */}
                                    <tr className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                                        <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-medium">
                                            {ownerEmail}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                <CheckCircleIcon className="w-4 h-4" />
                                                {t.admin.autoApprovedOwner}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {/* No actions for owner */}
                                        </td>
                                    </tr>

                                    {/* Firestore Users */}
                                    {users.filter(u => u.email.toLowerCase() !== ownerEmail).map((user) => (
                                        <tr key={user.email} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                                            <td className="px-4 py-3 text-slate-900 dark:text-slate-100">
                                                {user.email}
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleToggle(user.email, user.enabled)}
                                                    className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full transition-colors ${
                                                        user.enabled 
                                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                                            : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}
                                                >
                                                    {user.enabled ? <CheckCircleIcon className="w-4 h-4" /> : <NoSymbolIcon className="w-4 h-4" />}
                                                    {user.enabled ? t.admin.enabled : t.admin.disabled}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button 
                                                    onClick={() => handleRemove(user.email)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title={t.admin.remove}
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                        {t.common.close}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminModal;
