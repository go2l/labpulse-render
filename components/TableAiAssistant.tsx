
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useError } from '../contexts/ErrorContext';
import { ArrowPathIcon, ArrowUturnRightIcon, XMarkIcon, ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline';
import { getTableAction } from '../geminiService';
import { AiSettings, TableAiAction, Experiment, Task } from '../types';

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.712L18 9.75l-.259-1.038a3.375 3.375 0 00-2.453-2.453L14.25 6l1.038-.259a3.375 3.375 0 002.453-2.453L18 2.25l.259 1.038a3.375 3.375 0 002.453 2.453L21.75 6l-1.038.259a3.375 3.375 0 00-2.453 2.453L18.259 8.712zM16.897 17.84L16.5 19.5l-.397-1.66a1.35 1.35 0 00-1.006-1.006L13.5 16.5l1.603-.397a1.35 1.35 0 001.006-1.006l.397-1.603.397 1.603a1.35 1.35 0 001.006 1.006L19.5 16.5l-1.603.397a1.35 1.35 0 00-1.006 1.006z" />
  </svg>
);

interface TableAiAssistantProps {
  settings: AiSettings;
  experiments: Experiment[];
  tasks: Task[];
  onActionConfirmed: (action: TableAiAction) => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

const TableAiAssistant: React.FC<TableAiAssistantProps> = ({
  settings,
  experiments,
  tasks,
  onActionConfirmed,
  onUndo,
  canUndo
}) => {
  const { t, language } = useLanguage();
  const { showError, showAlert } = useError();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<TableAiAction | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    try {
      // Send all tasks for context so queries are accurate
      const res = await getTableAction(settings, prompt, experiments, tasks, t, language);
      if (res.action === 'none') {
        showAlert(t.aiChat.systemAnswer, res.textResponse, 'info');
        setPrompt('');
      } else {
        setPendingAction(res);
      }
    } catch (error) {
      showError(t.common.error, t.aiChat.error);
    } finally {
      setLoading(false);
    }
  };

  const isQuery = pendingAction?.action === 'query';

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-30 flex flex-col items-center gap-3">
      {/* Undo Toast Notification */}
      {canUndo && !pendingAction && (
        <div className="bg-slate-900 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 mb-2">
          <span className="text-sm font-medium">{t.aiChat.undo}</span>
          <button
            onClick={onUndo}
            className="flex items-center gap-1 text-indigo-300 hover:text-white transition-colors text-sm font-bold"
          >
            <ArrowUturnRightIcon className="w-4 h-4" />
            <span>{t.aiChat.undoAction}</span>
          </button>
        </div>
      )}

      {pendingAction ? (
        <div className={`bg-white rounded-2xl shadow-2xl border-2 ${isQuery ? 'border-emerald-400' : 'border-indigo-400'} p-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 text-right w-full`}>
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 ${isQuery ? 'text-emerald-700' : 'text-indigo-700'}`}>
              {isQuery ? <ChatBubbleBottomCenterTextIcon className="w-6 h-6" /> : <SparklesIcon className="w-6 h-6" />}
              <h4 className="font-bold">{isQuery ? t.aiChat.systemAnswer : t.aiChat.aiActionProposal}</h4>
            </div>
            <button onClick={() => setPendingAction(null)} className="text-slate-400 hover:text-slate-600">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">{pendingAction.textResponse}</p>
          </div>

          {/* Visual confirmation details (Only for actions, not queries) */}
          {!isQuery && (
            <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-500 space-y-1">
              <p><span className="font-bold">{t.aiChat.action}:</span> {pendingAction.action}</p>
              {pendingAction.payload.taskData?.title && <p><span className="font-bold">{t.aiChat.task}:</span> {pendingAction.payload.taskData.title}</p>}
              {pendingAction.payload.experimentData?.name && <p><span className="font-bold">{t.aiChat.experiment}:</span> {pendingAction.payload.experimentData.name}</p>}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            {!isQuery ? (
              <>
                <button
                  onClick={() => {
                    onActionConfirmed(pendingAction);
                    setPendingAction(null);
                    setPrompt('');
                  }}
                  className="flex-1 bg-indigo-600 text-white font-bold py-2 rounded-xl hover:bg-indigo-700 shadow-md transition-colors"
                >
                  {t.aiChat.confirm}
                </button>
                <button
                  onClick={() => setPendingAction(null)}
                  className="flex-1 border border-slate-300 text-slate-700 font-bold py-2 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  {t.aiChat.cancel}
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setPendingAction(null);
                  setPrompt('');
                }}
                className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-xl hover:bg-emerald-700 shadow-md transition-colors"
              >
                {t.aiChat.closeAnswer}
              </button>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 flex items-center gap-2 group focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-inner">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent border-none outline-none text-sm py-2 px-1 text-slate-800 placeholder:text-slate-400 text-right"
            placeholder={t.aiChat.inputPlaceholder}
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : t.aiChat.send}
          </button>
        </form>
      )}
    </div>
  );
};

export default TableAiAssistant;
