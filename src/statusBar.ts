import * as vscode from 'vscode';
import { getConfig } from './config';
import { LMStudioService } from './lmStudioService';

/**
 * Status Bar Manager for LM Translator
 */
export class StatusBarManager {
  private static instance: StatusBarManager;
  private statusBarItem: vscode.StatusBarItem;
  private isConnected: boolean = false;
  private statusCheckInterval: NodeJS.Timeout | undefined;
  private lastCheckTime: Date | undefined;

  private constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'lmTranslator.showStatusMenu';
    this.updateStatus();
    this.statusBarItem.show();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): StatusBarManager {
    if (!StatusBarManager.instance) {
      StatusBarManager.instance = new StatusBarManager();
    }
    return StatusBarManager.instance;
  }

  /**
   * Update status bar display
   */
  public updateStatus(): void {
    const config = getConfig();
    const service = LMStudioService.getInstance();
    const cacheSize = service.getCacheSize();

    // Show cache icon when disconnected but cache is available
    const connectionIcon = this.isConnected ? '🟢' : (cacheSize > 0 ? '🟡' : '🔴');
    const decorationIcon = config.decorationMode !== 'off' ? '✨' : '';

    this.statusBarItem.text = `${connectionIcon} LM Translator ${decorationIcon}`;
    this.statusBarItem.tooltip = this.getTooltip();
  }

  /**
   * Get tooltip text
   */
  private getTooltip(): string {
    const config = getConfig();
    const service = LMStudioService.getInstance();
    const cacheSize = service.getCacheSize();

    let status = this.isConnected ? 'Connected' : 'Disconnected';
    if (!this.isConnected && cacheSize > 0) {
      status = 'Disconnected (Cache Mode)';
    }

    const decoration = config.decorationMode === 'off' ? 'Off'
      : config.decorationMode === 'inline' ? 'Inline' : 'Highlighted';

    let tooltip = `LM Translator\n` +
      `Status: ${status}\n` +
      `Cache: ${cacheSize} entries\n` +
      `Decoration: ${decoration}\n` +
      `Target: ${config.targetLanguage}`;

    if (this.lastCheckTime) {
      const timeStr = this.lastCheckTime.toLocaleTimeString();
      tooltip += `\nLast check: ${timeStr}`;
    }

    tooltip += `\nClick for options`;
    return tooltip;
  }

  /**
   * Set connection status
   */
  public setConnected(connected: boolean): void {
    this.isConnected = connected;
    this.updateStatus();
  }

  /**
   * Get connection status
   */
  public getConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get status bar item for disposal
   */
  public getStatusBarItem(): vscode.StatusBarItem {
    return this.statusBarItem;
  }

  /**
   * Check connection and update status
   */
  public async checkConnection(): Promise<void> {
    const service = LMStudioService.getInstance();
    const isAvailable = await service.isAvailable();
    this.lastCheckTime = new Date();
    this.setConnected(isAvailable);
  }

  /**
   * Start periodic status check
   * @param intervalMs Check interval in milliseconds (default 30000 = 30 seconds)
   */
  public startPeriodicCheck(intervalMs: number = 30000): void {
    // Clear any existing interval
    this.stopPeriodicCheck();

    // Run initial check
    this.checkConnection();

    // Set up periodic check
    this.statusCheckInterval = setInterval(async () => {
      await this.checkConnection();
      console.log(`LM Translator: Status check - ${this.isConnected ? 'Connected' : 'Disconnected'}`);
    }, intervalMs);
  }

  /**
   * Stop periodic status check
   */
  public stopPeriodicCheck(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = undefined;
    }
  }
}

/**
 * Show status menu with quick actions
 */
export async function showStatusMenu(): Promise<void> {
  const config = getConfig();
  const statusBar = StatusBarManager.getInstance();

  const decorationLabel = config.decorationMode === 'off' ? 'Enable Inline Decorations'
    : `Decoration: ${config.decorationMode} (click to cycle)`;

  const items: vscode.QuickPickItem[] = [
    {
      label: '$(globe) Open Translation Panel',
      description: 'Open the translation panel'
    },
    {
      label: `$(sparkle) ${decorationLabel}`,
      description: 'Show translations inline (Ctrl+Shift+B to cycle)'
    },
    {
      label: '$(refresh) Check Connection',
      description: 'Check LM Studio connection status'
    },
    {
      label: '$(trash) Clear Translation Cache',
      description: 'Clear all cached translations'
    },
    {
      label: '$(gear) Open Settings',
      description: 'Open LM Translator settings'
    }
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'LM Translator Actions'
  });

  if (!selected) {
    return;
  }

  if (selected.label.includes('Translation Panel')) {
    await vscode.commands.executeCommand('lmTranslator.showPanel');
  } else if (selected.label.includes('Decoration') || selected.label.includes('Inline')) {
    await vscode.commands.executeCommand('lmTranslator.cycleDecorationMode');
  } else if (selected.label.includes('Connection')) {
    await statusBar.checkConnection();
    const isConnected = await LMStudioService.getInstance().isAvailable();
    vscode.window.showInformationMessage(
      isConnected ? 'LM Translator: Connected to LM Studio' : 'LM Translator: Cannot connect to LM Studio'
    );
  } else if (selected.label.includes('Clear Translation Cache')) {
    await vscode.commands.executeCommand('lmTranslator.clearCache');
  } else if (selected.label.includes('Settings')) {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'lmTranslator');
  }
}
