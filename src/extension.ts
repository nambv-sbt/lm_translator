import * as vscode from 'vscode';
import { TranslationHoverProvider } from './hoverProvider';
import { registerCommands } from './commands';
import { LMStudioService } from './lmStudioService';
import { GoogleTranslateService } from './googleTranslateService';
import { TranslationServiceManager } from './translationService';
import { StatusBarManager, showStatusMenu } from './statusBar';
import { InlineDecorationProvider } from './inlineDecoration';
import { getConfig } from './config';

import { TranslationViewProvider } from './translationViewProvider';

/**
 * Extension entry point
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('LM Translator extension is now active');

  // Initialize Services
  const manager = TranslationServiceManager.getInstance();

  // 1. LM Studio
  const lmService = LMStudioService.getInstance();
  lmService.initialize(context); // Legacy initialization for persistence
  manager.registerService('LM Studio', lmService);

  // 2. Google Translate
  const googleService = GoogleTranslateService.getInstance();
  manager.registerService('Google Translate', googleService);

  // Initialize status bar (must be done after services are registered)
  const statusBar = StatusBarManager.getInstance();
  context.subscriptions.push(statusBar.getStatusBarItem());

  // Initialize inline decoration provider
  const decorationProvider = InlineDecorationProvider.getInstance();

  // Initialize decorations on startup if mode is enabled
  decorationProvider.initOnStartup();

  // Register Sidebar View Provider
  const viewProvider = new TranslationViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(TranslationViewProvider.viewType, viewProvider)
  );

  // Register hover provider for all languages
  const hoverProvider = new TranslationHoverProvider();
  const hoverDisposable = vscode.languages.registerHoverProvider(
    { scheme: 'file' },
    hoverProvider
  );
  context.subscriptions.push(hoverDisposable);

  // Register commands
  registerCommands(context);

  // Register status bar menu command
  const statusMenuCmd = vscode.commands.registerCommand('lmTranslator.showStatusMenu', showStatusMenu);
  context.subscriptions.push(statusMenuCmd);

  // Register toggle inline decorations command
  const toggleDecorationsCmd = vscode.commands.registerCommand('lmTranslator.toggleDecorations', () => {
    decorationProvider.toggle();
  });
  context.subscriptions.push(toggleDecorationsCmd);

  // Register cycle decoration mode command
  const cycleDecorationModeCmd = vscode.commands.registerCommand('lmTranslator.cycleDecorationMode', async () => {
    const config = vscode.workspace.getConfiguration('lmTranslator');
    const currentMode = config.get<string>('decorationMode') ?? 'off';

    // Cycle: off -> inline -> highlighted -> off
    const modes = ['off', 'inline', 'highlighted'];
    const currentIndex = modes.indexOf(currentMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];

    await config.update('decorationMode', nextMode, vscode.ConfigurationTarget.Global);

    const modeLabels: { [key: string]: string } = {
      'off': 'Off',
      'inline': 'Inline (same line)',
      'highlighted': 'Highlighted (prominent)'
    };

    vscode.window.showInformationMessage(`LM Translator: Decoration mode → ${modeLabels[nextMode]}`);

    // Check connection status when changing mode
    await statusBar.checkConnection();

    // Update decorations if enabled
    if (nextMode !== 'off') {
      decorationProvider.updateDecorations();
    } else {
      decorationProvider.clearAllDecorations();
    }
  });
  context.subscriptions.push(cycleDecorationModeCmd);

  // Register show status command
  const showStatusCmd = vscode.commands.registerCommand('lmTranslator.showStatus', async () => {
    const service = TranslationServiceManager.getInstance().getService();
    const isConnected = await service.isAvailable();
    const config = getConfig();

    vscode.window.showInformationMessage(
      `LM Translator Status:\n` +
      `Provider: ${config.provider}\n` +
      `Connection: ${isConnected ? 'Connected' : 'Disconnected'}\n` +
      `Decoration: ${config.decorationMode}\n` +
      `Target: ${config.targetLanguage}`
    );
  });
  context.subscriptions.push(showStatusCmd);

  // Register clear cache command
  const clearCacheCmd = vscode.commands.registerCommand('lmTranslator.clearCache', () => {
    TranslationServiceManager.getInstance().getService().clearCache();

    // If decoration mode is enabled, clear decorations
    if (getConfig().decorationMode !== 'off') {
      decorationProvider.clearAllDecorations();
    }

    vscode.window.showInformationMessage('LM Translator: Cache cleared');
  });
  context.subscriptions.push(clearCacheCmd);

  // Get status check interval from config (default 30 seconds)
  const statusCheckInterval = vscode.workspace.getConfiguration('lmTranslator').get<number>('statusCheckInterval') ?? 30000;

  // Start periodic LM Studio status check
  statusBar.startPeriodicCheck(statusCheckInterval);

  // Listen for configuration changes
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('lmTranslator')) {
      statusBar.updateStatus();

      // Update decorations if decoration mode changed
      if (e.affectsConfiguration('lmTranslator.decorationMode')) {
        const config = getConfig();
        if (config.decorationMode !== 'off' && decorationProvider.isDecorationEnabled()) {
          decorationProvider.updateDecorations();
        } else {
          decorationProvider.clearDecorations();
        }
      }
    }
  });

  // Listen for active editor changes to update decorations automatically
  vscode.window.onDidChangeActiveTextEditor(() => {
    const config = getConfig();
    // Auto-run decorations when switching files if mode is enabled
    if (config.decorationMode !== 'off') {
      decorationProvider.updateDecorations();
    }
  });

  // Listen for visible range changes (scrolling)
  vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
    const config = getConfig();
    if (config.decorationMode !== 'off' && e.textEditor === vscode.window.activeTextEditor) {
      decorationProvider.updateDecorations();
    }
  });

  // Listen for document changes (new comments, edits)
  let documentChangeTimeout: NodeJS.Timeout | undefined;
  vscode.workspace.onDidChangeTextDocument((e) => {
    const config = getConfig();
    if (config.decorationMode !== 'off' && e.document === vscode.window.activeTextEditor?.document) {
      // Debounce to avoid too frequent updates while typing
      if (documentChangeTimeout) {
        clearTimeout(documentChangeTimeout);
      }
      documentChangeTimeout = setTimeout(() => {
        decorationProvider.updateDecorations();
      }, 1500); // Wait 1.5 seconds after last change
    }
  });
}

/**
 * Extension deactivation
 */
export function deactivate() {
  // Stop periodic status check
  StatusBarManager.getInstance().stopPeriodicCheck();

  InlineDecorationProvider.getInstance().dispose();
  console.log('LM Translator extension is now deactivated');
}
