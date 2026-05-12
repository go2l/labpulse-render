import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  loadUserData,
  saveUserData,
  checkIfWhitelisted
} from './firebaseService';
import Header from './components/Header';
import Board from './components/Board';
import ExperimentWizard from './components/ExperimentWizard';
import TaskModal from './components/TaskModal';
import Settings from './components/Settings';
import SummaryModals from './components/SummaryModals';
import ExperimentDetailsModal from './components/ExperimentDetailsModal';
import TableAiAssistant from './components/TableAiAssistant';
import ArchiveModal from './components/ArchiveModal';
import AdminModal from './components/AdminModal';
import {
  Experiment,
  Task,
  AppData,
  AiSettings,
  TaskStatus,
  TableAiAction
} from './types';
import { useAuth } from './contexts/AuthContext';
import { useError } from './contexts/ErrorContext';
import Login from './components/Login';
import {
  APP_STORAGE_KEY,
  AI_SETTINGS_KEY,
  DEFAULT_AI_SETTINGS,
  INITIAL_APP_DATA
} from './constants';
import {
  getLocalStorage,
  setLocalStorage,
  generateUUID,
  normalizeToSunday,
  downloadJson,
  csvEscape,
  validateAndMigrateAppData
} from './utils';
import { addWeeks, parseISO } from 'date-fns';
import { ArrowDownOnSquareIcon, TrashIcon, DocumentDuplicateIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useLanguage } from './contexts/LanguageContext';
import { sendEmailVerification } from 'firebase/auth';

