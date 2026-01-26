import * as vscode from 'vscode';
import { TranslationServiceManager } from './translationService';
import { TranslationPanel } from './translationPanel';

/**
 * Register all extension commands
 */
export function registerCommands(context: vscode.ExtensionContext): void {
  const service = TranslationServiceManager.getInstance();

  // Command: Translate Selection
  const translateCmd = vscode.commands.registerCommand('lmTranslator.translate', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active text editor');
      return;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);

    if (!text || text.trim().length === 0) {
      vscode.window.showWarningMessage('Please select text to translate');
      return;
    }

    await translateAndShow(text, context);
  });

  // Command: Translate and Replace
  const translateReplaceCmd = vscode.commands.registerCommand('lmTranslator.translateAndReplace', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active text editor');
      return;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);

    if (!text || text.trim().length === 0) {
      vscode.window.showWarningMessage('Please select text to translate');
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'LM Translator',
        cancellable: true
      },
      async (progress, token) => {
        progress.report({ message: 'Translating...' });

        try {
          const result = await service.translate(text);

          if (token.isCancellationRequested) {
            return;
          }

          // Replace the selected text with translation
          await editor.edit(editBuilder => {
            editBuilder.replace(selection, result.translatedText);
          });

          vscode.window.showInformationMessage('Translation replaced successfully');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Translation failed';
          vscode.window.showErrorMessage(`Translation error: ${errorMessage}`);
        }
      }
    );
  });

  // Command: Show Translation Panel
  const showPanelCmd = vscode.commands.registerCommand('lmTranslator.showPanel', () => {
    TranslationPanel.createOrShow(context.extensionUri);
  });

  context.subscriptions.push(translateCmd, translateReplaceCmd, showPanelCmd);
}

/**
 * Translate text and show result in panel
 */
async function translateAndShow(text: string, context: vscode.ExtensionContext): Promise<void> {
  const service = TranslationServiceManager.getInstance();

  // Show the panel first
  const panel = TranslationPanel.createOrShow(context.extensionUri);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'LM Translator',
      cancellable: true
    },
    async (progress, token) => {
      progress.report({ message: 'Translating...' });

      try {
        const result = await service.translate(text);

        if (token.isCancellationRequested) {
          return;
        }

        // Send result to panel
        panel.setTranslation(result.originalText, result.translatedText);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Translation failed';
        panel.setError(errorMessage);
        vscode.window.showErrorMessage(`Translation error: ${errorMessage}`);
      }
    }
  );
}
