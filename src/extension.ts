import * as vscode from 'vscode';
import { TranslationHoverProvider } from './hoverProvider';
import { registerCommands } from './commands';
import { LMStudioService } from './lmStudioService';
import { StatusBarManager, showStatusMenu } from './statusBar';
import { InlineDecorationProvider } from './inlineDecoration';
import { getConfig } from './config';

import { TranslationViewProvider } from './translationViewProvider';

/**
 * Extension entry point
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('LM Translator extension is now active');

  // Initialize status bar
  const statusBar = StatusBarManager.getInstance();
  context.subscriptions.push(statusBar.getStatusBarItem());

  // Initialize LM Studio service with context for persistent cache
  const service = LMStudioService.getInstance();
  service.initialize(context);

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
    const service = LMStudioService.getInstance();
    const isConnected = await service.isAvailable();
    const config = getConfig();

    vscode.window.showInformationMessage(
      `LM Translator Status:\n` +
      `Connection: ${isConnected ? 'Connected' : 'Disconnected'}\n` +
      `Decoration: ${config.decorationMode}\n` +
      `Target: ${config.targetLanguage}`
    );
  });
  context.subscriptions.push(showStatusCmd);

  // Register clear cache command
  const clearCacheCmd = vscode.commands.registerCommand('lmTranslator.clearCache', () => {
    LMStudioService.getInstance().clearCache();

    // If decoration mode is enabled, clear decorations
    if (getConfig().decorationMode !== 'off') {
      decorationProvider.clearAllDecorations();
    }

    vscode.window.showInformationMessage('LM Translator: Cache cleared');
  });
  context.subscriptions.push(clearCacheCmd);

  // Check LM Studio availability on activation
  checkLMStudioConnection(statusBar);

  // Listen for configuration changes
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('lmTranslator')) {
      // Clear cache when config changes
      LMStudioService.getInstance().clearCache();
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
}

/**
 * Check if LM Studio is available
 */
async function checkLMStudioConnection(statusBar: StatusBarManager): Promise<void> {
  const service = LMStudioService.getInstance();
  const isAvailable = await service.isAvailable();

  statusBar.setConnected(isAvailable);

  if (!isAvailable) {
    vscode.window.showWarningMessage(
      'LM Translator: Cannot connect to LM Studio. Please make sure LM Studio is running.',
      'Open Settings'
    ).then((selection) => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'lmTranslator');
      }
    });
  } else {
    console.log('LM Translator: Connected to LM Studio successfully');
  }
}

/**
 * Extension deactivation
 */
export function deactivate() {
  InlineDecorationProvider.getInstance().dispose();
  console.log('LM Translator extension is now deactivated');
}
