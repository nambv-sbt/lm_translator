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
    const connectionIcon = this.isConnected ? '🟢' : '🔴';
    const decorationIcon = config.decorationMode !== 'off' ? '✨' : '';

    this.statusBarItem.text = `${connectionIcon} LM Translator ${decorationIcon}`;
    this.statusBarItem.tooltip = this.getTooltip();
  }

  /**
   * Get tooltip text
   */
  private getTooltip(): string {
    const config = getConfig();
    const status = this.isConnected ? 'Connected' : 'Disconnected';
    const decoration = config.decorationMode === 'off' ? 'Off'
      : config.decorationMode === 'inline' ? 'Inline' : 'Highlighted';

    return `LM Translator\n` +
      `Status: ${status}\n` +
      `Decoration: ${decoration}\n` +
      `Target: ${config.targetLanguage}\n` +
      `Click for options`;
  }

  /**
   * Set connection status
   */
  public setConnected(connected: boolean): void {
    this.isConnected = connected;
    this.updateStatus();
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
    this.setConnected(isAvailable);
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
