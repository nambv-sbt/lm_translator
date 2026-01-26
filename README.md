# LM Translator

Translate text and code comments using LM Studio's local AI models.

## ✨ Features

- **🌐 Multi-Provider** - Support for **LM Studio** (Local LLM) and **Google Translate**
- **🔍 Hover Translation** - Hover over comments to see instant translations
- **✨ Inline Decorations** - Show translations inline without modifying code
- **📝 Translate Selection** - Right-click selected text to translate
- **🔄 Translate & Replace** - Replace selected text with translation
- **📋 Translation Panel** - Dedicated panel for manual translation
- **📊 Status Bar** - Quick access to settings and status

## 🚀 Quick Start

1. Install [LM Studio](https://lmstudio.ai/) and load a model (optional if using Google Translate)
2. Select provider in settings: `LM Studio` or `Google Translate`
3. Start translating!

## ⌨️ Keyboard Shortcuts

| Shortcut         | Action                           |
|------------------|----------------------------------|
| `Ctrl+Shift+T`   | Translate selected text          |
| `Ctrl+Shift+D`   | Toggle Inline Decorations        |
| `Ctrl+Shift+B`   | Cycle Decoration Mode            |

## ⚙️ Settings

| Setting           | Default                      | Description                    |
|-------------------|------------------------------|--------------------------------|
| `provider`        | `LM Studio`                  | Translation Service            |
| `apiUrl`          | `http://localhost:1234/v1`   | LM Studio API URL              |
| `model`           | `""`                         | Model name (empty = default)   |
| `googleTranslateOption` | `...` | (Optional) Options for Google Translate if needed |
| `targetLanguage`  | `Vietnamese`                 | Target language                |
| `enableHover`     | `true`                       | Enable hover translation       |
| `decorationMode`  | `off`                        | off / inline / highlighted     |
| `maxTokens`       | `512`                        | Max tokens for API response    |
| `cacheTTL`        | `604800000`                  | Cache duration (ms) - 7 days   |
| `maxCacheSize`    | `10000`                      | Max cached translations        |

## 📊 Status Bar

Click the status bar icon for quick actions:

- 🟢/🔴 Connection status
- ✨ Decoration mode indicator

## 📖 Usage

### Inline Decorations

1. Press `Ctrl+Shift+B` to cycle: Off → Inline → Highlighted
2. Comments will show translations inline (auto-updates on file switch)
3. **Inline mode**: `→ translation` (italic, subtle)
4. **Highlighted mode**: `【translation】` (bold, green background)

### Supported Comments

- Single line: `//`, `#`, `--`
- Block comments: `/* ... */` (JS/Java/CSS), `<!-- ... -->` (HTML), `""" ... """` (Python)
- Translations are displayed line-by-line for block comments.

### Hover Translation

Simply hover over any code comment to see the translation.

### Context Menu

1. Select text in editor
2. Right-click → "LM: Translate Selection" or "LM: Translate & Replace"

### Translation Panel

Open Command Palette (`Ctrl+Shift+P`) → "LM: Open Translation Panel"

---

**Requires:** [LM Studio](https://lmstudio.ai/) running locally
