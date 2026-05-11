
import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useError } from '../contexts/ErrorContext';
import { Experiment, AiSettings, Task, PlanTaskItem, TaskStatus } from '../types';
import { getGuidingQuestions, generateExperimentReport, smartRefineDescription } from '../geminiService';
import { normalizeToSunday, generateUUID } from '../utils';
import { differenceInWeeks, parseISO, addWeeks, format, isValid } from 'date-fns';
import TaskModal from './TaskModal';
import {
  XMarkIcon,
  SparklesIcon,
  ArrowPathIcon,
  TableCellsIcon,
  ArrowsRightLeftIcon,
  ClipboardIcon,
  CheckIcon,
  BeakerIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

interface ExperimentDetailsModalProps {
  experiment: Experiment;
  settings: AiSettings;
  onClose: () => void;
  onSave: (experiment: Experiment, updatedTasks?: Task[]) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onResetTasks: (id: string) => void;
  onShiftTimeline?: (experimentId: string, weeksToShift: number) => void;
  onDeleteTask?: (taskId: string) => void;
  tasks?: Task[];
}

// Internal interface for the table row, combining task data with display logic
interface PlanRow extends PlanTaskItem {
  actualTaskId?: string; // Link to real task
  actualDate: string; // The real date
}

const ExperimentDetailsModal: React.FC<ExperimentDetailsModalProps> = ({
  experiment,
  settings,
  onClose,
  onSave,
  onArchive,
  onDelete,
  onResetTasks,
  onShiftTimeline,
  onDeleteTask,
  tasks = []
}) => {
  const { t, language } = useLanguage();
  const { showError, showSuccess } = useError();
  const [activeTab, setActiveTab] = useState<'details' | 'plan'>('details');
  const [edited, setEdited] = useState<Experiment>({ ...experiment });
  const [isEditingPlan, setIsEditingPlan] = useState(false);

  // View mode for dates: 'offset' (Week 1, 2) or 'date' (12/05/2024)
  const [dateInputMode, setDateInputMode] = useState<'offset' | 'date'>('offset');

  // Initialize table rows from ALL active tasks of this experiment
  const [planRows, setPlanRows] = useState<PlanRow[]>([]);

  // Task Modal State (for full editing/adding)
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [currentTaskToEdit, setCurrentTaskToEdit] = useState<Task | null>(null);

  useEffect(() => {
    // Only rebuild rows if NOT editing, to preserve local unsaved changes like added rows
    // However, if we just saved a task from the modal, we want this to update.
    if (isEditingPlan && !taskModalOpen) return;

    // Populate rows based on actual tasks to ensure we show manual additions too
    const experimentTasks = tasks.filter(t => t.experimentId === experiment.id);

    // Sort by date then importance
    experimentTasks.sort((a, b) => {
      if (a.weekId !== b.weekId) return a.weekId.localeCompare(b.weekId);
      return b.importance - a.importance;
    });

    const rows: PlanRow[] = experimentTasks.map(t => {
      const startDate = parseISO(experiment.startDate);
      const taskDate = parseISO(t.weekId);
      // Calculate offset safely
      let offset = 0;
      if (isValid(startDate) && isValid(taskDate)) {
        offset = differenceInWeeks(taskDate, startDate);
      }

      return {
        id: t.planTaskId || t.id, // Use plan ID if exists, otherwise task ID
        actualTaskId: t.id,
        title: t.title,
        description: t.description,
        weekOffset: offset,
        actualDate: t.weekId,
        importance: t.importance,
        status: t.status,
        recurrence: undefined, // In list view, we show individual instances
        dependencies: t.dependencies
      };
    });

    setPlanRows(rows);
  }, [tasks, experiment.id, experiment.startDate, isEditingPlan, taskModalOpen]);

  const [questions, setQuestions] = useState<string[]>(experiment.aiInsights || []);
  const [loading, setLoading] = useState(false);
  const [shiftWeeks, setShiftWeeks] = useState(1);

  // Q&A Refinement State
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [refining, setRefining] = useState(false);

  // Confirmation States
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Report State
  const [report, setReport] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  const handleGetQuestions = async () => {
    setLoading(true);
    setQuestions([]);
    setActiveQuestion(null);
    try {
      const q = await getGuidingQuestions(settings, `${t.reports.experiment}: ${edited.name}. ${t.reports.description}: ${edited.description}. ${t.wizard.proposal}: ${edited.proposalText || t.common.none}`, t, language);
      setQuestions(q);
      // Save insights immediately and update local edited state to prevent overwrite
      const updatedEntry = { ...edited, aiInsights: q };
      setEdited(updatedEntry);
      onSave(updatedEntry, undefined);
    } catch (e) {
      showError(t.common.error, t.experimentDetails.aiAccessError);
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
        edited.description,
        activeQuestion,
        userAnswer,
        t,
        language
      );
      const newExperimentData = { ...edited, description: newDesc };
      setEdited(newExperimentData);
      setUserAnswer('');
      setActiveQuestion(null);

      // Update local questions state and save changes
      // Update local questions state and save changes
      const updatedQuestions = questions.filter(q => q !== activeQuestion);
      setQuestions(updatedQuestions);

      const valToSave = { ...newExperimentData, aiInsights: updatedQuestions };
      setEdited(valToSave); // Update edited to include the new insights
      onSave(valToSave, undefined);
    } catch (e) {
      showError(t.common.error, t.experimentDetails.descUpdateError);
    } finally {
      setRefining(false);
    }
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const result = await generateExperimentReport(settings, experiment, tasks, t, language);
      setReport(result);
    } catch (e) {
      showError(t.common.error, t.experimentDetails.reportError);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleCopyReport = () => {
    if (report) {
      navigator.clipboard.writeText(report);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    }
  };

  const handleShift = () => {
    if (onShiftTimeline) {
      if (confirm(t.experimentDetails.confirmShiftMessage.replace('{weeks}', shiftWeeks.toString()))) {
        onShiftTimeline(experiment.id, shiftWeeks);
        showSuccess(t.common.success, t.experimentDetails.timelineUpdateSuccess);
      }
    }
  };

  const handleRowChange = (index: number, field: keyof PlanRow, value: any) => {
    const newRows = [...planRows];
    const row = { ...newRows[index], [field]: value };

    // Smart Date Logic
    if (field === 'weekOffset') {
      // If offset changed, calculate new date
      const startDate = parseISO(edited.startDate);
      if (isValid(startDate)) {
        const newDate = addWeeks(startDate, value as number);
        row.actualDate = normalizeToSunday(newDate);
      }
    } else if (field === 'actualDate') {
      // If date changed, calculate new offset
      const startDate = parseISO(edited.startDate);
      const newDate = parseISO(value as string);
      if (isValid(startDate) && isValid(newDate)) {
        row.weekOffset = differenceInWeeks(newDate, startDate);
      }
    }

    newRows[index] = row;
    setPlanRows(newRows);
  };

  const handleOpenAddTask = () => {
    const newTask: Task = {
      id: generateUUID(),
      experimentId: experiment.id,
      title: '',
      description: '',
      weekId: normalizeToSunday(experiment.startDate),
      status: TaskStatus.DEFAULT,
      importance: 3,
      completed: false,
      tags: [],
      attachments: [],
      dependencies: []
    };
    setCurrentTaskToEdit(newTask);
    setTaskModalOpen(true);
  };

  const handleOpenEditTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setCurrentTaskToEdit(task);
      setTaskModalOpen(true);
    }
  };

  const handleTaskModalSave = (updatedTask: Task) => {
    // Save directly using the main onSave mechanism to sync everything
    // We treat this as a single task update
    onSave(experiment, [updatedTask]);
    setTaskModalOpen(false);
    setCurrentTaskToEdit(null);
  };

  const handleTaskModalDelete = (taskId: string) => {
    if (onDeleteTask) {
      onDeleteTask(taskId);
      // Manually remove from local state immediately to ensure visual update even if useEffect is blocked by isEditingPlan
      setPlanRows(prev => prev.filter(row => row.actualTaskId !== taskId));
      setTaskModalOpen(false);
      setCurrentTaskToEdit(null);
    }
  };

  const savePlanChanges = () => {
    // Convert PlanRows back to Tasks
    const updatedTasks: Task[] = [];
    const experimentTasks = tasks.filter(t => t.experimentId === experiment.id);

    planRows.forEach(row => {
      // Find original task
      const originalTask = experimentTasks.find(t => t.id === row.actualTaskId);

      if (originalTask) {
        // Update existing task
        updatedTasks.push({
          ...originalTask,
          title: row.title,
          description: row.description,
          importance: row.importance,
          weekId: row.actualDate
        });
      }
      // Note: New tasks added via "Quick Edit" are complicated because we need full task structure.
      // We are moving to Modal based adding for new tasks to keep it clean.
      // But if user used the Quick Edit inputs for existing tasks, we save them here.
    });

    onSave(edited, updatedTasks);
    setIsEditingPlan(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl mx-2 md:mx-0 overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.experimentDetails.title}: {experiment.name}</h2>
            <div className="flex gap-4 mt-2">
              <button
                onClick={() => setActiveTab('details')}
                className={`text-sm font-bold border-b-2 pb-1 transition-colors ${activeTab === 'details' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                {t.experimentDetails.detailsTab}
              </button>
              <button
                onClick={() => setActiveTab('plan')}
                className={`text-sm font-bold border-b-2 pb-1 transition-colors ${activeTab === 'plan' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                {t.experimentDetails.planTab}
              </button>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 self-start">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'details' ? (
            <div className="p-4 md:p-8 space-y-6 md:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{t.wizard.experimentName}</label>
                    <input
                      type="text"
                      value={edited.name}
                      onChange={e => setEdited({ ...edited, name: e.target.value })}
                      className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{t.wizard.description}</label>
                    <div className={`transition-all ${refining ? 'opacity-50 pointer-events-none' : ''}`}>
                      <textarea
                        value={edited.description}
                        onChange={e => setEdited({ ...edited, description: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-xl px-4 py-2 outline-none h-32 resize-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{t.wizard.startDate}</label>
                      <input type="date" value={edited.startDate} readOnly className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-none px-0 py-0 text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{t.experimentDetails.status}</label>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${edited.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                        {edited.status === 'active' ? t.experimentDetails.active : t.experimentDetails.archived}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-indigo-50 dark:bg-slate-700/50 rounded-2xl p-6 border border-indigo-100 dark:border-slate-600 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                        <SparklesIcon className="w-6 h-6" />
                        <span className="font-bold">{t.experimentDetails.aiInsights}</span>
                      </div>
                      <button
                        onClick={handleGetQuestions}
                        disabled={loading}
                        type="button"
                        className="text-xs bg-white dark:bg-slate-700 border border-indigo-200 dark:border-slate-600 text-indigo-600 dark:text-indigo-300 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 dark:hover:bg-slate-600 disabled:opacity-50"
                      >
                        {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : (questions.length > 0 ? t.taskModal.refreshQuestions : t.taskModal.refineQuestions)}
                      </button>
                    </div>

                    {questions.length > 0 && (
                      <div className="space-y-3">
                        {questions.map((q, i) => (
                          <div key={i} className={`bg-white/80 dark:bg-slate-800/80 rounded-xl border border-indigo-100 dark:border-slate-600 shadow-sm transition-all overflow-hidden ${activeQuestion === q ? 'ring-2 ring-indigo-400' : ''}`}>
                            <div className="p-3 flex items-start justify-between gap-3">
                              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{q}</p>
                              <button
                                onClick={() => {
                                  if (activeQuestion === q) setActiveQuestion(null);
                                  else {
                                    setActiveQuestion(q);
                                    setUserAnswer('');
                                  }
                                }}

                                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 whitespace-nowrap"
                                title={t.experimentDetails.replyToQuestion}
                              >
                                {activeQuestion === q ? <XMarkIcon className="w-4 h-4" /> : <ChatBubbleLeftRightIcon className="w-4 h-4" />}
                              </button>
                            </div>

                            {/* Answer Area */}
                            {activeQuestion === q && (
                              <div className="p-3 bg-indigo-50/50 dark:bg-slate-700/50 border-t border-indigo-100 dark:border-slate-600 animate-in slide-in-from-top-2">
                                <textarea
                                  value={userAnswer}
                                  onChange={(e) => setUserAnswer(e.target.value)}
                                  placeholder={t.experimentDetails.answerPlaceholder}
                                  className="w-full text-xs p-2 border border-indigo-200 dark:border-slate-500 rounded-lg outline-none focus:border-indigo-400 dark:bg-slate-800 dark:text-white"
                                  rows={2}
                                />
                                <div className="flex justify-end mt-2">
                                  <button
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

                    {questions.length === 0 && !loading && (
                      <p className="text-xs text-indigo-600/70 dark:text-indigo-300/70 text-center italic">{t.experimentDetails.questionsHint}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="border-t border-red-100 dark:border-red-900/30 mt-8 pt-8">
                <h3 className="text-sm font-bold text-red-800 dark:text-red-400 mb-4 flex items-center gap-2">
                  <ExclamationTriangleIcon className="w-5 h-5" />
                  {t.taskModal.dangerZone}
                </h3>
                <div className="flex gap-4">

                  {/* Reset Button with Inline Confirmation */}
                  {confirmReset ? (
                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50">
                      <span className="text-xs font-bold text-red-800 dark:text-red-300">{t.experimentDetails.confirmReset}</span>
                      <button
                        onClick={() => {
                          onResetTasks(experiment.id);
                          setConfirmReset(false);
                        }}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                      >
                        {t.experimentDetails.confirmResetYes}
                      </button>
                      <button
                        onClick={() => setConfirmReset(false)}
                        className="text-xs bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded border border-slate-300 dark:border-slate-600"
                      >
                        {t.common.cancel}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 px-4 py-2 rounded-lg transition-colors border border-red-200 dark:border-red-900/50"
                    >
                      <ArrowUturnLeftIcon className="w-4 h-4" />
                      {t.experimentDetails.resetTasks}
                    </button>
                  )}

                  {/* Delete Button with Inline Confirmation */}
                  {confirmDelete ? (
                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50">
                      <span className="text-xs font-bold text-red-800 dark:text-red-300">{t.experimentDetails.confirmDelete}</span>
                      <button
                        onClick={() => {
                          onDelete(experiment.id);
                          onClose();
                        }}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                      >
                        {t.experimentDetails.confirmDeleteYes}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="text-xs bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded border border-slate-300 dark:border-slate-600"
                      >
                        {t.common.cancel}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 px-4 py-2 rounded-lg transition-colors shadow-sm"
                    >
                      <TrashIcon className="w-4 h-4" />
                      {t.experimentDetails.deleteExperiment}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 md:p-8 space-y-8">
              {/* Timeline Shift Tool */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="bg-amber-200 dark:bg-amber-800 p-2 rounded-lg text-amber-800 dark:text-amber-100">
                    <ArrowsRightLeftIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-900 dark:text-amber-100">{t.experimentDetails.shiftTimeline}</h3>
                    <p className="text-sm text-amber-800 dark:text-amber-200/80">{t.experimentDetails.shiftTimelineDesc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={shiftWeeks}
                    onChange={e => setShiftWeeks(parseInt(e.target.value))}
                    className="w-16 border-amber-300 dark:border-amber-700 rounded-lg px-2 py-2 text-center font-bold bg-white dark:bg-slate-700 dark:text-white"
                  />
                  <span className="text-sm font-bold text-amber-900 dark:text-amber-100">{t.board.week}</span>
                  <button
                    type="button"
                    onClick={handleShift}
                    className="px-4 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 shadow-sm transition-colors"
                  >
                    {t.experimentDetails.shiftTimeline}
                  </button>
                </div>
              </div>

              {/* Master Plan Table (Now showing ALL tasks) */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <TableCellsIcon className="w-5 h-5 text-slate-400" />
                      {t.experimentDetails.masterPlan}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">{t.experimentDetails.masterPlanDesc}</p>
                  </div>

                  <div className="flex gap-2">
                    {/* Quick Edit Toggle */}
                    {planRows.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingPlan) savePlanChanges();
                          else setIsEditingPlan(true);
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border ${isEditingPlan ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                      >
                        {isEditingPlan ? <CheckIcon className="w-4 h-4" /> : <PencilSquareIcon className="w-4 h-4" />}
                        <span>{isEditingPlan ? t.common.save : t.experimentDetails.quickEdit}</span>
                      </button>
                    )}

                    {/* Add Task Button (Opens Modal) */}
                    <button
                      onClick={handleOpenAddTask}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                      <PlusIcon className="w-4 h-4" />
                      <span>{t.experimentDetails.addTask}</span>
                    </button>
                  </div>
                </div>

                {planRows.length > 0 ? (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto relative flex flex-col">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 relative">
                      <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-300 uppercase">{t.taskModal.name}</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-300 uppercase">{t.taskModal.description}</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-300 uppercase w-48">
                            <div className="flex items-center gap-2">
                              <span>{t.wizard.startDate}</span>
                              {isEditingPlan && (
                                <button
                                  onClick={() => setDateInputMode(prev => prev === 'offset' ? 'date' : 'offset')}
                                  className="text-[10px] bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1 hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
                                  title={t.experimentDetails.switchEditMode}
                                >
                                  {dateInputMode === 'offset' ? <ClockIcon className="w-3 h-3" /> : <CalendarDaysIcon className="w-3 h-3" />}
                                  {dateInputMode === 'offset' ? t.board.week : t.taskModal.date}
                                </button>
                              )}
                            </div>
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-300 uppercase w-20">{t.taskModal.importance}</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-300 uppercase w-10">{t.common.edit}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {planRows.map((item, index) => (
                          <tr key={item.actualTaskId} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-4 py-3">
                              {isEditingPlan ? (
                                <input
                                  type="text"
                                  value={item.title}
                                  onChange={(e) => handleRowChange(index, 'title', e.target.value)}
                                  className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded p-1 text-sm font-bold"
                                  placeholder={t.experimentDetails.taskNamePlaceholder}
                                />
                              ) : (
                                <span className="font-bold text-slate-800 dark:text-slate-200 block">{item.title}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isEditingPlan ? (
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => handleRowChange(index, 'description', e.target.value)}
                                  className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded p-1 text-xs"
                                  placeholder={t.experimentDetails.descriptionPlaceholder}
                                />
                              ) : (
                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] block" title={item.description}>{item.description}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                              {isEditingPlan ? (
                                dateInputMode === 'offset' ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-slate-400">{t.experimentDetails.week}</span>
                                    <input
                                      type="number"
                                      value={item.weekOffset}
                                      onChange={(e) => handleRowChange(index, 'weekOffset', parseInt(e.target.value))}
                                      className="w-14 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded p-1 text-sm text-center"
                                    />
                                  </div>
                                ) : (
                                  <input
                                    type="date"
                                    value={item.actualDate}
                                    onChange={(e) => handleRowChange(index, 'actualDate', e.target.value)}
                                    className="w-32 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded p-1 text-xs"
                                  />
                                )
                              ) : (
                                <div className="flex flex-col">
                                  <span className="font-bold">{t.experimentDetails.weekPrefix}{item.weekOffset >= 0 ? item.weekOffset : '-'}</span>
                                  <span className="text-[10px] text-slate-400">{format(parseISO(item.actualDate), 'dd/MM/yyyy')}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                              {isEditingPlan ? (
                                <input
                                  type="number" min="1" max="5"
                                  value={item.importance}
                                  onChange={(e) => handleRowChange(index, 'importance', parseInt(e.target.value))}
                                  className="w-12 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded p-1 text-sm text-center"
                                />
                              ) : (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.importance > 3 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>P{item.importance}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => item.actualTaskId && handleOpenEditTask(item.actualTaskId)}
                                className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                title={t.wizard.fullEdit}
                              >
                                <PencilSquareIcon className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
                    {t.experimentDetails.noTasks}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Report Overlay */}
        {report && (
          <div className="absolute inset-0 bg-white dark:bg-slate-800 z-20 flex flex-col animate-in fade-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/30">
              <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                <BeakerIcon className="w-5 h-5" />
                {t.experimentDetails.reportTitle}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyReport}
                  className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 bg-white dark:bg-slate-700 border border-indigo-200 dark:border-slate-600 px-3 py-1.5 rounded-lg transition-all"
                >
                  {copiedReport ? <CheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}
                  <span>{copiedReport ? t.experimentDetails.copied : t.experimentDetails.copy}</span>
                </button>
                <button onClick={() => setReport(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900">
              <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 prose prose-indigo dark:prose-invert">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  {report}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Task Edit Modal (Overlay) */}
        {taskModalOpen && currentTaskToEdit && (
          <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
            <TaskModal
              task={currentTaskToEdit}
              allTasks={tasks} // Pass all tasks for dependencies
              experimentName={experiment.name}
              settings={settings}
              onClose={() => {
                setTaskModalOpen(false);
                setCurrentTaskToEdit(null);
              }}
              onSave={handleTaskModalSave}
              onDelete={handleTaskModalDelete}
            />
          </div>
        )}

        <div className="px-4 md:px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col-reverse md:flex-row items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <button
              onClick={() => onArchive(experiment.id)}
              className="text-slate-500 hover:text-red-600 font-bold text-sm transition-colors"
            >
              {edited.status === 'active' ? t.experimentDetails.archiveExperiment : t.experimentDetails.restoreExperiment}
            </button>
            <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 hidden md:block"></div>
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold text-sm transition-colors disabled:opacity-50"
            >
              {generatingReport ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ClipboardIcon className="w-4 h-4" />}
              {t.experimentDetails.generateReport}
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button onClick={onClose} className="flex-1 md:flex-none px-6 py-2 rounded-xl border border-slate-300 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
              {t.common.cancel}
            </button>
            <button
              onClick={() => {
                if (isEditingPlan) savePlanChanges(); // Save plan if editing
                onSave(edited); // Save general details
              }}
              className="flex-1 md:flex-none px-6 py-2 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700 shadow-sm"
            >
              {t.common.save}
            </button>
          </div>
        </div>
      </div>
    </div >
  );
};

export default ExperimentDetailsModal;
