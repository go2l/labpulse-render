
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { AiSettings } from '../types';
import { XMarkIcon, ShieldCheckIcon, BeakerIcon, KeyIcon, PaintBrushIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

interface SettingsProps {
  settings: AiSettings;
  onSave: (settings: AiSettings) => void;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onSave, onClose }) => {
  const { t, language } = useLanguage();
  const [localSettings, setLocalSettings] = useState<AiSettings>({ ...settings });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-right">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-2 md:mx-0 overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.settings.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-8 flex-1 overflow-y-auto text-slate-900 dark:text-slate-100 custom-scrollbar">

          {/* Appearance Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <PaintBrushIcon className="w-5 h-5 text-indigo-500" />
              {t.settings.appearance}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{t.settings.theme}</label>
                <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                  <button
                    onClick={() => setLocalSettings({ ...localSettings, theme: 'light' })}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${localSettings.theme === 'light' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                  >
                    {t.settings.light}
                  </button>
                  <button
                    onClick={() => setLocalSettings({ ...localSettings, theme: 'dark' })}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${localSettings.theme === 'dark' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                  >
                    {t.settings.dark}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{t.settings.fontSize}</label>
                <select
                  value={localSettings.fontSize}
                  onChange={e => setLocalSettings({ ...localSettings, fontSize: e.target.value as any })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2 outline-none bg-white dark:bg-slate-700 dark:text-white text-sm"
                >
                  <option value="normal">{t.settings.normal}</option>
                  <option value="large">{t.settings.large}</option>
                  <option value="xl">{t.settings.extraLarge}</option>
                </select>
              </div>
            </div>
          </div>

          {/* AI Persona & Content Control */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <ChatBubbleLeftRightIcon className="w-5 h-5 text-indigo-500" />
              {t.settings.aiPersona}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{t.settings.style}</label>
                <select
                  value={localSettings.aiStyle || 'professional'}
                  onChange={e => setLocalSettings({ ...localSettings, aiStyle: e.target.value as any })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none bg-white dark:bg-slate-700 dark:text-white text-sm"
                >
                  <option value="professional">{t.settings.professional}</option>
                  <option value="academic">{t.settings.academic}</option>
                  <option value="concise_technical">{t.settings.conciseTechnical}</option>
                  <option value="casual">{t.settings.casual}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{t.settings.detailLevel}</label>
                <select
                  value={localSettings.aiDetailLevel || 'balanced'}
                  onChange={e => setLocalSettings({ ...localSettings, aiDetailLevel: e.target.value as any })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none bg-white dark:bg-slate-700 dark:text-white text-sm"
                >
                  <option value="concise">{t.settings.concise}</option>
                  <option value="balanced">{t.settings.balanced}</option>
                  <option value="comprehensive">{t.settings.comprehensive}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">{t.settings.includeInResponse}</label>
              <div className="flex flex-wrap gap-4 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-100 dark:border-slate-600">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.showAssumptions}
                    onChange={e => setLocalSettings({ ...localSettings, showAssumptions: e.target.checked })}
                    className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t.settings.assumptions}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.showMethodology}
                    onChange={e => setLocalSettings({ ...localSettings, showMethodology: e.target.checked })}
                    className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t.settings.methodology}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.showReservations}
                    onChange={e => setLocalSettings({ ...localSettings, showReservations: e.target.checked })}
                    className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t.settings.reservations}</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{t.settings.language}</label>
              <input
                type="text"
                value={localSettings.aiLanguage || 'Hebrew'}
                onChange={e => setLocalSettings({ ...localSettings, aiLanguage: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none bg-white dark:bg-slate-700 dark:text-white text-sm"
                placeholder={t.settings.aiLanguagePlaceholder}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{t.settings.systemPrompt}</label>
              <textarea
                value={localSettings.customSystemInstructions || ''}
                onChange={e => setLocalSettings({ ...localSettings, customSystemInstructions: e.target.value })}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none bg-white dark:bg-slate-700 dark:text-white text-sm min-h-[80px]"
                placeholder={t.settings.systemPromptPlaceholder}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                {t.settings.systemPromptHint}
              </p>
            </div>
          </div>

          {/* Technical Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <KeyIcon className="w-5 h-5 text-indigo-500" />
              {t.settings.technical}
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{t.settings.apiKey}</label>
              <div className="relative">
                <input
                  type="password"
                  value={localSettings.apiKey}
                  onChange={e => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white"
                  placeholder={t.settings.apiKeyPlaceholder}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-slate-700/50 rounded-xl border border-indigo-100 dark:border-slate-600">
              <div className="flex items-center gap-3">
                <BeakerIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <div className="text-right">
                  <p className="font-bold text-sm text-indigo-900 dark:text-indigo-200">{t.settings.mockMode}</p>
                </div>
              </div>
              <button
                onClick={() => setLocalSettings({ ...localSettings, mockMode: !localSettings.mockMode })}
                className={`w-10 h-5 rounded-full transition-colors relative ${localSettings.mockMode ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${localSettings.mockMode ? 'left-1' : 'left-6'}`}></div>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{t.settings.model}</label>
                <select
                  value={localSettings.modelText}
                  onChange={e => setLocalSettings({ ...localSettings, modelText: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none bg-white dark:bg-slate-700 dark:text-white text-xs"
                >
                  <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                  <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">{t.settings.temperature}</label>
                <input
                  type="number" step="0.1" min="0" max="1"
                  value={localSettings.temperature}
                  onChange={e => setLocalSettings({ ...localSettings, temperature: parseFloat(e.target.value) })}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 outline-none dark:bg-slate-700 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 rounded-xl border border-slate-300 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            {t.common.cancel}
          </button>
          <button
            onClick={() => { onSave(localSettings); onClose(); }}
            className="px-6 py-2 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
