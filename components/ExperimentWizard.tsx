
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

import { Experiment, AiSettings, Task, TaskStatus, ResearchPlanDraft, PlanTaskItem, RecurrenceConfig, ChatMessage } from '../types';
import { generatePlanFromProposal, runProposalChat, generatePlanFromProposalAndChat, refineResearchPlan } from '../geminiService';
import { useError } from '../contexts/ErrorContext';
import { generateUUID, normalizeToSunday, getWeeksDifference } from '../utils';
import {
  XMarkIcon,
  DocumentTextIcon,
  CheckIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  ArrowPathRoundedSquareIcon,

  CalendarDaysIcon,
  ClockIcon,
  ChatBubbleBottomCenterTextIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import { addWeeks, parseISO, differenceInWeeks, format } from 'date-fns';
import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';

const pdfjs = (pdfjsLib as any).default || pdfjsLib;
if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
}

const mammothLib = (mammoth as any).default || mammoth;

interface WizardProps {
  settings: AiSettings;
  onClose: () => void;
  onSave: (experiment: Experiment, tasks: Task[]) => void;
}

// Editable task draft structure (Enhanced)
interface EditableTask extends PlanTaskItem {
  isSelected: boolean;
  originalDependencyIndex?: number;
}

const ExperimentWizard: React.FC<WizardProps> = ({ settings, onClose, onSave }) => {
  const { t, language } = useLanguage();
  const { showError } = useError();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const [basicData, setBasicData] = useState({
    name: '',
    description: '',
    startDate: normalizeToSunday(new Date()),
    endDate: ''
  });

  const [proposalText, setProposalText] = useState('');
  const [planDraft, setPlanDraft] = useState<ResearchPlanDraft | null>(null);

  const [draftTasks, setDraftTasks] = useState<EditableTask[]>([]);

  // Chat State


  const [showChat, setShowChat] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false); // For background refinement
  const [backgroundPlanLoading, setBackgroundPlanLoading] = useState(false); // For initial background generation

  // State for the "Full Edit" modal inside step 3
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null);
  // Toggle for date input method in edit modal
  const [dateInputMode, setDateInputMode] = useState<'week_offset' | 'specific_date'>('week_offset');

  // Reset date input mode when opening a new task
  useEffect(() => {
    if (editingTask) {
      setDateInputMode('week_offset');
    }
  }, [editingTask?.id]);

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  const extractTextFromDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    if (!mammothLib.extractRawText) {
      throw new Error("Mammoth library not loaded correctly");
    }
    const result = await mammothLib.extractRawText({ arrayBuffer });
    return result.value;
  };

  const processFile = async (file: File) => {
    setParsingFile(true);
    setFileError(null);

    try {
      let text = '';
      if (file.type === 'application/pdf') {
        text = await extractTextFromPdf(file);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        text = await extractTextFromDocx(file);
      } else if (file.type === 'text/plain') {
        text = await file.text();
      } else {
        throw new Error(t.common.error);
      }
      if (!text.trim()) throw new Error(t.common.error);
      setProposalText(text);
    } catch (error: any) {
      console.error("File parsing error:", error);
      setFileError(error.message || t.common.error);
    } finally {
      setParsingFile(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  // Background Plan Generation Trigger
  useEffect(() => {
    const triggerBackgroundGen = async () => {
      if (proposalText && step === 2 && !planDraft && !backgroundPlanLoading) {
        setBackgroundPlanLoading(true);
        try {
          console.log("Starting background plan generation...");
          const draft = await generatePlanFromProposal(settings, proposalText, t, language);
          setPlanDraft(draft);
          // We do NOT processAiDraft into task list yet, we just keep the draft for refinement
          console.log("Background plan generated!");
        } catch (e) {
          console.error("Background gen failed", e);
        } finally {
          setBackgroundPlanLoading(false);
        }
      }
    };

    // Debounce slightly to avoid triggering while typing
    const timer = setTimeout(triggerBackgroundGen, 2000);
    return () => clearTimeout(timer);
  }, [proposalText, step]);


  const processAiDraft = (draft: ResearchPlanDraft) => {
    const processedTasks: EditableTask[] = [];

    draft.tasks.forEach((task, index) => {
      // Convert AI simple recurrence to Interval Recurrence
      let recurrence: RecurrenceConfig | undefined = undefined;
      if (task.recurrence && task.recurrence.count > 1) {
        recurrence = {
          type: 'interval',
          intervalWeeks: 1, // Default to every week
          durationWeeks: task.recurrence.count // Total duration
        };
      }

      processedTasks.push({
        id: generateUUID(),
        title: task.title,
        description: task.description,
        weekOffset: task.weekOffset,
        importance: task.importance,
        status: (task.status as TaskStatus) || TaskStatus.DEFAULT,
        isSelected: true,
        recurrence: recurrence,
        dependencies: [],
        originalDependencyIndex: task.dependsOnTaskIndex && task.dependsOnTaskIndex.length > 0 ? task.dependsOnTaskIndex[0] : undefined
      });
    });

    // Simple dependency resolution
    processedTasks.forEach((pt, idx) => {
      if (pt.originalDependencyIndex !== undefined && processedTasks[pt.originalDependencyIndex]) {
        pt.dependencies = [processedTasks[pt.originalDependencyIndex].id];
      }
    });

    setDraftTasks(processedTasks);
  };

  const handleGeneratePlan = async () => {
    if (!proposalText) return;
    setLoading(true);
    try {
      const draft = await generatePlanFromProposal(settings, proposalText, t, language);
      setPlanDraft(draft);
      processAiDraft(draft);
      setStep(3);
    } catch (error) {
      showError(t.common.error, String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleAddManualTask = () => {
    setDraftTasks(prev => [
      ...prev,
      {
        id: generateUUID(),
        title: t.common.new,
        description: '',
        weekOffset: 0,
        importance: 3,
        status: TaskStatus.DEFAULT,
        isSelected: true,
        dependencies: []
      }
    ]);
  };

  const handleUpdateDraftTask = (id: string, updates: Partial<EditableTask>) => {
    setDraftTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const saveEditedTask = () => {
    if (editingTask) {
      handleUpdateDraftTask(editingTask.id, editingTask);
      setEditingTask(null);
    }
  };

  const handleStartChat = () => {
    if (!proposalText) return;
    setShowChat(true);
    // Initial system prompt or just wait for user? 
    // Usually best if AI starts interviewing.
    handleSendChatMessage(true);
  };

  const handleSendChatMessage = async (isInitial = false) => {
    if (!proposalText || (chatLoading)) return;
    if (!isInitial && !chatInput.trim()) return;

    const userMsgText = chatInput;
    const userMsg: ChatMessage | null = isInitial ? null : { role: 'user', text: userMsgText };

    // Optimistic UI update
    const newHistory = userMsg ? [...chatHistory, userMsg] : chatHistory;
    setChatHistory(newHistory);
    setChatInput('');
    setChatLoading(true);

    // Parallel Execution: 1. Chat Response, 2. Plan Refinement
    try {
      const chatPromise = runProposalChat(
        settings,
        proposalText,
        isInitial ? [] : newHistory,
        isInitial ? "Please start the interview." : userMsgText,
        t,
        language
      );

      const refinementPromise = (async () => {
        if (!isInitial && planDraft && !isRefining) {
          setIsRefining(true);
          try {
            const updatedDraft = await refineResearchPlan(settings, planDraft, proposalText, newHistory, userMsgText, t, language);
            setPlanDraft(updatedDraft);
          } catch (e) {
            console.error("Refinement failed", e);
          } finally {
            setIsRefining(false);
          }
        }
      })();

      const [aiResponseText] = await Promise.all([chatPromise, refinementPromise]);

      setChatHistory(prev => [...prev, { role: 'model', text: aiResponseText }]);
    } catch (error) {
      console.error(error);
      showError(t.common.error, t.common.errorOccurred || 'An error occurred while communicating with the AI.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleFinishChatAndGenerate = async () => {
    // If we already have a refined draft, just use it!
    if (planDraft) {
      processAiDraft(planDraft);
      setStep(3);
      setShowChat(false);
      return;
    }

    // Fallback if no draft yet
    if (!proposalText) return;
    setLoading(true);
    try {
      // We can pass the history to the final generation if we want a fresh start, 
      // but usually the refined plan is better.
      const draft = await generatePlanFromProposalAndChat(settings, proposalText, chatHistory, t, language);
      setPlanDraft(draft);
      processAiDraft(draft);
      setStep(3);
      setShowChat(false);
    } catch (error) {
      showError(t.common.error, String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    const experimentId = generateUUID();
    const finalTasks: Task[] = [];
    const selectedDrafts = draftTasks.filter(t => t.isSelected);

    // Save the plan logic for future rescheduling
    const masterPlan: PlanTaskItem[] = selectedDrafts.map(d => ({
      id: d.id,
      title: d.title,
      description: d.description,
      weekOffset: d.weekOffset,
      importance: d.importance,
      status: d.status,
      recurrence: d.recurrence,
      dependencies: d.dependencies
    }));

    selectedDrafts.forEach(draft => {
      if (draft.recurrence) {
        // Complex recurrence generation
        const { intervalWeeks, durationWeeks } = draft.recurrence;
        const groupId = generateUUID();
        let count = 0;

        // Loop: start at 0, continue while offset < duration
        for (let w = 0; w < durationWeeks; w += intervalWeeks) {
          finalTasks.push({
            id: generateUUID(),
            experimentId,
            title: `${draft.title} (${count + 1})`,
            description: draft.description,
            weekId: normalizeToSunday(addWeeks(parseISO(basicData.startDate), draft.weekOffset + w)),
            status: draft.status,
            importance: draft.importance,
            completed: false,
            tags: [],
            attachments: [],
            dependencies: [], // Dependencies on recurring tasks are complex, skipping auto-link for now
            recurrenceGroupId: groupId,
            planTaskId: draft.id
          });
          count++;
        }
      } else {
        // Single Task
        finalTasks.push({
          id: generateUUID(),
          experimentId,
          title: draft.title,
          description: draft.description,
          weekId: normalizeToSunday(addWeeks(parseISO(basicData.startDate), draft.weekOffset)),
          status: draft.status,
          importance: draft.importance,
          completed: false,
          tags: [],
          attachments: [],
          dependencies: [], // Resolve dependencies logic if needed
          planTaskId: draft.id
        });
      }
    });

    // Calculate duration
    let duration = basicData.startDate && basicData.endDate
      ? getWeeksDifference(basicData.startDate, basicData.endDate)
      : 4;

    const maxWeekId = finalTasks.reduce((max, t) => t.weekId > max ? t.weekId : max, '');
    if (maxWeekId) {
      const calcDuration = getWeeksDifference(basicData.startDate, maxWeekId);
      if (calcDuration > duration) duration = calcDuration;
    }

    const experiment: Experiment = {
      id: experimentId,
      name: basicData.name,
      description: basicData.description,
      collaborators: [],
      startDate: basicData.startDate,
      endDate: basicData.endDate,
      expectedWeeks: duration,
      status: 'active',
      attachments: [],
      proposalText,
      originalPlan: masterPlan // Save the Master Plan!
    };

    onSave(experiment, finalTasks);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-2 md:mx-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="text-xl font-bold text-slate-900">{t.wizard.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 relative">

          {step === 1 && (
            <div className="space-y-6 max-w-xl mx-auto">
              <h3 className="text-lg font-semibold text-slate-800">{t.wizard.step1}</h3>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">{t.wizard.experimentName} *</label>
                <input
                  type="text"
                  value={basicData.name}
                  onChange={e => setBasicData({ ...basicData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder=""
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">{t.wizard.description}</label>
                <textarea
                  value={basicData.description}
                  onChange={e => setBasicData({ ...basicData, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t.wizard.startDate}</label>
                  <input
                    type="date"
                    value={basicData.startDate}
                    onChange={e => setBasicData({ ...basicData, startDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t.wizard.endDate} ({t.wizard.optional})</label>
                  <input
                    type="date"
                    value={basicData.endDate}
                    min={basicData.startDate}
                    onChange={e => setBasicData({ ...basicData, endDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && !showChat && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <DocumentTextIcon className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{t.wizard.step2}</h3>
                  <p className="text-sm text-slate-500">{t.wizard.analyzingInfo}</p>
                </div>
              </div>

              <div
                className={`border-2 border-dashed rounded-2xl p-6 transition-colors text-center ${fileError ? 'border-red-300 bg-red-50' : isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".txt,.pdf,.docx"
                  onChange={handleFileUpload}
                  disabled={parsingFile}
                />
                <label htmlFor="file-upload" className={`cursor-pointer ${parsingFile ? 'opacity-50' : ''}`}>
                  {parsingFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <ArrowPathIcon className="w-6 h-6 animate-spin text-indigo-600" />
                      <span className="text-indigo-600 font-bold">{t.common.loading}</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-slate-600 font-medium">{isDragActive ? t.wizard.dropFileActive : t.wizard.dropFile}</p>
                      <p className="text-xs text-slate-400 mt-1">{t.wizard.dropFile}</p>
                    </>
                  )}
                </label>
                {fileError && <div className="text-red-600 mt-2">{fileError}</div>}
              </div>

              <textarea
                value={proposalText}
                onChange={e => setProposalText(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-2 outline-none h-48 resize-none font-mono text-sm"
                placeholder={t.wizard.pasteText}
              />
            </div>
          )}

          {step === 2 && showChat && (
            <div className="flex bg-slate-50 rounded-xl border border-slate-200 overflow-hidden h-[600px]">
              {/* Left Column: Chat */}
              <div className="flex-1 flex flex-col border-r border-slate-200 min-w-0">
                <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm shrink-0">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600">
                      <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                    </div>
                    AI Research Assistant
                  </h3>
                  <button onClick={() => setShowChat(false)} className="text-xs text-slate-500 hover:text-indigo-600 underline">
                    {t.common.back}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatHistory.length === 0 && chatLoading && (
                    <div className="flex justify-center py-8">
                      <span className="text-slate-400 text-sm animate-pulse">Initializing interview...</span>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                        }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {chatLoading && chatHistory.length > 0 && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none shadow-sm">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
                      placeholder="Type your answer..."
                      disabled={chatLoading}
                      className="w-full border border-slate-300 rounded-xl pl-4 pr-12 py-3 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm disabled:bg-slate-50"
                    />
                    <button
                      onClick={() => handleSendChatMessage()}
                      disabled={!chatInput.trim() || chatLoading}
                      className="absolute right-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
                    >
                      <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Plan Preview */}
              <div className="w-1/3 bg-slate-50 flex flex-col min-w-[300px] border-l border-slate-200 hidden md:flex">
                <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-green-600" />
                    <span className="font-bold text-slate-700 text-sm">Live Plan Preview</span>
                  </div>
                  {(backgroundPlanLoading || isRefining) && (
                    <div className="flex items-center gap-1 text-xs text-indigo-600 animate-pulse">
                      <ArrowPathIcon className="w-3 h-3 animate-spin" />
                      {backgroundPlanLoading ? "Building..." : "Refining..."}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {!planDraft ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 opacity-50">
                      <DocumentTextIcon className="w-12 h-12" />
                      <p className="text-center text-sm">Identifying tasks...</p>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in duration-500">
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Objectives</h4>
                        <ul className="space-y-1">
                          {planDraft.objectives.slice(0, 3).map((obj, i) => (
                            <li key={i} className="text-xs text-slate-700 bg-white p-2 rounded border border-slate-100 shadow-sm">
                              {obj}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Phases</h4>
                        <div className="space-y-2">
                          {planDraft.phases.map((phase, i) => (
                            <div key={i} className="text-xs bg-white p-2 rounded border border-slate-100 flex justify-between items-center shadow-sm">
                              <span className="font-medium text-slate-800">{phase.name}</span>
                              <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px]">{phase.durationWeeks}w</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Tasks Overview ({planDraft.tasks.length})</h4>
                        <div className="space-y-1">
                          {planDraft.tasks.slice(0, 5).map((task, i) => (
                            <div key={i} className="text-xs text-slate-600 truncate pl-2 border-l-2 border-indigo-200">
                              {task.title}
                            </div>
                          ))}
                          {planDraft.tasks.length > 5 && (
                            <div className="text-[10px] text-slate-400 pl-2">
                              + {planDraft.tasks.length - 5} more...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-slate-200 bg-white shrink-0">
                  <button
                    onClick={handleFinishChatAndGenerate}
                    className="w-full py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 text-sm transition-colors border border-indigo-200"
                  >
                    Use This Plan &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && planDraft && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{t.wizard.step3}</h3>
                  <p className="text-sm text-slate-500">{t.wizard.aiIdentifiedTasks.replace('{count}', draftTasks.length.toString())}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-3 w-10 text-center">
                          <input type="checkbox" className="rounded border-slate-300" checked={draftTasks.every(t => t.isSelected)} onChange={e => {
                            const val = e.target.checked;
                            setDraftTasks(prev => prev.map(t => ({ ...t, isSelected: val })));
                          }} />
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase w-20">{t.taskModal.weekOffset}</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase min-w-[120px]">{t.taskModal.name}</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase w-48 hidden sm:table-cell">{t.wizard.recurrenceColumn}</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase w-24 hidden sm:table-cell">{t.taskModal.importance}</th>
                        <th className="px-3 py-3 text-right text-xs font-bold text-slate-500 uppercase w-24">{t.common.edit}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {draftTasks.map((task) => (
                        <tr key={task.id} className={`hover:bg-slate-50 transition-colors ${!task.isSelected ? 'opacity-50 grayscale' : ''}`}>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={task.isSelected}
                              onChange={(e) => handleUpdateDraftTask(task.id, { isSelected: e.target.checked })}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-400">{t.wizard.week}</span>
                              <span className="font-bold text-sm bg-slate-100 px-2 py-0.5 rounded">{task.weekOffset}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="block text-sm font-bold text-slate-800">{task.title}</span>
                            <span className="block text-xs text-slate-500 truncate max-w-[200px]">{task.description}</span>
                            <div className="sm:hidden mt-1 flex gap-2">
                              {task.importance >= 4 && <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded">P{task.importance}</span>}
                            </div>
                          </td>
                          <td className="px-3 py-3 hidden sm:table-cell">
                            {task.recurrence ? (
                              <div className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-lg border border-purple-100 inline-flex flex-col">
                                <span className="font-bold">{t.wizard.everyXWeeks.replace('{interval}', task.recurrence.intervalWeeks.toString())}</span>
                                <span className="text-[10px] opacity-80">{t.wizard.forDurationWeeks.replace('{duration}', task.recurrence.durationWeeks.toString())}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">{t.wizard.oneTime}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 hidden sm:table-cell">
                            <div className={`text-xs font-bold px-2 py-1 rounded text-center
                             ${task.importance >= 4 ? 'bg-red-100 text-red-700' : task.importance >= 2 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}
                           `}>
                              P{task.importance}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setEditingTask(task)}
                                className="text-slate-400 hover:text-indigo-600 p-1 bg-slate-100 rounded-lg transition-colors"
                                title={t.wizard.fullEdit}
                              >
                                <PencilSquareIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDraftTasks(prev => prev.filter(t => t.id !== task.id))}
                                className="text-slate-400 hover:text-red-500 p-1"
                                title={t.common.delete}
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={handleAddManualTask}
                  className="w-full py-3 text-center text-sm font-bold text-indigo-600 hover:bg-indigo-50 border-t border-slate-200 flex items-center justify-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  {t.wizard.addManualTask}
                </button>
              </div>
            </div>
          )}

          {/* Edit Modal Overlay (Inside Wizard) */}
          {editingTask && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col animate-in fade-in duration-200">
              <div className="px-4 md:px-8 py-4 md:py-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
                  <PencilSquareIcon className="w-6 h-6 text-indigo-600" />
                  {t.wizard.editTaskTitle}
                </h3>
                <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-slate-600">
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 md:p-8 space-y-6 flex-1 overflow-y-auto max-w-3xl mx-auto w-full">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t.wizard.taskTitle}</label>
                  <input
                    type="text"
                    value={editingTask.title}
                    onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-bold text-slate-700">{t.wizard.timingStart}</label>
                      <div className="flex bg-slate-100 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setDateInputMode('week_offset')}
                          className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${dateInputMode === 'week_offset' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                          {t.wizard.byWeek}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDateInputMode('specific_date')}
                          className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${dateInputMode === 'specific_date' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                          {t.wizard.byDate}
                        </button>
                      </div>
                    </div>

                    {dateInputMode === 'week_offset' ? (
                      <div className="relative">
                        <input
                          type="number" min="0"
                          value={editingTask.weekOffset}
                          onChange={e => setEditingTask({ ...editingTask, weekOffset: parseInt(e.target.value) })}
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 outline-none pl-12"
                        />
                        <span className="absolute right-4 top-2 text-sm text-slate-400">{t.wizard.weekPlus}</span>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="date"
                          min={basicData.startDate}
                          value={format(addWeeks(parseISO(basicData.startDate), editingTask.weekOffset), 'yyyy-MM-dd')}
                          onChange={(e) => {
                            if (e.target.value) {
                              const newDate = parseISO(e.target.value);
                              const start = parseISO(basicData.startDate);
                              const diff = Math.max(0, differenceInWeeks(newDate, start));
                              setEditingTask({ ...editingTask, weekOffset: diff });
                            }
                          }}
                          className="w-full border border-slate-300 rounded-xl px-4 py-2 outline-none"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">{t.wizard.importance}</label>
                    <select
                      value={editingTask.importance}
                      onChange={e => setEditingTask({ ...editingTask, importance: parseInt(e.target.value) })}
                      className="w-full border border-slate-300 rounded-xl px-4 py-2 outline-none bg-white"
                    >
                      {[1, 2, 3, 4, 5].map(v => <option key={v} value={v}>P{v} - {v === 5 ? t.wizard.importanceCritical : v === 1 ? t.wizard.importanceLow : t.wizard.importanceNormal}</option>)}
                    </select>
                  </div>
                </div>

                <div className="bg-purple-50 p-6 rounded-xl border border-purple-100 space-y-4">
                  <div className="flex items-center gap-2">
                    <ArrowPathRoundedSquareIcon className="w-6 h-6 text-purple-700" />
                    <label className="text-lg font-bold text-purple-900">{t.wizard.recurrenceSettings}</label>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!editingTask.recurrence}
                        onChange={(e) => setEditingTask({
                          ...editingTask,
                          recurrence: e.target.checked ? { type: 'interval', intervalWeeks: 1, durationWeeks: 4 } : undefined
                        })}
                        className="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm font-bold text-purple-800">{t.wizard.repeatTask}</span>
                    </label>
                  </div>

                  {editingTask.recurrence && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 pt-2 border-t border-purple-200">
                      <div>
                        <label className="block text-xs font-bold text-purple-700 mb-1">{t.wizard.frequency}</label>
                        <div className="relative">
                          <input
                            type="number" min="1" max="52"
                            value={editingTask.recurrence.intervalWeeks}
                            onChange={(e) => setEditingTask({
                              ...editingTask,
                              recurrence: { ...editingTask.recurrence!, intervalWeeks: parseInt(e.target.value) }
                            })}
                            className="w-full border-purple-300 rounded-lg px-4 py-2 outline-none focus:border-purple-500 font-bold"
                          />
                          <span className="absolute left-3 top-2.5 text-xs text-purple-400">{t.wizard.frequencyWeeks}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-purple-700 mb-1">{t.wizard.durationTotal}</label>
                        <div className="relative">
                          <input
                            type="number" min="1" max="100"
                            value={editingTask.recurrence.durationWeeks}
                            onChange={(e) => setEditingTask({
                              ...editingTask,
                              recurrence: { ...editingTask.recurrence!, durationWeeks: parseInt(e.target.value) }
                            })}
                            className="w-full border-purple-300 rounded-lg px-4 py-2 outline-none focus:border-purple-500 font-bold"
                          />
                          <span className="absolute left-3 top-2.5 text-xs text-purple-400">{t.wizard.durationWeeks}</span>
                        </div>
                        <p className="text-[10px] text-purple-600 mt-1">
                          {t.wizard.totalTasksEstimation.replace('{count}', Math.ceil(editingTask.recurrence.durationWeeks / editingTask.recurrence.intervalWeeks).toString())}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">{t.wizard.fullDescription}</label>
                  <textarea
                    value={editingTask.description}
                    onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none h-40 resize-none"
                    placeholder={t.wizard.fullDescriptionPlaceholder}
                  />
                </div>
              </div>
              <div className="px-4 md:px-8 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-wrap">
                <button
                  onClick={() => setEditingTask(null)}
                  className="px-6 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-100"
                >
                  {t.wizard.cancel}
                </button>
                <button
                  onClick={saveEditedTask}
                  className="px-6 py-2 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700 shadow-sm flex items-center gap-2"
                >
                  <CheckIcon className="w-5 h-5" />
                  {t.wizard.saveChanges}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-4 md:px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={`w-3 h-3 rounded-full ${step === s ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {step > 1 && !editingTask && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 md:px-6 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 text-sm md:text-base"
              >
                {t.wizard.back}
              </button>
            )}
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={!basicData.name}
                className="px-4 md:px-6 py-2 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 text-sm md:text-base"
              >
                {t.wizard.continue}
              </button>
            )}
            {step === 2 && !showChat && (
              <div className="flex gap-2 flex-col sm:flex-row">
                <button
                  onClick={() => handleFinish()}
                  className="px-6 py-2 rounded-xl border border-indigo-600 text-indigo-600 font-bold hover:bg-indigo-50 text-sm md:text-base"
                >
                  {t.wizard.skipAi}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleStartChat}
                    disabled={loading || !proposalText}
                    className="px-6 py-2 rounded-xl bg-violet-600 font-bold text-white hover:bg-violet-700 flex items-center gap-2 justify-center text-sm md:text-base shadow-sm"
                  >
                    <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                    <span>Start Interview</span>
                  </button>
                  <button
                    onClick={handleGeneratePlan}
                    disabled={loading || !proposalText}
                    className="px-6 py-2 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700 flex items-center gap-2 justify-center text-sm md:text-base shadow-sm"
                  >
                    {loading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <DocumentTextIcon className="w-5 h-5" />}
                    <span>{t.wizard.createAiPlan}</span>
                  </button>
                </div>
              </div>
            )}
            {step === 3 && !editingTask && (
              <button
                onClick={handleFinish}
                className="px-6 py-2 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700 flex items-center gap-2 text-sm md:text-base"
              >
                <CheckIcon className="w-5 h-5" />
                <span>{t.wizard.finishAndAdd}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExperimentWizard;
