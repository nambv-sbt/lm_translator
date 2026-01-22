import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import * as vscode from 'vscode';
import {
  ChatCompletionRequest,
  ChatCompletionResponse,
  TranslationResult,
  ModelsResponse,
  ChatMessage
} from './types';
import { getConfig, buildPrompt, getApiEndpoint } from './config';

/**
 * LM Studio API Service
 * Handles communication with LM Studio's OpenAI-compatible API
 */
export class LMStudioService {
  private static instance: LMStudioService;
  private translationCache: Map<string, TranslationResult> = new Map();
  private context: vscode.ExtensionContext | undefined;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): LMStudioService {
    if (!LMStudioService.instance) {
      LMStudioService.instance = new LMStudioService();
    }
    return LMStudioService.instance;
  }

  /**
   * Initialize with extension context for persistent cache
   */
  public initialize(context: vscode.ExtensionContext): void {
    this.context = context;
    this.loadCacheFromStorage();
  }

  /**
   * Load cache from persistent storage
   */
  private loadCacheFromStorage(): void {
    if (!this.context) { return; }
    const stored = this.context.globalState.get<[string, TranslationResult][]>('translationCache');
    if (stored) {
      this.translationCache = new Map(stored);
      this.cleanCache();
    }
  }

  /**
   * Clean expired and excess cache entries
   */
  private cleanCache(): void {
    const config = getConfig();
    const now = Date.now();
    const ttl = config.cacheTTL;
    const maxSize = config.maxCacheSize;

    // Remove expired entries
    for (const [key, value] of this.translationCache) {
      if (now - value.timestamp > ttl) {
        this.translationCache.delete(key);
      }
    }

    // Enforce max size
    if (this.translationCache.size > maxSize) {
      const keysToDelete = Array.from(this.translationCache.keys()).slice(0, this.translationCache.size - maxSize);
      for (const key of keysToDelete) {
        this.translationCache.delete(key);
      }
    }

    this.saveCacheToStorage();
  }

  /**
   * Save cache to persistent storage
   */
  private saveCacheToStorage(): void {
    if (!this.context) { return; }
    const entries = Array.from(this.translationCache.entries());
    this.context.globalState.update('translationCache', entries);
  }

  /**
   * Make HTTP request to LM Studio API
   * @param endpoint API endpoint
   * @param data Optional request body
   * @param timeoutMs Timeout in milliseconds (default 30000 for translation, use lower for status checks)
   */
  private async makeRequest<T>(endpoint: string, data?: object, timeoutMs: number = 30000): Promise<T> {
    const url = new URL(getApiEndpoint(endpoint));
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: timeoutMs
    };

    return new Promise((resolve, reject) => {
      const req = httpModule.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body) as T);
            } catch (e) {
              reject(new Error(`Failed to parse response: ${body}`));
            }
          } else {
            reject(new Error(`API request failed with status ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`Connection error: ${e.message}. Make sure LM Studio is running.`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout. Please check if LM Studio is responding.'));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  /**
   * Check if client can connect using current BaseURL
   * Uses fast timeout (3 seconds) for quick status detection
   */
  public async isAvailable(): Promise<boolean> {
    try {
      await this.makeRequest<ModelsResponse>('/models', undefined, 3000);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cached result or undefined
   */
  public getCachedResult(text: string, targetLanguage?: string): TranslationResult | undefined {
    const config = getConfig();
    const lang = targetLanguage || config.targetLanguage;
    const cacheKey = `${text}:${lang}`;
    const cached = this.translationCache.get(cacheKey);
    const ttl = config.cacheTTL;

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached;
    }
    return undefined;
  }

  /**
   * Check if a translation is cached
   */
  public hasCache(text: string, targetLanguage?: string): boolean {
    return this.getCachedResult(text, targetLanguage) !== undefined;
  }

  /**
   * Translate text using LM Studio
   * @param text Text to translate
   * @param targetLanguage Optional target language (defaults to config)
   */
  public async translate(text: string, targetLanguage?: string): Promise<TranslationResult> {
    const config = getConfig();
    const lang = targetLanguage || config.targetLanguage;

    // Check fast cache first
    const cached = this.getCachedResult(text, lang);
    if (cached) {
      console.log('LM Translator: Using cached translation');
      return cached;
    }

    // Build prompt
    const prompt = buildPrompt(text, lang);

    const messages: ChatMessage[] = [];

    // Always use strict system message
    messages.push({
      role: 'system',
      content: `You are a strict translation engine. Translate the user text to ${lang}. Return ONLY the direct translation. Do not explain. Do not use quotes. Do not include the original text. If the text is code or strict boolean, keep it as is.`
    });

    messages.push({
      role: 'user',
      content: prompt
    });

    const request: ChatCompletionRequest = {
      model: config.model || 'default',
      messages: messages,
      temperature: 0.1, // Always low temp for precision
      max_tokens: Math.min(config.maxTokens, 256),
      stream: false
    };

    const response = await this.makeRequest<ChatCompletionResponse>('/chat/completions', request);

    if (!response.choices || response.choices.length === 0) {
      throw new Error('No response from LM Studio');
    }

    const translatedText = response.choices[0].message.content.trim();

    const cacheKey = `${text}:${lang}`;
    const result: TranslationResult = {
      originalText: text,
      translatedText,
      targetLanguage: lang,
      timestamp: Date.now()
    };

    // Cache the result and clean if needed
    this.translationCache.set(cacheKey, result);

    // Only clean cache periodically
    const maxSize = config.maxCacheSize;
    if (this.translationCache.size > maxSize + 50) {
        this.cleanCache();
    } else {
        this.saveCacheToStorage();
    }

    return result;
  }

  /**
   * Clear translation cache
   */
  public clearCache(): void {
    this.translationCache.clear();
    this.saveCacheToStorage();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; maxSize: number; ttlMinutes: number } {
    const config = getConfig();
    return {
      size: this.translationCache.size,
      maxSize: config.maxCacheSize,
      ttlMinutes: config.cacheTTL / 60000
    };
  }

  /**
   * Get cache size (number of entries)
   */
  public getCacheSize(): number {
    return this.translationCache.size;
  }
}
