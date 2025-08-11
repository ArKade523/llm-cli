// Application configuration and constants

export const DEFAULT_MODELS = [
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4o",
  "gpt-4o-mini", 
  "gpt-4",
  "gpt-4-turbo",
  "gpt-3.5-turbo"
];

export const FUNCTION_CALLING_MODELS = [
  'gpt-5',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-4o',
  'gpt-4o-2024-08-06', 
  'gpt-4o-2024-05-13',
  'gpt-4o-mini',
  'gpt-4o-mini-2024-07-18',
  'gpt-4-turbo',
  'gpt-4-turbo-2024-04-09',
  'gpt-4-turbo-preview',
  'gpt-4-0125-preview',
  'gpt-4-1106-preview',
  'gpt-4',
  'gpt-4-0613',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-0125',
  'gpt-3.5-turbo-1106',
  'gpt-3.5-turbo-0613'
];

export const APP_CONFIG = {
  DEFAULT_MODEL: "gpt-5",
  MAX_RECURSION_DEPTH: 10,
  MAX_COMPLETION_TOKENS: 10000,
  TIMER_UPDATE_INTERVAL: 100,
  EXIT_TIMEOUT: 3000,
  SYSTEM_PROMPT_FILE: "../prompt.txt",
  DEFAULT_SYSTEM_PROMPT: "You are a helpful assistant with access to tools for file operations, directory listing, and shell commands. Use tools when the user asks for file operations or system tasks."
};

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}