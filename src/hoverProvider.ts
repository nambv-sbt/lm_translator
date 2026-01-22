import * as vscode from 'vscode';
import { LMStudioService } from './lmStudioService';
import { getConfig, buildPrompt } from './config';

/**
 * Hover Provider for translation
 * Shows translation tooltip when hovering over text
 */
export class TranslationHoverProvider implements vscode.HoverProvider {
  private service: LMStudioService;

  constructor() {
    this.service = LMStudioService.getInstance();
  }

  /**
   * Provide hover information
   */
  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const config = getConfig();

    if (!config.enableHover) {
      return null;
    }

    // Get active editor to check for selection
    const editor = vscode.window.activeTextEditor;
    let textToTranslate = '';
    let hoverRange: vscode.Range | undefined;

    // Priority 1: If there's a selection and hover is within selection, use selected text
    if (editor && editor.document === document && !editor.selection.isEmpty) {
      const selection = editor.selection;
      if (selection.contains(position)) {
        textToTranslate = document.getText(selection);
        hoverRange = selection;
      }
    }

    // Priority 2: If no selection or hover outside selection, check for comment
    if (!textToTranslate) {
      const lineText = document.lineAt(position.line).text;
      const commentPatterns = [
        /\/\/.*$/, // Single line comment
        /\/\*[\s\S]*?\*\//, // Multi-line comment
        /#.*$/, // Python/Shell comment
        /--.*$/, // SQL comment
        /<!--[\s\S]*?-->/ // HTML comment
      ];

      for (const pattern of commentPatterns) {
        const match = lineText.match(pattern);
        if (match) {
          const matchStart = lineText.indexOf(match[0]);
          const matchEnd = matchStart + match[0].length;
          if (position.character >= matchStart && position.character <= matchEnd) {
            // Extract just the comment content without markers
            textToTranslate = match[0]
              .replace(/^\/\/\s*/, '')
              .replace(/^\/\*\s*/, '')
              .replace(/\s*\*\/$/, '')
              .replace(/^#\s*/, '')
              .replace(/^--\s*/, '')
              .replace(/^<!--\s*/, '')
              .replace(/\s*-->$/, '')
              .trim();
            break;
          }
        }
      }
    }

    // If no text found or too short, return null
    if (!textToTranslate || textToTranslate.length < 2) {
      return null;
    }

    if (token.isCancellationRequested) {
      return null;
    }

    try {
      const result = await this.service.translate(textToTranslate);

      if (token.isCancellationRequested) {
        return null;
      }

      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(`**🌐 LM Translator**\n\n`);
      markdown.appendMarkdown(`**Original:** ${textToTranslate}\n\n`);
      markdown.appendMarkdown(`**${result.targetLanguage}:** ${result.translatedText}`);
      markdown.isTrusted = true;

      return new vscode.Hover(markdown, hoverRange);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Translation failed';
      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(`**🌐 LM Translator**\n\n`);
      markdown.appendMarkdown(`⚠️ ${errorMessage}`);
      return new vscode.Hover(markdown);
    }
  }
}
