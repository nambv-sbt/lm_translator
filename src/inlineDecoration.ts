import * as vscode from 'vscode';
import { LMStudioService } from './lmStudioService';
import { getConfig } from './config';

/**
 * Decoration types for inline translation display
 */
type DecorationMode = 'off' | 'inline' | 'highlighted';

/**
 * Inline Translation Decoration Provider
 * Shows translation as inline decorations without modifying code
 */
export class InlineDecorationProvider {
  private static instance: InlineDecorationProvider;
  private service: LMStudioService;
  private currentDocumentUri: string = '';
  private activeRenderId: number = 0; // Token to cancel old tasks

  // Decoration type for inline (subtle italic after text)
  private inlineDecorationType: vscode.TextEditorDecorationType;

  // Decoration type for highlighted (prominent with background)
  private highlightedDecorationType: vscode.TextEditorDecorationType;

  // Track which documents have decorations
  private decoratedDocuments: Set<string> = new Set();

  // Cache of decorations for fast re-render
  private decorationCache: Map<string, vscode.DecorationOptions[]> = new Map();

  private constructor() {
    this.service = LMStudioService.getInstance();

    // Create inline decoration type
    this.inlineDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: '0 0 0 1em',
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
        fontStyle: 'italic'
      }
    });

    // Create highlighted decoration type (formerly 'below')
    this.highlightedDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: '0 0 0 0.5em',
        color: '#ffffff',
        backgroundColor: '#4CAF50',
        fontWeight: 'bold',
        border: '1px solid #4CAF50'
      },
      light: {
        after: {
          color: '#ffffff',
          backgroundColor: '#4CAF50'
        }
      },
      dark: {
        after: {
          color: '#ffffff',
          backgroundColor: '#2E7D32'
        }
      }
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): InlineDecorationProvider {
    if (!InlineDecorationProvider.instance) {
      InlineDecorationProvider.instance = new InlineDecorationProvider();
    }
    return InlineDecorationProvider.instance;
  }

  /**
   * Check if decoration mode is enabled (not 'off')
   */
  public isDecorationEnabled(): boolean {
    const config = getConfig();
    return config.decorationMode !== 'off';
  }

  /**
   * Initialize decorations on startup
   */
  public async initOnStartup(): Promise<void> {
    const config = getConfig();
    if (config.decorationMode !== 'off' && vscode.window.activeTextEditor) {
      setTimeout(() => {
        this.updateDecorations();
      }, 1000);
    }
  }

  /**
   * Toggle inline decorations
   */
  public async toggle(): Promise<void> {
    const config = vscode.workspace.getConfiguration('lmTranslator');
    const currentMode = config.get<string>('decorationMode') ?? 'off';

    const nextMode = currentMode === 'off' ? 'inline' : 'off';
    await config.update('decorationMode', nextMode, vscode.ConfigurationTarget.Global);

    if (nextMode !== 'off') {
      await this.updateDecorations();
      vscode.window.showInformationMessage(`LM Translator: Inline decorations enabled`);
    } else {
      this.clearAllDecorations();
      vscode.window.showInformationMessage('LM Translator: Inline decorations disabled');
    }
  }

  /**
   * Update decorations for active editor
   */
  public async updateDecorations(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const config = getConfig();
    let mode = config.decorationMode as DecorationMode;

    // Backward compatibility for old 'below' setting
    if (mode as string === 'below') {
        mode = 'highlighted';
    }

    if (mode === 'off') {
      this.clearDecorations(editor);
      return;
    }

    const documentUri = editor.document.uri.toString();
    const document = editor.document;

    // Increment render ID to cancel any previous running tasks
    this.activeRenderId++;
    const renderId = this.activeRenderId;

    try {
      const text = document.getText();
      const allComments: { range: vscode.Range; text: string }[] = [];

      // Get language ID to determine appropriate comment patterns
      const languageId = document.languageId;

      // Languages that use // for single-line comments
      const slashSlashLangs = [
        'javascript', 'typescript', 'javascriptreact', 'typescriptreact',
        'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'swift', 'kotlin',
        'php', 'scss', 'less', 'json', 'jsonc'
      ];

      // Languages that use # for single-line comments (must be at line start)
      const hashLangs = ['python', 'ruby', 'perl', 'shellscript', 'yaml', 'toml', 'dockerfile'];

      // Languages that use -- for single-line comments
      const doubleDashLangs = ['sql', 'plsql', 'lua', 'haskell'];

      // PHTML/HTML - use // only (avoid jQuery $ issues with #)
      const htmlLikeLangs = ['html', 'phtml', 'blade', 'twig', 'ejs', 'handlebars', 'vue'];

      // Build patterns based on language
      const singleLinePatterns: RegExp[] = [];

      if (slashSlashLangs.includes(languageId) || htmlLikeLangs.includes(languageId)) {
        singleLinePatterns.push(/\/\/.*$/gm);
      }
      if (hashLangs.includes(languageId)) {
        singleLinePatterns.push(/^\s*#.*$/gm); // # must be at line start
      }
      if (doubleDashLangs.includes(languageId)) {
        singleLinePatterns.push(/--.*$/gm);
      }
      // Default fallback: use // only (safest)
      if (singleLinePatterns.length === 0) {
        singleLinePatterns.push(/\/\/.*$/gm);
      }

      for (const pattern of singleLinePatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const startPos = document.positionAt(match.index);
          const endPos = document.positionAt(match.index + match[0].length);
          const range = new vscode.Range(startPos, endPos);

          const cleanText = match[0]
            .replace(/^(\/\/|#|--)\s*/, '') // Remove start markers
            .trim();

          if (this.isValidComment(cleanText)) {
            allComments.push({ range, text: cleanText });
          }
        }
      }

      // 2. Block Comments (/* */, <!-- -->, """ """)
      const blockPatterns = [
        { regex: /\/\*([\s\S]*?)\*\//gm, type: 'c-style' },       // JS, CSS, Java
        { regex: /<!--([\s\S]*?)-->/gm, type: 'html' },           // HTML, XML
        { regex: /"{3}([\s\S]*?)"{3}/gm, type: 'python-doc' },    // Python Docstring
        { regex: /'{3}([\s\S]*?)'{3}/gm, type: 'python-doc-s' }   // Python Docstring (single quotes)
      ];

      for (const item of blockPatterns) {
        let match;
        while ((match = item.regex.exec(text)) !== null) {
          const fullMatch = match[0];
          const content = match[1]; // Captured group content
          const matchStartOffset = match.index;

          // Split block content into lines to support granular translation
          const lines = content.split(/\r?\n/);
          let currentOffset = matchStartOffset + fullMatch.indexOf(content);

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineTrimmed = line.trim();

            // Clean specific chars like leading * for JSDoc
            let textToTranslate = lineTrimmed;

            if (item.type === 'c-style') {
                textToTranslate = textToTranslate.replace(/^\*\s*/, '');
            }
            textToTranslate = textToTranslate.trim();

            // Handle JSDoc tags (@param, @return, etc.)
            // We want to skip the tag and variable/type, and keep ONLY the description
            if (textToTranslate.startsWith('@')) {
                // Regex Breakdown:
                // ^@[a-zA-Z0-9_]+  => The tag (e.g., @param)
                // (...)            => Optional type OR first word (e.g. {string} or string or [string])
                // (...)            => Optional variable OR second word (e.g. $id or paramName)
                // \s+(.+)          => The rest (Description) - MUST be present

                // This is heuristic.
                // Examples:
                // @param int $id User ID -> Match "User ID"
                // @param $id User ID -> Match "User ID"
                // @return string Result -> Match "Result"
                // @throws Exception If error -> Match "If error"

                // Simple strategy: Split by space.
                const parts = textToTranslate.split(/\s+/);

                // Parts[0] is @tag
                if (parts.length > 1) {
                    // Look for the start of the description.
                    let descStartIndex = -1;

                    for (let j = 1; j < parts.length; j++) {
                        const word = parts[j];
                        // Skip if it looks like a type ({...}, [...]) or variable ($...)
                        // Also skip if it is a simple identifier without symbols BUT we have to be careful.
                        // "User ID" -> "User" is identifier.

                        // Heuristic: If word contains specific chars or is wrapped, it's syntax.
                        if (word.startsWith('{') || word.startsWith('[') || word.startsWith('$') || word.startsWith('<')) {
                            continue;
                        }

                        // Skip pure identifiers (snake_case, camelCase, PascalCase, or single word type names)
                        // These are likely type or variable names, not descriptions
                        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(word) && !word.includes(' ')) {
                            // Check if ALL remaining words are also identifiers - if so, skip
                            const remainingWords = parts.slice(j);
                            const allIdentifiers = remainingWords.every(w =>
                                /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(w) ||
                                w.startsWith('{') || w.startsWith('[') || w.startsWith('$') || w.startsWith('<')
                            );
                            if (allIdentifiers) {
                                continue;
                            }
                        }

                        // If it's a simple word, is it the variable name?
                        // Usually JSDoc: @param {type} varName Description
                        // PHPDoc: @param type $varName Description

                        // If we haven't found a var yet (indicated by $ in PHP or position in JS), maybe this is it?
                        // It's hard to distinguish "varName" from "DescriptionStart".

                        // Let's assume description starts after the first 1-2 syntax-like tokens.
                        // Or better: If the REST of the line contains spaces or looks like a sentence.

                        // Let's take everything from index j onwards.
                        const potentialDesc = parts.slice(j).join(' ');

                        // If it has spaces (at least 2 words) OR contains CJK, assume it's description
                        if (potentialDesc.includes(' ') || /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(potentialDesc)) {
                             descStartIndex = j;
                             break;
                        }
                    }

                    if (descStartIndex !== -1) {
                        textToTranslate = parts.slice(descStartIndex).join(' ');
                    } else {
                        // No clear description found
                        textToTranslate = ''; // clear it so it fails validation
                    }
                } else {
                    textToTranslate = '';
                }
            }

            if (this.isValidComment(textToTranslate)) {
                // Find start pos of this text within the line to create accurate range
                // We map this decoration to the end of the line
                const lineEndOffset = currentOffset + line.length;
                const range = new vscode.Range(
                    document.positionAt(lineEndOffset),
                    document.positionAt(lineEndOffset)
                );

                allComments.push({ range, text: textToTranslate });
            }

            // Approximation for EOL length (1 for \n, 2 for \r\n, 0 for last)
            const isLast = i === lines.length - 1;
            const eolLength = isLast ? 0 : (text[currentOffset + line.length] === '\r' ? 2 : 1);

            currentOffset += line.length + eolLength;
          }
        }
      }

      // 2. Identify cached vs missing comments
      const cachedDecorations: vscode.DecorationOptions[] = [];
      const missingComments: { range: vscode.Range; text: string }[] = [];

      for (const comment of allComments) {
        const cachedResult = this.service.getCachedResult(comment.text);
        if (cachedResult) {
          cachedDecorations.push(this.createDecorationOption(comment.range, cachedResult.translatedText, mode));
        } else {
          missingComments.push(comment);
        }
      }

      // 3. Apply cached decorations IMMEDIATELY
      const activeType = mode === 'inline' ? this.inlineDecorationType : this.highlightedDecorationType;
      const inactiveType = mode === 'inline' ? this.highlightedDecorationType : this.inlineDecorationType;

      editor.setDecorations(inactiveType, []);
      editor.setDecorations(activeType, cachedDecorations);

      // Store current decorations
      this.decorationCache.set(documentUri, cachedDecorations);

      // 4. Process missing comments - Prioritize visible range
      if (missingComments.length > 0) {
        // Check if LM Studio is available before attempting translations
        const isOnline = await this.service.isAvailable();

        if (!isOnline) {
          // Offline mode - only use cached translations
          console.log(`LM Translator: Offline mode - showing ${cachedDecorations.length} cached translations, ${missingComments.length} comments pending`);
          if (cachedDecorations.length > 0) {
            vscode.window.setStatusBarMessage(`LM Translator: Cache mode - ${cachedDecorations.length} translations loaded`, 3000);
          }
          this.decoratedDocuments.add(documentUri);
          return;
        }

        const visibleRanges = editor.visibleRanges;

        // Sort by distance to visible
        missingComments.sort((a, b) => {
          const distA = this.minDistanceToVisible(a.range, visibleRanges);
          const distB = this.minDistanceToVisible(b.range, visibleRanges);
          return distA - distB;
        });

        // 5. Translate missing comments progressively
        const currentDecorations = [...cachedDecorations];
        const renderId = this.activeRenderId;

        for (const comment of missingComments) {
          // Check cancellation
          if (this.activeRenderId !== renderId || vscode.window.activeTextEditor?.document.uri.toString() !== documentUri) {
            console.log('LM Translator: Decoration update cancelled');
            break;
          }

          try {
            const result = await this.service.translate(comment.text);
            const decoration = this.createDecorationOption(comment.range, result.translatedText, mode);

            currentDecorations.push(decoration);

            // Re-render if visible or periodically
            const isVisible = visibleRanges.some(r => r.contains(comment.range) || r.intersection(comment.range));
            if (isVisible || currentDecorations.length % 5 === 0) {
               if (this.activeRenderId === renderId) {
                 editor.setDecorations(activeType, currentDecorations);
               }
            }
          } catch (e) {
            console.error('Translation failed', e);
          }
        }

        // Final update
        if (this.activeRenderId === renderId && vscode.window.activeTextEditor?.document.uri.toString() === documentUri) {
            editor.setDecorations(activeType, currentDecorations);
        }
      }

      this.decoratedDocuments.add(documentUri);

    } catch (err) {
      console.error('Error updating decorations', err);
    }
  }

  /**
   * Check if comment text is valid for translation
   */
  private isValidComment(text: string): boolean {
    // Must be at least 2 chars AND contain letters/CJK

    // Ignore pure variable names (snake_case, camelCase, PascalCase) without spaces
    // e.g. "table_id", "Zend_Exception", "camelCase"
    if (/^[a-zA-Z0-9_\$]+$/.test(text)) {
        return false;
    }

    return text.length >= 2 &&
           /[a-zA-Z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text) &&
           !/^[\s\*\-\/=]+$/.test(text); // Reject strings solely made of symbols
  }

  /**
   * Helper to create decoration option
   */
  private createDecorationOption(range: vscode.Range, text: string, mode: DecorationMode): vscode.DecorationOptions {
    if (mode === 'inline') {
      return {
        range,
        renderOptions: {
          after: {
            contentText: ` → ${text}`,
            color: new vscode.ThemeColor('editorCodeLens.foreground'),
            fontStyle: 'italic'
          }
        }
      };
    } else {
      return {
        range,
        renderOptions: {
          after: {
            contentText: ` 【${text}】`,
            color: '#ffffff',
            fontWeight: 'bold',
            border: '1px solid #4CAF50'
          }
        }
      };
    }
  }

  /**
   * Calculate minimum line distance from range to any visible range
   */
  private minDistanceToVisible(range: vscode.Range, visibleRanges: readonly vscode.Range[]): number {
    let min = Number.MAX_VALUE;
    for (const visible of visibleRanges) {
      if (visible.contains(range) || visible.intersection(range)) {
        return 0;
      }
      const distStart = Math.abs(range.start.line - visible.start.line);
      const distEnd = Math.abs(range.end.line - visible.end.line);
      min = Math.min(min, distStart, distEnd);
    }
    return min;
  }

  /**
   * Clear decorations for a specific editor
   */
  public clearDecorations(editor?: vscode.TextEditor): void {
    const targetEditor = editor || vscode.window.activeTextEditor;
    if (targetEditor) {
      targetEditor.setDecorations(this.inlineDecorationType, []);
      targetEditor.setDecorations(this.highlightedDecorationType, []);
      this.decoratedDocuments.delete(targetEditor.document.uri.toString());
      this.decorationCache.delete(targetEditor.document.uri.toString());
    }
  }

  /**
   * Clear all decorations across all editors
   */
  public clearAllDecorations(): void {
    for (const visibleEditor of vscode.window.visibleTextEditors) {
      visibleEditor.setDecorations(this.inlineDecorationType, []);
      visibleEditor.setDecorations(this.highlightedDecorationType, []);
    }
    this.decoratedDocuments.clear();
    this.decorationCache.clear();
    this.activeRenderId++; // Invalidate any running tasks
  }

  /**
   * Translate single selection
   */
  public async translateSelection(): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || activeEditor.selection.isEmpty) { return; }

    const config = getConfig();
    let mode = config.decorationMode as DecorationMode;
    if (mode as string === 'below') mode = 'highlighted';

    if (mode === 'off') {
      vscode.window.showWarningMessage('Enable decoration mode first');
      return;
    }

    try {
      const selection = activeEditor.selection;
      const text = activeEditor.document.getText(selection);
      const result = await this.service.translate(text);

      const decoration = this.createDecorationOption(selection, result.translatedText, mode);
      const type = mode === 'inline' ? this.inlineDecorationType : this.highlightedDecorationType;

      activeEditor.setDecorations(type, [decoration]);

    } catch (error) {
       vscode.window.showErrorMessage('Translation failed');
    }
  }

  public dispose(): void {
    this.inlineDecorationType.dispose();
    this.highlightedDecorationType.dispose();
  }
}
