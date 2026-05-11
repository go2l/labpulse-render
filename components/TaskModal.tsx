
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useError } from '../contexts/ErrorContext';
import { Task, TaskStatus, AiSettings } from '../types';
import { STATUS_OPTIONS } from '../constants';
import { getGuidingQuestions, smartRefineDescription } from '../geminiService';
import { hasCircularDependency, isTaskBlocked } from '../utils';
import {
  XMarkIcon,
  SparklesIcon,
  TrashIcon,
  ArrowPathIcon,
  LinkIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon,
  PencilSquareIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { format, parseISO, addDays } from 'date-fns';

interface TaskModalProps {
  task: Task;
  allTasks: Task[];
  experimentName?: string;
  settings: AiSettings;
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

const TaskModal: React.FC<TaskModalProps> = ({ task, allTasks, experimentName, settings, onClose, onSave, onDelete }) => {
  const { t, language } = useLanguage();
  const { showError } = useError();
  const [editedTask, setEditedTask] = useState<Task>({ ...task, dependencies: task.dependencies || [] });
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);

  // Delete Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Q&A Refinement State
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [refining, setRefining] = useState(false);

  const isBlocked = isTaskBlocked(editedTask, allTasks);

  const handleRefine = async () => {
    setLoading(true);
    setQuestions([]);
    setActiveQuestion(null);
    try {
      const context = t.taskModal.aiContext
        .replace('{title}', editedTask.title)
        .replace('{description}', editedTask.description);
      const q = await getGuidingQuestions(settings, context, t, language);
      setQuestions(q);
    } catch (e) {
      showError(t.common.error, t.taskModal.aiError);
    } finally {
      setLoading(false);
    }
  };

  const handleSmartIncorporate = async () => {
    if (!activeQuestion || !userAnswer.trim()) return;
    setRefining(true);
    try {
      const newDesc = await smartRefineDescription(
        settings,
        editedTask.description,
        activeQuestion,
        userAnswer,
        t,
        language
      );
      setEditedTask({ ...editedTask, description: newDesc });
      setUserAnswer('');
      setActiveQuestion(null);
      setQuestions(prev => prev.filter(q => q !== activeQuestion));
    } catch (e) {
      showError(t.common.error, t.taskModal.descUpdateError);
    } finally {
      setRefining(false);
    }
  };

  const handleAddDependency = (taskId: string) => {
    if (taskId && !editedTask.dependencies.includes(taskId)) {
      if (hasCircularDependency(allTasks, editedTask.id, taskId)) {
        showError(t.common.error, t.taskModal.circularDependencyError);
        return;
      }
      setEditedTask({
        ...editedTask,
        dependencies: [...editedTask.dependencies, taskId]
      });
    }
  };

  const handleRemoveDependency = (taskId: string) => {
    setEditedTask({
      ...editedTask,
      dependencies: editedTask.dependencies.filter(id => id !== taskId)
    });
  };

  const addToGoogleCalendar = () => {
    const title = encodeURIComponent(`[LabPulse] ${editedTask.title}`);
    const details = encodeURIComponent(`${editedTask.description}\n\n${t.aiChat.experiment}: ${experimentName || t.common.notImplemented}`); // Using existing keys or generic
    const startDate = parseISO(editedTask.weekId);
    const endDate = addDays(startDate, 1);
    const dates = `${format(startDate, 'yyyyMMdd')}/${format(endDate, 'yyyyMMdd')}`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
    window.open(url, '_blank');
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(task.id);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  const availableTasks = allTasks.filter(t =>
    t.id !== editedTask.id &&
    !editedTask.dependencies.includes(t.id) &&
    t.experimentId === editedTask.experimentId &&
    t.weekId < editedTask.weekId
  );

  return (
    // Backdrop is handled by parent to avoid Z-index fighting
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xl mx-2 md:mx-0 overflow-hidden flex flex-col max-h-[90vh] transition-colors relative z-50">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.taskModal.title}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto">
        {isBlocked && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 p-3 rounded-xl flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">{t.taskModal.blocked}</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">{t.taskModal.blockedMessage}</p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{t.taskModal.name}</label>
          <input
            type="text"
            value={editedTask.title}
            onChange={e => setEditedTask({ ...editedTask, title: e.target.value })}
            className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{t.taskModal.status}</label>
            <select
              value={editedTask.status}
              onChange={e => setEditedTask({ ...editedTask, status: e.target.value as TaskStatus })}
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-4 py-2 outline-none bg-white dark:bg-slate-700"
            >
              {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{t.taskStatus[opt.value] || opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{t.taskModal.importance}</label>
            <input
              type="number" min="1" max="5"
              value={editedTask.importance}
              onChange={e => setEditedTask({ ...editedTask, importance: parseInt(e.target.value) })}
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-4 py-2 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{t.taskModal.description}</label>
          <div className={`transition-all ${refining ? 'opacity-50 pointer-events-none' : ''}`}>
            <textarea
              value={editedTask.description}
              onChange={e => setEditedTask({ ...editedTask, description: e.target.value })}
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-4 py-2 outline-none h-32 resize-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={addToGoogleCalendar}
            className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
          >
            <CalendarIcon className="w-4 h-4" />
            {t.taskModal.addToCalendar}
          </button>
        </div>

        <div className="bg-indigo-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-3 border border-indigo-100 dark:border-slate-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <SparklesIcon className="w-5 h-5" />
              <span className="font-bold text-sm">{t.taskModal.aiAssistant}</span>
            </div>
            <button
              type="button"
              onClick={handleRefine}
              disabled={loading}
              className="text-xs bg-white dark:bg-slate-600 border border-indigo-200 dark:border-slate-500 text-indigo-600 dark:text-indigo-300 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 dark:hover:bg-slate-500 transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : (questions.length > 0 ? t.taskModal.refreshQuestions : t.taskModal.refineQuestions)}
            </button>
          </div>

          {questions.length > 0 && (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className={`bg-white/60 dark:bg-slate-800/60 rounded-lg border border-indigo-100 dark:border-slate-600 overflow-hidden transition-all ${activeQuestion === q ? 'ring-2 ring-indigo-400' : ''}`}>
                  <div className="p-3 flex items-start justify-between gap-3">
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{q}</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeQuestion === q) setActiveQuestion(null);
                        else {
                          setActiveQuestion(q);
                          setUserAnswer('');
                        }
                      }}
                      className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 whitespace-nowrap"
                      title={t.taskModal.replyToQuestion}
                    >
                      {activeQuestion === q ? <XMarkIcon className="w-4 h-4" /> : <ChatBubbleLeftRightIcon className="w-4 h-4" />}
                    </button>
                  </div>

                  {activeQuestion === q && (
                    <div className="p-3 bg-indigo-50/50 dark:bg-slate-700/50 border-t border-indigo-100 dark:border-slate-600 animate-in slide-in-from-top-2">
                      <textarea
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        placeholder={t.taskModal.typeAnswerPlaceholder}
                        className="w-full text-xs p-2 border border-indigo-200 dark:border-slate-500 rounded-lg outline-none focus:border-indigo-400 dark:bg-slate-800 dark:text-white"
                        rows={2}
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          type="button"
                          onClick={handleSmartIncorporate}
                          disabled={!userAnswer.trim() || refining}
                          className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {refining ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : <PencilSquareIcon className="w-3 h-3" />}
                          {t.taskModal.smartIncorporate}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
            <LinkIcon className="w-4 h-4" />
            {t.taskModal.dependencies}
          </label>
          <div className="space-y-2 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-100 dark:border-slate-600">
            {editedTask.dependencies.length > 0 && (
              <div className="space-y-2 mb-3">
                {editedTask.dependencies.map(depId => {
                  const depTask = allTasks.find(t => t.id === depId);
                  if (!depTask) return null;
                  return (
                    <div key={depId} className="flex items-center justify-between bg-white dark:bg-slate-600 p-2 rounded-lg border border-slate-200 dark:border-slate-500 shadow-sm">
                      <span className="text-sm text-slate-700 dark:text-slate-200 truncate pr-2">{depTask.title}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDependency(depId)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        title={t.taskModal.removeDependency}
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleAddDependency(e.target.value);
                  e.target.value = "";
                }
              }}
              className="w-full border border-slate-300 dark:border-slate-500 rounded-xl px-4 py-2 text-sm outline-none bg-white dark:bg-slate-600 dark:text-white focus:ring-2 focus:ring-indigo-500"
              defaultValue=""
            >
              <option value="" disabled>{t.taskModal.addDependencyPlaceholder}</option>
              {availableTasks.map(t => (
                <option key={t.id} value={t.id}>{t.title} ({format(parseISO(t.weekId), 'dd/MM')})</option>
              ))}
              {availableTasks.length === 0 && (
                <option value="" disabled>{t.taskModal.noDependenciesAvailable}</option>
              )}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="task-completed"
            checked={editedTask.completed}
            onChange={e => setEditedTask({ ...editedTask, completed: e.target.checked, status: e.target.checked ? TaskStatus.COMPLETED : editedTask.status })}
            className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-slate-700"
          />
          <label htmlFor="task-completed" className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.taskModal.completed}</label>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
        {showDeleteConfirm ? (
          <div className="flex items-center gap-3 animate-in slide-in-from-right-2">
            <span className="text-sm font-bold text-red-700 dark:text-red-300">{t.taskModal.confirmDelete}</span>
            <button
              type="button"
              onClick={confirmDelete}
              className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 shadow-sm"
            >
              {t.taskModal.confirmDeleteYes}
            </button>
            <button
              type="button"
              onClick={cancelDelete}
              className="bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50"
            >
              {t.taskModal.confirmDeleteNo}
            </button>
          </div>
        ) : (
          allTasks.some(t => t.id === task.id) && (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-bold text-sm transition-colors"
            >
              <TrashIcon className="w-5 h-5" />
              <span>{t.taskModal.deleteTask}</span>
            </button>
          )
        )}

        <div className="flex items-center gap-3">
          <button onClick={onClose} className="px-6 py-2 rounded-xl border border-slate-300 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => onSave(editedTask)}
            className="px-6 py-2 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
