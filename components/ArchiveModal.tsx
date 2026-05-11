
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Experiment } from '../types';
import { XMarkIcon, ArchiveBoxXMarkIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

interface ArchiveModalProps {
  experiments: Experiment[];
  onClose: () => void;
  onRestore: (id: string) => void;
  onDeleteForever?: (id: string) => void; // Optional future feature
}

const ArchiveModal: React.FC<ArchiveModalProps> = ({ experiments, onClose, onRestore }) => {
  const { t, language } = useLanguage();
  const archivedExperiments = experiments.filter(e => e.status === 'archived');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-right" dir={language === 'he' ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-2 md:mx-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800">
            <ArchiveBoxXMarkIcon className="w-6 h-6" />
            <h2 className="text-xl font-bold">{t.archive.title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {archivedExperiments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <ArchiveBoxXMarkIcon className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">{t.archive.emptyArchive}</p>
              <p className="text-sm">{t.archive.emptyArchiveInspiration}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {archivedExperiments.map(exp => (
                <div key={exp.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div>
                    <h3 className="font-bold text-slate-900">{exp.name}</h3>
                    <p className="text-sm text-slate-500 truncate max-w-md">{exp.description || t.archive.noDescription}</p>
                    <div className="mt-1 text-xs text-slate-400">
                      {t.archive.created}: {exp.startDate}
                    </div>
                  </div>
                  <button
                    onClick={() => onRestore(exp.id)}
                    className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-100 transition-colors"
                  >
                    <ArrowUturnLeftIcon className="w-4 h-4" />
                    <span>{t.archive.restore}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition-colors">
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArchiveModal;
