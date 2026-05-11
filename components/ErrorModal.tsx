import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../contexts/LanguageContext';

interface ErrorModalProps {
    title: string;
    message: string;
    onClose: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ title, message, onClose }) => {
    const { t } = useLanguage();

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center gap-3">
                    <div className="bg-red-100 p-3 rounded-full text-red-600">
                        <ExclamationTriangleIcon className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                    <p className="text-sm text-slate-500 whitespace-pre-wrap">{message}</p>
                    <button
                        onClick={onClose}
                        className="mt-4 w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-indigo-600 transition-colors"
                    >
                        {t.common.close || 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};
