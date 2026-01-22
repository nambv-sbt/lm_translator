import * as vscode from 'vscode';
import { LMStudioService } from './lmStudioService';
import { getConfig } from './config';

/**
 * Translation Panel - Webview for manual translation
 */
export class TranslationPanel {
  public static currentPanel: TranslationPanel | undefined;
  public static readonly viewType = 'lmTranslator.panel';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Create or show the panel
   */
  public static createOrShow(extensionUri: vscode.Uri): TranslationPanel {
    const column = vscode.ViewColumn.Beside;

    if (TranslationPanel.currentPanel) {
      TranslationPanel.currentPanel._panel.reveal(column);
      return TranslationPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      TranslationPanel.viewType,
      'LM Translator',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    TranslationPanel.currentPanel = new TranslationPanel(panel, extensionUri);
    return TranslationPanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'translate':
            await this._translateText(message.text);
            break;
          case 'getConfig':
            this._sendConfig();
            break;
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Set translation result in panel
   */
  public setTranslation(original: string, translated: string): void {
    this._panel.webview.postMessage({
      command: 'setResult',
      original,
      translated
    });
  }

  /**
   * Set error message in panel
   */
  public setError(message: string): void {
    this._panel.webview.postMessage({
      command: 'setError',
      message
    });
  }

  /**
   * Translate text and send result to panel
   */
  private async _translateText(text: string): Promise<void> {
    const service = LMStudioService.getInstance();

    this._panel.webview.postMessage({ command: 'setLoading', loading: true });

    try {
      const result = await service.translate(text);
      this.setTranslation(result.originalText, result.translatedText);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Translation failed';
      this.setError(errorMessage);
    } finally {
      this._panel.webview.postMessage({ command: 'setLoading', loading: false });
    }
  }

  /**
   * Send current config to panel
   */
  private _sendConfig(): void {
    const config = getConfig();
    this._panel.webview.postMessage({
      command: 'setConfig',
      config
    });
  }

  /**
   * Update webview content
   */
  private _update(): void {
    this._panel.webview.html = this._getHtmlContent();
  }

  /**
   * Get HTML content for webview
   */
  private _getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LM Translator</title>
  <style>
    :root {
      --vscode-font: var(--vscode-font-family);
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-input-background);
      --text-primary: var(--vscode-editor-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --border: var(--vscode-input-border);
      --accent: var(--vscode-button-background);
      --accent-hover: var(--vscode-button-hoverBackground);
      --error: var(--vscode-errorForeground);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font);
      background: var(--bg-primary);
      color: var(--text-primary);
      padding: 16px;
      min-height: 100vh;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      font-size: 1.5em;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .panels {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    label {
      font-weight: 600;
      color: var(--text-secondary);
      font-size: 0.9em;
    }

    textarea {
      width: 100%;
      min-height: 150px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-family: var(--vscode-font);
      font-size: 14px;
      resize: vertical;
    }

    textarea:focus {
      outline: 1px solid var(--accent);
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.2s;
    }

    .btn-primary {
      background: var(--accent);
      color: var(--vscode-button-foreground);
    }

    .btn-primary:hover {
      background: var(--accent-hover);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: transparent;
      color: var(--text-primary);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--bg-secondary);
    }

    .status {
      font-size: 0.85em;
      color: var(--text-secondary);
      margin-top: 8px;
    }

    .error {
      color: var(--error);
    }

    .loading {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid var(--text-secondary);
      border-radius: 50%;
      border-top-color: var(--accent);
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .info {
      background: var(--bg-secondary);
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 16px;
      font-size: 0.9em;
      color: var(--text-secondary);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌐 LM Translator</h1>

    <div class="info" id="config-info">
      Target: <strong id="target-lang">Vietnamese</strong> |
      API: <strong id="api-url">localhost:1234</strong>
    </div>

    <div class="panels">
      <div class="panel">
        <label for="input">Source Text</label>
        <textarea id="input" placeholder="Enter text to translate..."></textarea>
      </div>

      <div class="actions">
        <button class="btn-primary" id="translate-btn">
          <span id="btn-text">Translate</span>
          <span id="btn-loading" class="loading" style="display: none;"></span>
        </button>
        <button class="btn-secondary" id="clear-btn">Clear</button>
        <button class="btn-secondary" id="copy-btn">Copy Result</button>
      </div>

      <div class="panel">
        <label for="output">Translation</label>
        <textarea id="output" readonly placeholder="Translation will appear here..."></textarea>
      </div>

      <div class="status" id="status"></div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    const inputEl = document.getElementById('input');
    const outputEl = document.getElementById('output');
    const translateBtn = document.getElementById('translate-btn');
    const btnText = document.getElementById('btn-text');
    const btnLoading = document.getElementById('btn-loading');
    const clearBtn = document.getElementById('clear-btn');
    const copyBtn = document.getElementById('copy-btn');
    const statusEl = document.getElementById('status');
    const targetLangEl = document.getElementById('target-lang');
    const apiUrlEl = document.getElementById('api-url');

    // Request config on load
    vscode.postMessage({ command: 'getConfig' });

    translateBtn.addEventListener('click', () => {
      const text = inputEl.value.trim();
      if (!text) {
        statusEl.textContent = 'Please enter text to translate';
        statusEl.className = 'status error';
        return;
      }
      vscode.postMessage({ command: 'translate', text });
    });

    clearBtn.addEventListener('click', () => {
      inputEl.value = '';
      outputEl.value = '';
      statusEl.textContent = '';
    });

    copyBtn.addEventListener('click', () => {
      if (outputEl.value) {
        navigator.clipboard.writeText(outputEl.value);
        statusEl.textContent = 'Copied to clipboard!';
        statusEl.className = 'status';
      }
    });

    // Handle Ctrl+Enter
    inputEl.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        translateBtn.click();
      }
    });

    // Handle messages from extension
    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.command) {
        case 'setResult':
          inputEl.value = message.original;
          outputEl.value = message.translated;
          statusEl.textContent = 'Translation completed';
          statusEl.className = 'status';
          break;

        case 'setError':
          statusEl.textContent = message.message;
          statusEl.className = 'status error';
          break;

        case 'setLoading':
          translateBtn.disabled = message.loading;
          btnText.style.display = message.loading ? 'none' : 'inline';
          btnLoading.style.display = message.loading ? 'inline-block' : 'none';
          if (message.loading) {
            statusEl.textContent = 'Translating...';
            statusEl.className = 'status';
          }
          break;

        case 'setConfig':
          targetLangEl.textContent = message.config.targetLanguage;
          apiUrlEl.textContent = new URL(message.config.apiUrl).host;
          break;
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Dispose the panel
   */
  public dispose(): void {
    TranslationPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
