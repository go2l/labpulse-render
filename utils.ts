
import { format, startOfWeek, addWeeks, parseISO, isSameDay, differenceInWeeks } from 'date-fns';
import { he } from 'date-fns/locale';
import { AppData, Task, Experiment, TaskStatus, AiSettings } from './types';
import { AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS } from './constants';

export const normalizeToSunday = (date: Date | string): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(startOfWeek(d, { weekStartsOn: 0 }), 'yyyy-MM-dd');
};

export const getWeekDisplay = (dateStr: string) => {
  const d = parseISO(dateStr);
  return format(d, 'dd/MM', { locale: he });
};

export const getWeeksDifference = (start: string, end: string): number => {
  return Math.abs(differenceInWeeks(parseISO(end), parseISO(start))) + 1;
};

export const generateUUID = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const getLocalStorage = <T,>(key: string, defaultValue: T): T => {
  const stored = localStorage.getItem(key);
  if (!stored) return defaultValue;
  try {
    return JSON.parse(stored);
  } catch {
    return defaultValue;
  }
};

export const setLocalStorage = <T,>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const downloadJson = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

/**
 * Escapes a value for CSV format.
 * Wraps in quotes if it contains commas, quotes, or newlines.
 * Escapes existing quotes with double quotes.
 */
export const csvEscape = (value: unknown): string => {
  const str = String(value ?? "");
  const needsQuotes = /[",\n\r]/.test(str);
  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Validates and migrate imported AppData.
 */
export const validateAndMigrateAppData = (imported: any): AppData => {
  if (typeof imported !== 'object' || !imported) {
    throw new Error("Invalid file format: content is not a JSON object.");
  }

  // Basic structure check
  if (!Array.isArray(imported.experiments)) {
    throw new Error("Invalid format: 'experiments' array missing.");
  }
  if (!Array.isArray(imported.tasks)) {
    throw new Error("Invalid format: 'tasks' array missing.");
  }

  // Migration / Sanitization
  const cleanExperiments: Experiment[] = imported.experiments.map((e: any) => ({
    id: e.id || generateUUID(),
    name: e.name || "Untitled Experiment",
    description: e.description || "",
    collaborators: Array.isArray(e.collaborators) ? e.collaborators : [],
    startDate: e.startDate || normalizeToSunday(new Date()),
    endDate: e.endDate,
    expectedWeeks: typeof e.expectedWeeks === 'number' ? e.expectedWeeks : 4,
    status: e.status === 'archived' ? 'archived' : 'active',
    attachments: Array.isArray(e.attachments) ? e.attachments : [],
    proposalText: e.proposalText || "",
    originalPlan: Array.isArray(e.originalPlan) ? e.originalPlan : undefined,
    style: e.style,
    aiInsights: Array.isArray(e.aiInsights) ? e.aiInsights : []
  }));

  const validExpIds = new Set(cleanExperiments.map(e => e.id));
  const processedTaskIds = new Set<string>();

  const cleanTasks: Task[] = imported.tasks.reduce((acc: Task[], t: any) => {
    // 1. Ensure Task has ID
    const tId = t.id || generateUUID();

    // 2. Remove duplicate IDs
    if (processedTaskIds.has(tId)) return acc;
    processedTaskIds.add(tId);

    // 3. Remove orphaned tasks (experiment no longer exists)
    if (!validExpIds.has(t.experimentId)) return acc;

    const newTask: Task = {
      id: tId,
      experimentId: t.experimentId,
      title: t.title || "Untitled Task",
      description: t.description || "",
      weekId: t.weekId || normalizeToSunday(new Date()),
      status: t.status || TaskStatus.DEFAULT,
      importance: typeof t.importance === 'number' ? t.importance : 3,
      completed: !!t.completed,
      tags: Array.isArray(t.tags) ? t.tags : [],
      attachments: Array.isArray(t.attachments) ? t.attachments : [],
      dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
      recurrenceGroupId: t.recurrenceGroupId,
      planTaskId: t.planTaskId
    };
    acc.push(newTask);
    return acc;
  }, []);

  const migratedSettings: AiSettings = imported.settings || getLocalStorage(AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS);

  return {
    experiments: cleanExperiments,
    tasks: cleanTasks,
    schemaVersion: 1, // Current version
    hiddenWeeks: Array.isArray(imported.hiddenWeeks) ? imported.hiddenWeeks : [],
    settings: migratedSettings,
    savedSummaries: Array.isArray(imported.savedSummaries) ? imported.savedSummaries : []
  };
};

/**
 * Checks for circular dependencies using DFS.
 * Returns true if adding `newDependencyId` to `taskId` creates a cycle.
 */
export const hasCircularDependency = (allTasks: Task[], taskId: string, newDependencyId: string): boolean => {
  // If the task depends on itself
  if (taskId === newDependencyId) return true;

  const adj = new Map<string, string[]>();
  allTasks.forEach(t => adj.set(t.id, [...t.dependencies]));

  // Temporarily add the new dependency to the graph for checking
  const currentDeps = adj.get(taskId) || [];
  adj.set(taskId, [...currentDeps, newDependencyId]);

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const isCyclic = (curr: string): boolean => {
    visited.add(curr);
    recursionStack.add(curr);

    const neighbors = adj.get(curr) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (isCyclic(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(curr);
    return false;
  };

  // Check cycles starting from taskId
  return isCyclic(taskId);
};

/**
 * Checks if a task is blocked (has uncompleted dependencies).
 */
export const isTaskBlocked = (task: Task, allTasks: Task[]): boolean => {
  if (!task.dependencies || task.dependencies.length === 0) return false;

  return task.dependencies.some(depId => {
    const depTask = allTasks.find(t => t.id === depId);
    return depTask && !depTask.completed;
  });
};

/**
 * Parses basic Markdown (bold, italic, lists) to HTML.
 * Used for displaying AI summaries correctly.
 */
export const parseSimpleMarkdown = (text: string): string => {
  if (!text) return '';

  let html = text
    // Header level 3
    .replace(/^### (.*$)/gim, '<h3 class="font-bold text-lg mt-4 mb-2">$1</h3>')
    // Header level 2
    .replace(/^## (.*$)/gim, '<h2 class="font-bold text-xl mt-5 mb-2">$1</h2>')
    // Bold (**text**)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic (*text*)
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Unordered list
    .replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
    // New lines to line breaks
    .replace(/\n/g, '<br />');

  return html;
};
