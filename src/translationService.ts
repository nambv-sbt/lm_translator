import * as vscode from 'vscode';
import { TranslationResult, TranslationProvider } from './types';
import { getConfig } from './config';

/**
 * Interface for translation services
 */
export interface ITranslationService {
  /**
   * Translate text
   */
  translate(text: string, targetLanguage?: string): Promise<TranslationResult>;

  /**
   * Check if service is available/connected
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get cached result if available (synchronous)
   */
  getCachedResult(text: string, targetLanguage?: string): TranslationResult | undefined;

  /**
   * Clear any internal cache
   */
  clearCache(): void;
}

/**
 * Manager to handle switching between translation services
 */
export class TranslationServiceManager {
  private static instance: TranslationServiceManager;
  private services: Map<TranslationProvider, ITranslationService> = new Map();

  private constructor() {}

  public static getInstance(): TranslationServiceManager {
    if (!TranslationServiceManager.instance) {
      TranslationServiceManager.instance = new TranslationServiceManager();
    }
    return TranslationServiceManager.instance;
  }

  public registerService(provider: TranslationProvider, service: ITranslationService): void {
    this.services.set(provider, service);
  }

  public getService(provider?: TranslationProvider): ITranslationService {
    const config = getConfig();
    const currentProvider = provider || config.provider;
    const service = this.services.get(currentProvider);

    if (!service) {
      // Fallback to LM Studio or throw
      const fallback = this.services.get('LM Studio');
      if (fallback) {
        return fallback;
      }
      throw new Error(`Translation service '${currentProvider}' not registered.`);
    }

    return service;
  }

  public getCachedResult(text: string, targetLanguage?: string): TranslationResult | undefined {
    const service = this.getService();
    return service.getCachedResult(text, targetLanguage);
  }

  public async isAvailable(): Promise<boolean> {
    const service = this.getService();
    return service.isAvailable();
  }

  public async translate(text: string, targetLanguage?: string): Promise<TranslationResult> {
    const service = this.getService();
    return service.translate(text, targetLanguage);
  }
}
