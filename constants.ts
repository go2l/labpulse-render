
import { AiSettings, TaskStatus } from './types';

export const APP_STORAGE_KEY = 'labpulse.appData.v1';
export const AI_SETTINGS_KEY = 'labpulse.aiSettings.v1';

export const DEFAULT_AI_SETTINGS: AiSettings = {
  apiKey: '',
  mockMode: true,
  rememberApiKey: false,
  modelText: 'gemini-1.5-flash',
  modelStructured: 'gemini-1.5-flash',
  temperature: 0.7,
  numGuidingQuestions: 3,
  theme: 'light',
  fontSize: 'normal',
  // AI Persona Defaults
  aiStyle: 'professional',
  aiDetailLevel: 'balanced',
  aiLanguage: 'Hebrew',
  customSystemInstructions: '',
  showAssumptions: false,
  showMethodology: false,
  showReservations: false
};

export const STATUS_OPTIONS = [
  { label: 'Default', value: TaskStatus.DEFAULT, color: 'bg-slate-100 text-slate-700' },
  { label: 'Important', value: TaskStatus.IMPORTANT, color: 'bg-red-100 text-red-700' },
  { label: 'Warning', value: TaskStatus.WARNING, color: 'bg-amber-100 text-amber-700' },
  { label: 'Info', value: TaskStatus.INFO, color: 'bg-blue-100 text-blue-700' },
  { label: 'Completed', value: TaskStatus.COMPLETED, color: 'bg-emerald-100 text-emerald-700' }
];

export const INITIAL_APP_DATA = {
  experiments: [],
  tasks: [],
  schemaVersion: 1,
  hiddenWeeks: []
};
