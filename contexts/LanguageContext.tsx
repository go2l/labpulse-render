import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, Direction, TranslationDictionary } from '../types/i18n';
import { he } from '../locales/he';
import { en } from '../locales/en';

interface LanguageContextType {
    language: Language;
    direction: Direction;
    t: TranslationDictionary;
    setLanguage: (lang: Language) => void;
    toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const dictionaries: Record<Language, TranslationDictionary> = {
    he,
    en
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Try to load from localStorage or default to 'he'
    const [language, setLanguageState] = useState<Language>(() => {
        const saved = localStorage.getItem('app-language');
        return (saved === 'en' || saved === 'he') ? saved : 'he';
    });

    const direction: Direction = language === 'he' ? 'rtl' : 'ltr';
    const t = dictionaries[language];

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('app-language', lang);
    };

    const toggleLanguage = () => {
        setLanguage(language === 'he' ? 'en' : 'he');
    };

    // Update HTML dir attribute when language changes
    useEffect(() => {
        document.documentElement.dir = direction;
        document.documentElement.lang = language;
    }, [direction, language]);

    return (
        <LanguageContext.Provider value={{ language, direction, t, setLanguage, toggleLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
