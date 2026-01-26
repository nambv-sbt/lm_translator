import { ITranslationService } from './translationService';
import { TranslationResult } from './types';
import { getConfig } from './config';
// google-translate-api-x is ESM, so we use dynamic import in methods
// check isAvailable and translate methods


export class GoogleTranslateService implements ITranslationService {
  private static instance: GoogleTranslateService;
  private translationCache: Map<string, TranslationResult> = new Map();

  private constructor() {}

  public static getInstance(): GoogleTranslateService {
    if (!GoogleTranslateService.instance) {
        GoogleTranslateService.instance = new GoogleTranslateService();
    }
    return GoogleTranslateService.instance;
  }

  public async translate(text: string, targetLanguage?: string): Promise<TranslationResult> {
    const config = getConfig();
    const lang = targetLanguage || config.targetLanguage;
    const cacheKey = `${text}:${lang}`;

    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey)!;
    }

    try {
      // The library's translate function
      // Default auto detect source
      // @ts-ignore
      const { default: translate } = await import('google-translate-api-x');
      const res = await translate(text, { to: lang });

      const result: TranslationResult = {
        originalText: text,
        translatedText: res.text,
        targetLanguage: lang,
        detectedLanguage: res.from?.language?.iso,
        timestamp: Date.now()
      };

      this.translationCache.set(cacheKey, result);
      return result;

    } catch (error: any) {
      console.error('Google Translate Error:', error);
      throw new Error(`Google Translate failed: ${error.message}`);
    }
  }

  public getCachedResult(text: string, targetLanguage?: string): TranslationResult | undefined {
    const config = getConfig();
    const lang = targetLanguage || config.targetLanguage;
    const cacheKey = `${text}:${lang}`;
    return this.translationCache.get(cacheKey);
  }

  public async isAvailable(): Promise<boolean> {
    try {
      // Simple test translation
      // @ts-ignore
      const { default: translate } = await import('google-translate-api-x');
      await translate('Hello', { to: 'es' });
      return true;
    } catch (e) {
      return false;
    }
  }

  public clearCache(): void {
    this.translationCache.clear();
  }
}
