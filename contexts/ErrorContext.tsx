import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ErrorModal, AlertType } from '../components/ErrorModal';

interface ErrorState {
    title: string;
    message: string;
    type: AlertType;
}

interface ErrorContextType {
    showError: (title: string, message: string) => void;
    showSuccess: (title: string, message: string) => void;
    showAlert: (title: string, message: string, type?: AlertType) => void;
    closeError: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [error, setError] = useState<ErrorState | null>(null);

    const showError = (title: string, message: string) => {
        setError({ title, message, type: 'error' });
    };

    const showSuccess = (title: string, message: string) => {
        setError({ title, message, type: 'success' });
    };

    const showAlert = (title: string, message: string, type: AlertType = 'info') => {
        setError({ title, message, type });
    };

    const closeError = () => {
        setError(null);
    };

    return (
        <ErrorContext.Provider value={{ showError, closeError }}>
            {children}
            {error && (
                <ErrorModal
                    title={error.title}
                    message={error.message}
                    type={error.type}
                    onClose={closeError}
                />
            )}
        </ErrorContext.Provider>
    );
};

export const useError = () => {
    const context = useContext(ErrorContext);
    if (!context) {
        throw new Error('useError must be used within an ErrorProvider');
    }
    return context;
};
