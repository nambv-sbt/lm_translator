/**
 * Type definitions for LM Translator extension
 */

/**
 * Configuration interface matching VSCode settings schema
 */
export interface LMTranslatorConfig {
  apiUrl: string;
  model: string;
  targetLanguage: string;
  enableHover: boolean;
  hoverDelay: number;
  decorationMode: 'off' | 'inline' | 'highlighted';
  maxTokens: number;
  cacheTTL: number;
  maxCacheSize: number;
  promptTemplate: string;
  provider: TranslationProvider;
}

export type TranslationProvider = 'LM Studio' | 'Google Translate';

/**
 * OpenAI-compatible chat completion request
 */
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * Chat message format
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * OpenAI-compatible chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Chat completion choice
 */
export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}

/**
 * Translation result
 */
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  detectedLanguage?: string;
  targetLanguage: string;
  timestamp: number;
}

/**
 * LM Studio models list response
 */
export interface ModelsResponse {
  object: string;
  data: ModelInfo[];
}

/**
 * Model information
 */
export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}
