import * as vscode from 'vscode';
import { LMStudioService } from './lmStudioService';
import { getConfig } from './config';

/**
 * Sidebar View Provider for LM Translator
 */
export class TranslationViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'lmTranslator.view';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
  ) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri
      ]
    };

    webviewView.webview.html = this._getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        case 'translate': {
          await this._translateText(data.text);
          break;
        }
        case 'getConfig': {
            this._sendConfig();
            break;
        }
      }
    });

    // Send initial config
    setTimeout(() => this._sendConfig(), 500);
  }

  public async setTranslation(original: string, translated: string) {
    if (this._view) {
      this._view.show?.(true); // Focus the view
      this._view.webview.postMessage({
        command: 'setResult',
        original,
        translated
      });
    }
  }

  private async _translateText(text: string) {
      if (!this._view) { return; }
      const service = LMStudioService.getInstance();

      this._view.webview.postMessage({ command: 'setLoading', loading: true });

      try {
        const result = await service.translate(text);
        this._view.webview.postMessage({
            command: 'setResult',
            original: result.originalText,
            translated: result.translatedText
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Translation failed';
        this._view.webview.postMessage({
            command: 'setError',
            message: errorMessage
        });
      } finally {
        this._view.webview.postMessage({ command: 'setLoading', loading: false });
      }
  }

  private _sendConfig() {
    if (this._view) {
      this._view.webview.postMessage({
          command: 'setConfig',
          config: getConfig()
      });
    }
  }

  private _getHtmlContent(webview: vscode.Webview) {
    // Reuse the same HTML structure as TranslationPanel but slightly optimized for narrow width
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
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font);
      background: var(--bg-primary);
      color: var(--text-primary);
      padding: 10px;
    }
    h1 { font-size: 1.1em; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
    .panel { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
    label { font-weight: 600; color: var(--text-secondary); font-size: 0.85em; }
    textarea {
      width: 100%;
      min-height: 100px;
      padding: 8px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-family: var(--vscode-font);
      font-size: 13px;
      resize: vertical;
    }
    textarea:focus { outline: 1px solid var(--accent); }
    .actions { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
    button {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background 0.2s;
      flex: 1;
    }
    .btn-primary { background: var(--accent); color: var(--vscode-button-foreground); }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-secondary { background: transparent; color: var(--text-primary); border: 1px solid var(--border); }
    .btn-secondary:hover { background: var(--bg-secondary); }
    .status { font-size: 0.8em; color: var(--text-secondary); margin-top: 6px; min-height: 1.2em; }
    .error { color: var(--error); }
    .info {
      background: var(--bg-secondary);
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 10px;
      font-size: 0.8em;
      color: var(--text-secondary);
    }
    .loading {
      display: inline-block; width: 12px; height: 12px;
      border: 2px solid var(--text-secondary); border-radius: 50%;
      border-top-color: var(--accent); animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <h1>🌐 LM Translator</h1>
  <div class="info">
    Target: <strong id="target-lang">...</strong><br>
    API: <strong id="api-url">...</strong>
  </div>

  <div class="panel">
    <label for="input">Source</label>
    <textarea id="input" placeholder="Enter text..."></textarea>
  </div>

  <div class="actions">
    <button class="btn-primary" id="translate-btn">Translate</button>
    <button class="btn-secondary" id="clear-btn">Clear</button>
  </div>

  <div class="panel">
    <label for="output">Result</label>
    <textarea id="output" readonly placeholder="Result..."></textarea>
  </div>

  <div class="actions">
      <button class="btn-secondary" id="copy-btn">Copy</button>
  </div>

  <div class="status" id="status"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const inputEl = document.getElementById('input');
    const outputEl = document.getElementById('output');
    const translateBtn = document.getElementById('translate-btn');
    const clearBtn = document.getElementById('clear-btn');
    const copyBtn = document.getElementById('copy-btn');
    const statusEl = document.getElementById('status');
    const targetLangEl = document.getElementById('target-lang');
    const apiUrlEl = document.getElementById('api-url');

    vscode.postMessage({ command: 'getConfig' });

    translateBtn.addEventListener('click', () => {
      const text = inputEl.value.trim();
      if (!text) return;
      vscode.postMessage({ command: 'translate', text });
    });

    clearBtn.addEventListener('click', () => {
      inputEl.value = '';
      outputEl.value = '';
      statusEl.textContent = '';
    });

    copyBtn.addEventListener('click', () => {
        if(outputEl.value) {
            navigator.clipboard.writeText(outputEl.value);
            statusEl.textContent = 'Copied!';
            setTimeout(() => statusEl.textContent = '', 2000);
        }
    });

    // Ctrl+Enter support
    inputEl.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') translateBtn.click();
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      switch (message.command) {
        case 'setResult':
          inputEl.value = message.original;
          outputEl.value = message.translated;
          statusEl.textContent = 'Done.';
          statusEl.className = 'status';
          break;
        case 'setError':
          statusEl.textContent = message.message;
          statusEl.className = 'status error';
          break;
        case 'setLoading':
          translateBtn.disabled = message.loading;
          translateBtn.textContent = message.loading ? '...' : 'Translate';
          statusEl.textContent = message.loading ? 'Translating...' : '';
          break;
        case 'setConfig':
          targetLangEl.textContent = message.config.targetLanguage;
          try {
              apiUrlEl.textContent = new URL(message.config.apiUrl).host;
          } catch(e) { apiUrlEl.textContent = 'Invalid URL'; }
          break;
      }
    });
  </script>
</body>
</html>`;
  }
}