const App: React.FC = () => {
  // --- State ---
  const { t, language } = useLanguage();
  const { user, loading, isGuest, signOut } = useAuth();
  const { showError, showSuccess } = useError();
  const [data, setData] = useState<AppData>(getLocalStorage(APP_STORAGE_KEY, INITIAL_APP_DATA));
  const dataRef = useRef(data);

  // Keep ref in sync with latest state for use in effects with stale closures
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const currentSettings = data.settings || DEFAULT_AI_SETTINGS;

  const [wizardOpen, setWizardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [summaryType, setSummaryType] = useState<'weekly' | 'monthly' | null>(null);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  // Import State
  const [importCandidate, setImportCandidate] = useState<AppData | null>(null);

  // View State for Timeline
  const [viewOffset, setViewOffset] = useState(0);

  // Undo State
  const [lastUndoAction, setLastUndoAction] = useState<(() => void) | null>(null);

  // --- Effects ---
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);
  const [checkingWhitelist, setCheckingWhitelist] = useState(false);

  // --- Effects ---
  // --- Effects ---
  // Effect: Handle Whitelist Check
  useEffect(() => {
    const checkWhitelistStatus = async () => {
      if (user) {
        setCheckingWhitelist(true);
        try {
          const allowed = await checkIfWhitelisted(user.email || '');
          setIsWhitelisted(allowed);
        } catch (err) {
          console.error("Whitelist check failed in App.tsx", err);
          setIsWhitelisted(false);
        } finally {
          setCheckingWhitelist(false);
        }
      } else {
        setIsWhitelisted(null);
      }
    };
    checkWhitelistStatus();
  }, [user]);

  useEffect(() => {
    // Update Document Title based on language
    if (language === 'he') {
      document.title = 'LabPulse | ניהול מחקר חכם';
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'he';
    } else {
      document.title = 'LabPulse | Smart Research Manager';
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    }
  }, [language]);



  // Effect: Handle Data Sync (Load/Subscribe)
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initSync = async () => {
      if (user) {
        setIsCloudSynced(false);
        try {
          // 1. Initial Check: Does cloud data exist?
          const cloudData = await loadUserData(user.uid);

          if (cloudData) {
            // Case A: Existing User -> Load Cloud Data
            setData(validateAndMigrateAppData(cloudData));
            setIsCloudSynced(true);
          } else {
            // Case B: New User -> Bootstrap with current local data
            await saveUserData(user.uid, dataRef.current);
            setIsCloudSynced(true);
          }

          // 2. Setup Real-time Listener for cross-device sync
          // We use require('./firebaseService').subscribeToUserData to avoid circular dep issues if any,
          // but standard import is fine.
          const { subscribeToUserData } = await import('./firebaseService');
          unsubscribe = subscribeToUserData(user.uid, (newData) => {
            setData(prev => {
              // Deep compare to avoid infinite loops with the save effect
              if (JSON.stringify(prev) === JSON.stringify(newData)) {
                return prev;
              }
              console.log("Received update from cloud", newData);
              return validateAndMigrateAppData(newData);
            });
          });

        } catch (error) {
          console.error("Failed to sync with Firebase:", error);
          // Fallback: allow local usage but maybe warn user? 
          // For now, we set sync true to allow saving local changes later if connection restores
          setIsCloudSynced(true);
        }
      } else {
        // Guest Mode or Logged Out
        setIsCloudSynced(false);
        // Clear state to prevent seeing previous user's data
        setData(getLocalStorage(APP_STORAGE_KEY, INITIAL_APP_DATA));
      }
    };

    initSync();

    return () => {
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only re-run on user change (login/logout)

  // Effect: Handle Data Persistence (Save)
  useEffect(() => {
    // If Guest -> Save to Local Storage
    if (!user) {
      setLocalStorage(APP_STORAGE_KEY, data);
      return;
    }

    // If User -> Save to Firestore (ONLY if fully synced first)
    if (isCloudSynced) {
      console.log('Attempting to save data to Firebase...', { userId: user.uid, dataSize: JSON.stringify(data).length });
      saveUserData(user.uid, data).catch(err => console.error("Save failed:", err));
    }
  }, [data, user, isCloudSynced]);

  useEffect(() => {
    // Apply Theme
    if (currentSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Apply Font Size
    if (currentSettings.fontSize === 'large') {
      document.documentElement.style.fontSize = '18px';
    } else if (currentSettings.fontSize === 'xl') {
      document.documentElement.style.fontSize = '20px';
    } else {
      document.documentElement.style.fontSize = '16px';
    }

  }, [currentSettings]);

  // --- Actions ---
  const handleSaveExperiment = (experiment: Experiment, tasks: Task[]) => {
    setData(prev => ({
      ...prev,
      experiments: [...prev.experiments, experiment],
      tasks: [...prev.tasks, ...tasks]
    }));
    setWizardOpen(false);
  };

  const handleUpdateExperiment = (updatedExp: Experiment, updatedTasks?: Task[]) => {
    setData(prev => {
      // 1. Update Experiment Data
      const newExperiments = prev.experiments.map(e => e.id === updatedExp.id ? updatedExp : e);

      // 2. Update Tasks (Merge existing with new ones)
      let newTasks = prev.tasks;
      if (updatedTasks) {
        // Create a Set of IDs that are being updated/added
        const updatedIds = new Set(updatedTasks.map(t => t.id));

        // Keep all tasks that are NOT in the update list
        const otherTasks = prev.tasks.filter(t => !updatedIds.has(t.id));

        // Combine: [Unchanged Tasks] + [Updated/New Tasks]
        newTasks = [...otherTasks, ...updatedTasks];
      }

      return {
        ...prev,
        experiments: newExperiments,
        tasks: newTasks
      };
    });
  };

  const handleArchiveExperiment = (id: string) => {
    setData(prev => ({
      ...prev,
      experiments: prev.experiments.map(e => e.id === id ? { ...e, status: e.status === 'active' ? 'archived' : 'active' } : e)
    }));
    setSelectedExperiment(null);
  };

  const handleRestoreExperiment = (id: string) => {
    setData(prev => ({
      ...prev,
      experiments: prev.experiments.map(e => e.id === id ? { ...e, status: 'active' } : e)
    }));
  };

  const handleDeleteExperiment = (id: string) => {
    setData(prev => ({
      ...prev,
      experiments: prev.experiments.filter(e => e.id !== id),
      tasks: prev.tasks.filter(t => t.experimentId !== id)
    }));
    setSelectedExperiment(null);
  };

  const handleResetExperimentTasks = (id: string) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.experimentId !== id)
    }));
  };

  const handleShiftExperimentTimeline = (experimentId: string, weeksToShift: number) => {
    setData(prev => {
      const updatedTasks = prev.tasks.map(t => {
        if (t.experimentId === experimentId && !t.completed) {
          return {
            ...t,
            weekId: normalizeToSunday(addWeeks(parseISO(t.weekId), weeksToShift))
          };
        }
        return t;
      });

      const updatedExperiments = prev.experiments.map(e => {
        if (e.id === experimentId) {
          return {
            ...e,
            endDate: e.endDate ? normalizeToSunday(addWeeks(parseISO(e.endDate), weeksToShift)) : undefined
          };
        }
        return e;
      });

      return {
        ...prev,
        tasks: updatedTasks,
        experiments: updatedExperiments
      };
    });
  };

  const handleMoveExperiment = (experimentId: string, direction: 'up' | 'down') => {
    setData(prev => {
      const activeExperiments = prev.experiments.filter(e => e.status === 'active');
      const currentIndex = activeExperiments.findIndex(e => e.id === experimentId);

      if (currentIndex === -1) return prev;
      if (direction === 'up' && currentIndex === 0) return prev;
      if (direction === 'down' && currentIndex === activeExperiments.length - 1) return prev;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const targetExperiment = activeExperiments[targetIndex];

      // Find actual indices in the full array
      const fullList = [...prev.experiments];
      const actualCurrentIndex = fullList.findIndex(e => e.id === experimentId);
      const actualTargetIndex = fullList.findIndex(e => e.id === targetExperiment.id);

      // Swap
      [fullList[actualCurrentIndex], fullList[actualTargetIndex]] = [fullList[actualTargetIndex], fullList[actualCurrentIndex]];

      return {
        ...prev,
        experiments: fullList
      };
    });
  };

  const handleAddTask = (experimentId: string, weekId: string) => {
    const newTask: Task = {
      id: generateUUID(),
      experimentId,
      title: '',
      description: '',
      weekId,
      status: TaskStatus.DEFAULT,
      importance: 3,
      completed: false,
      tags: [],
      attachments: [],
      dependencies: []
    };
    // Don't save to DB yet. Just set as selected (Draft mode).
    // setData(prev => ({
    //   ...prev,
    //   tasks: [...prev.tasks, newTask]
    // }));
    setSelectedTask(newTask);
  };

  const handleUpdateTask = (updatedTask: Task) => {
    // Check if it's a new task (Draft) or existing
    const existingIndex = data.tasks.findIndex(t => t.id === updatedTask.id);
    let newTasks;

    if (existingIndex === -1) {
      // It's a new task being saved for the first time
      newTasks = [...data.tasks, updatedTask];
    } else {
      // Update existing
      newTasks = data.tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    }

    // Sync Logic (Tasks -> Master Plan)
    let newExperiments = [...data.experiments];

    if (updatedTask.planTaskId) {
      const experimentIndex = newExperiments.findIndex(e => e.id === updatedTask.experimentId);
      if (experimentIndex > -1) {
        const experiment = newExperiments[experimentIndex];
        if (experiment.originalPlan) {
          const planItemIndex = experiment.originalPlan.findIndex(p => p.id === updatedTask.planTaskId);
          if (planItemIndex > -1) {
            const newPlan = [...experiment.originalPlan];
            let baseTitle = updatedTask.title;
            if (updatedTask.recurrenceGroupId) {
              baseTitle = baseTitle.replace(/\s\(\d+\)$/, '');
            }

            newPlan[planItemIndex] = {
              ...newPlan[planItemIndex],
              title: baseTitle,
              description: updatedTask.description,
              importance: updatedTask.importance
            };

            newExperiments[experimentIndex] = {
              ...experiment,
              originalPlan: newPlan
            };
          }
        }
      }
    }

    setData(prev => ({
      ...prev,
      tasks: newTasks,
      experiments: newExperiments
    }));
    setSelectedTask(null);
  };

  const handleDeleteTask = (taskId: string) => {
    setData(prev => {
      const remainingTasks = prev.tasks.filter(t => t.id !== taskId);
      const cleanTasks = remainingTasks.map(t => {
        if (t.dependencies && t.dependencies.includes(taskId)) {
          return {
            ...t,
            dependencies: t.dependencies.filter(d => d !== taskId)
          };
        }
        return t;
      });

      return {
        ...prev,
        tasks: cleanTasks
      };
    });

    setSelectedTask(null);
  };

  const handleSaveSettings = (newSettings: AiSettings) => {
    setData(prev => ({
      ...prev,
      settings: newSettings
    }));
  };

  const handleSaveSummary = (summary: { id: string; date: string; periodStart: string; periodEnd: string; type: 'weekly' | 'monthly'; content: string; experimentId?: string }) => {
    setData(prev => ({
      ...prev,
      savedSummaries: [...(prev.savedSummaries || []), summary]
    }));
  };

  // --- Import Logic ---
  const handleImportJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const rawData = JSON.parse(event.target?.result as string);
          const validatedData = validateAndMigrateAppData(rawData);
          // Instead of setting immediately, set candidate for Modal
          setImportCandidate(validatedData);
        } catch (error: any) {
          showError(t.importExport.importError, error.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleMergeImport = () => {
    if (!importCandidate) return;

    // We need to re-ID imported experiments and tasks to avoid collisions
    const expIdMap = new Map<string, string>();
    const newExperiments: Experiment[] = [];

    importCandidate.experiments.forEach(exp => {
      const newId = generateUUID();
      expIdMap.set(exp.id, newId);
      newExperiments.push({ ...exp, id: newId });
    });

    const newTasks: Task[] = [];
    importCandidate.tasks.forEach(task => {
      const newExpId = expIdMap.get(task.experimentId);
      if (newExpId) {
        newTasks.push({
          ...task,
          id: generateUUID(),
          experimentId: newExpId,
          // We intentionally break dependencies within imported block for simplicity in merge, 
          // or we would need to map task IDs too. For this version, we clear dependencies 
          // to avoid pointing to non-existent IDs.
          dependencies: []
        });
      }
    });

    setData(prev => ({
      ...prev,
      experiments: [...prev.experiments, ...newExperiments],
      tasks: [...prev.tasks, ...newTasks]
    }));

    setImportCandidate(null);
    showSuccess(t.common.success, t.importExport.importSuccess.replace('{experiments}', newExperiments.length.toString()).replace('{tasks}', newTasks.length.toString()));
  };

  const handleReplaceImport = () => {
    if (!importCandidate) return;
    setData(importCandidate);
    setImportCandidate(null);
    showSuccess(t.common.success, t.importExport.replaceSuccess);
  };

  // --- AI Actions Logic ---
  const handleAiActionConfirmed = (aiAction: any) => {
    // Note: Using 'any' for aiAction temporarily if type is not imported, but maintaining logic.
    // Ideally import TableAiAction from where it is defined.
    const { action, payload } = aiAction;

    if (action === 'add_task') {
      const expId = payload.experimentId || data.experiments[0]?.id;
      if (!expId) return;

      const weekId = normalizeToSunday(addWeeks(new Date(), payload.weekOffset || 0));
      const newTask: Task = {
        id: generateUUID(),
        experimentId: expId,
        title: payload.taskData?.title || t.common.new + ' AI',
        description: payload.taskData?.description || '',
        weekId,
        status: TaskStatus.DEFAULT,
        importance: 3,
        completed: false,
        tags: [],
        attachments: [],
        dependencies: []
      };

      setData(prev => ({
        ...prev,
        tasks: [...prev.tasks, newTask]
      }));
    } else if (action === 'delete_task' && payload.taskId) {
      handleDeleteTask(payload.taskId);
    }
  };

  const handleUndo = () => {
    if (lastUndoAction) {
      lastUndoAction();
    }
  };

  const handleExportJson = () => {
    downloadJson(data, "labpulse_backup_" + new Date().toISOString().split('T')[0] + ".json");
  };

  const handleExportCsv = () => {
    const headers = [t.csv.experiment, t.csv.task, t.csv.week, t.csv.status, t.csv.importance, t.csv.completed].map(csvEscape);
    const rows = data.tasks.map(t => {
      const exp = data.experiments.find(e => e.id === t.experimentId);
      return [
        exp?.name || t.common.notImplemented,
        t.title,
        t.weekId,
        t.status,
        t.importance,
        t.completed ? t.csv.yes : t.csv.no
      ].map(csvEscape).join(',');
    });
    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'labpulse_tasks.csv');
    link.click();
  };


  if (loading || (user && !isGuest && checkingWhitelist)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Whitelist Gate (New)
  if (user && isWhitelisted === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700 text-center">
          <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{t.auth.accessDenied}</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            {t.auth.accessDeniedMessage.replace('{email}', user.email || '')}
          </p>
          <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4">
            <button onClick={signOut} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg transition-colors">
              {t.auth.logout}
            </button>
          </div>
        </div>
      </div>

    );
  }

  if (!user && !isGuest) {
    return <Login />;
  }

  if (user && !user.emailVerified && !isGuest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700 text-center">
          <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">{t.auth.verificationRequired}</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            {t.auth.verificationMessage.replace('{email}', user.email || '')}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl transition-all"
            >
              {t.auth.alreadyVerified}
            </button>
            <button
              onClick={() => user.reload().then(() => { if (user.emailVerified) window.location.reload(); })}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t.auth.checkAgain}
            </button>
            <button
              onClick={async () => {
                try {
                  await sendEmailVerification(user);
                  showSuccess(t.common.success, t.auth.emailSentAgain);
                } catch (e: any) {
                  if (e.code === 'auth/too-many-requests') {
                    showError(t.common.error, t.auth.tooManyRequests);
                  } else {
                    showError(t.common.error, t.auth.emailError + ': ' + e.message);
                  }
                }
              }}
              className="text-sm text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
            >
              {t.auth.resendEmail}
            </button>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button onClick={signOut} className="text-sm text-slate-500 hover:text-red-600">
              {t.auth.logoutAndReturn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors">
      <Header
        onNewExperiment={() => setWizardOpen(true)}
        onWeeklySummary={() => setSummaryType('weekly')}
        onMonthlySummary={() => setSummaryType('monthly')}
        onSettings={() => setSettingsOpen(true)}
        onOpenAdmin={() => setAdminOpen(true)}
        onImport={handleImportJson}
        onExport={handleExportJson}
        onExportCsv={handleExportCsv}
        onOpenArchive={() => setArchiveOpen(true)}
        onJumpToToday={() => setViewOffset(0)}
        viewOffset={viewOffset}
        isAdmin={!!isWhitelisted}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <Board
          experiments={data.experiments}
          tasks={data.tasks}
          hiddenWeeks={data.hiddenWeeks}
          viewOffset={viewOffset}
          onViewOffsetChange={setViewOffset}
          onAddTask={handleAddTask}
          onEditTask={(id) => setSelectedTask(data.tasks.find(t => t.id === id) || null)}
          onOpenExperiment={(id) => setSelectedExperiment(data.experiments.find(e => e.id === id) || null)}
          onMoveExperiment={handleMoveExperiment}
        />

        <TableAiAssistant
          settings={currentSettings}
          experiments={data.experiments}
          tasks={data.tasks}
          onActionConfirmed={handleAiActionConfirmed}
          onUndo={handleUndo}
          canUndo={!!lastUndoAction}
        />
      </main>

      {/* Import Conflict Modal */}
      {importCandidate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowDownOnSquareIcon className="w-5 h-5 text-indigo-600" />
                {t.importExport.title}
              </h3>
              <button onClick={() => setImportCandidate(null)} className="text-slate-400">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-600 dark:text-slate-300">
                {t.importExport.foundDataMessage.replace('{experiments}', importCandidate.experiments.length.toString()).replace('{tasks}', importCandidate.tasks.length.toString())}
                <br />
                {t.importExport.howToProceed}
              </p>

              <div className="grid gap-3">
                <button
                  onClick={handleMergeImport}
                  className="flex items-center gap-3 p-4 border border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-800 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-right group"
                >
                  <div className="bg-indigo-200 dark:bg-indigo-800 p-2 rounded-lg text-indigo-700 dark:text-indigo-200">
                    <DocumentDuplicateIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="block font-bold text-indigo-900 dark:text-indigo-100">{t.importExport.merge}</span>
                    <span className="text-xs text-indigo-700 dark:text-indigo-300">{t.importExport.mergeDesc}</span>
                  </div>
                </button>

                <button
                  onClick={handleReplaceImport}
                  className="flex items-center gap-3 p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-right group"
                >
                  <div className="bg-red-200 dark:bg-red-800 p-2 rounded-lg text-red-700 dark:text-red-200">
                    <TrashIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="block font-bold text-red-900 dark:text-red-100">{t.importExport.replace}</span>
                    <span className="text-xs text-red-700 dark:text-red-300">{t.importExport.replaceDesc}</span>
                  </div>
                </button>
              </div>
            </div>
            <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button onClick={() => setImportCandidate(null)} className="text-sm font-bold text-slate-500 hover:text-slate-700 px-4 py-2">
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {wizardOpen && (
        <ExperimentWizard
          settings={currentSettings}
          onClose={() => setWizardOpen(false)}
          onSave={handleSaveExperiment}
        />
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <TaskModal
            task={selectedTask}
            allTasks={data.tasks}
            experimentName={data.experiments.find(e => e.id === selectedTask.experimentId)?.name}
            settings={currentSettings}
            onClose={() => setSelectedTask(null)}
            onSave={handleUpdateTask}
            onDelete={handleDeleteTask}
          />
        </div>
      )}

      {selectedExperiment && (
        <ExperimentDetailsModal
          experiment={selectedExperiment}
          settings={currentSettings}
          onClose={() => setSelectedExperiment(null)}
          onSave={handleUpdateExperiment}
          onArchive={handleArchiveExperiment}
          onShiftTimeline={handleShiftExperimentTimeline}
          onDelete={handleDeleteExperiment}
          onResetTasks={handleResetExperimentTasks}
          onDeleteTask={handleDeleteTask}
          tasks={data.tasks}
        />
      )}

      {archiveOpen && (
        <ArchiveModal
          experiments={data.experiments}
          onClose={() => setArchiveOpen(false)}
          onRestore={handleRestoreExperiment}
        />
      )}

      {summaryType && (
        <SummaryModals
          type={summaryType}
          allTasks={data.tasks}
          experiments={data.experiments}
          settings={currentSettings}
          onClose={() => setSummaryType(null)}
          savedSummaries={data.savedSummaries}
          onSaveSummary={handleSaveSummary}
        />
      )}

      {settingsOpen && (
        <Settings
          settings={currentSettings}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {adminOpen && (
        <AdminModal onClose={() => setAdminOpen(false)} />
      )}
    </div>
  );
};

export default App;
