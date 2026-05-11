
export enum TaskStatus {
  DEFAULT = 'default',
  IMPORTANT = 'important',
  WARNING = 'warning',
  INFO = 'info',
  COMPLETED = 'completed'
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
}

export interface RecurrenceConfig {
  type: 'interval';
  intervalWeeks: number; // Every X weeks
  durationWeeks: number; // For a total of Y weeks
}

export interface PlanTaskItem {
  id: string;
  title: string;
  description: string;
  weekOffset: number;
  importance: number;
  status: TaskStatus;
  recurrence?: RecurrenceConfig;
  dependencies: string[];
}

export interface Task {
  id: string;
  experimentId: string;
  title: string;
  description: string;
  weekId: string; // Sunday YYYY-MM-DD
  status: TaskStatus;
  importance: number; // 1-5
  completed: boolean;
  tags: string[];
  attachments: Attachment[];
  dependencies: string[]; // taskIds
  recurrenceGroupId?: string;
  planTaskId?: string; // Link back to the original plan item
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  collaborators: string[];
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  expectedWeeks: number;
  status: 'active' | 'archived';
  attachments: Attachment[];
  proposalText?: string;
  originalPlan?: PlanTaskItem[]; // Persist the master plan
  style?: {
    backgroundColor?: string;
    textColor?: string;
  };
  aiInsights?: string[]; // Persist AI generated questions/insights
  chatHistory?: ChatMessage[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AppData {
  experiments: Experiment[];
  tasks: Task[];
  schemaVersion: number;
  hiddenWeeks: string[];
  settings?: AiSettings;
  savedSummaries?: SavedSummary[]; // Persisted Weekly/Monthly summaries
}

export interface SavedSummary {
  id: string;
  date: string; // ISO string of when it was generated
  periodStart: string;
  periodEnd: string;
  type: 'weekly' | 'monthly';
  content: string;
  experimentId?: string; // If filtered by experiment
}

export interface AiSettings {
  apiKey: string;
  mockMode: boolean;
  rememberApiKey: boolean;
  modelText: string;
  modelStructured: string;
  temperature: number;
  numGuidingQuestions: number;
  // Appearance Settings
  theme: 'light' | 'dark';
  fontSize: 'normal' | 'large' | 'xl';
  // AI Persona & Style Settings
  aiStyle: 'professional' | 'academic' | 'casual' | 'concise_technical';
  aiDetailLevel: 'concise' | 'balanced' | 'comprehensive';
  aiLanguage: string; // e.g. 'Hebrew', 'English'
  customSystemInstructions: string; // Free text for global instructions
  // Explicit Content Control
  showAssumptions: boolean;
  showMethodology: boolean;
  showReservations: boolean;
}

export interface TableAiAction {
  action: 'add_experiment' | 'add_task' | 'edit_task' | 'delete_task' | 'query' | 'none';
  // Detailed payload for the action
  payload: {
    experimentId?: string; // For adding task to exp, or editing exp
    taskId?: string;      // For editing/deleting task
    taskData?: Partial<Task>; // For adding/editing task (title, status, etc.)
    experimentData?: Partial<Experiment>; // For adding experiment
    weekOffset?: number; // For adding task relative to today (0 = this week, 1 = next week)
  };
  textResponse: string;
  confidence?: number;
}

export interface ResearchPlanDraft {
  objectives: string[];
  phases: { name: string; durationWeeks: number }[];
  tasks: {
    title: string;
    description: string;
    weekOffset: number;
    importance: number;
    status: string;
    tags: string[];
    // Simplified structure from AI, mapped to RecurrenceConfig later
    recurrence?: {
      frequency: 'weekly';
      count: number;
    };
    dependsOnTaskIndex?: number[];
  }[];
}
