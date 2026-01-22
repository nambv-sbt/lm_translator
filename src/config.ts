import * as vscode from 'vscode';
import { LMTranslatorConfig } from './types';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: LMTranslatorConfig = {
  apiUrl: 'http://localhost:1234/v1',
  model: '',
  targetLanguage: 'Vietnamese',
  enableHover: true,
  hoverDelay: 500,
  decorationMode: 'off',
  maxTokens: 512,
  cacheTTL: 604800000, // 7 days in ms
  maxCacheSize: 10000,
  promptTemplate: '{{text}}' // Simple template by default
};

/**
 * Get the extension configuration
 */
export function getConfig(): LMTranslatorConfig {
  const config = vscode.workspace.getConfiguration('lmTranslator');

  return {
    apiUrl: config.get<string>('apiUrl') || DEFAULT_CONFIG.apiUrl,
    model: config.get<string>('model') || DEFAULT_CONFIG.model,
    targetLanguage: config.get<string>('targetLanguage') || DEFAULT_CONFIG.targetLanguage,
    enableHover: config.get<boolean>('enableHover') ?? DEFAULT_CONFIG.enableHover,
    hoverDelay: config.get<number>('hoverDelay') || DEFAULT_CONFIG.hoverDelay,
    decorationMode: config.get<'off' | 'inline' | 'highlighted'>('decorationMode') || DEFAULT_CONFIG.decorationMode,
    maxTokens: config.get<number>('maxTokens') || DEFAULT_CONFIG.maxTokens,
    cacheTTL: config.get<number>('cacheTTL') || DEFAULT_CONFIG.cacheTTL,
    maxCacheSize: config.get<number>('maxCacheSize') || DEFAULT_CONFIG.maxCacheSize,
    promptTemplate: config.get<string>('promptTemplate') || DEFAULT_CONFIG.promptTemplate
  };
}

/**
 * Build the translation prompt from template
 */
export function buildPrompt(text: string, targetLanguage?: string): string {
  const config = getConfig();
  const lang = targetLanguage || config.targetLanguage;
  const template = config.promptTemplate;

  return template
    .replace(/\{\{text\}\}/g, text)
    .replace(/\{\{targetLanguage\}\}/g, lang);
}

/**
 * Get API URL with endpoint
 */
export function getApiEndpoint(endpoint: string): string {
  const config = getConfig();
  const baseUrl = config.apiUrl.replace(/\/+$/, ''); // Remove trailing slashes
  return `${baseUrl}${endpoint}`;
}
