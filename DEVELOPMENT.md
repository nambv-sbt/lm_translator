# LM Translator - Development Guide

Hướng dẫn cài đặt, phát triển và đóng gói extension.

## 📦 Cài đặt từ VSIX

```powershell
# Cài đặt extension đã đóng gói
code --install-extension lm-translator-0.0.1.vsix

# Reload VSCode sau khi cài
# Ctrl+Shift+P → "Reload Window"
```

## 🔧 Development Setup

### Prerequisites
- Node.js >= 18
- VSCode >= 1.85.0
- LM Studio (để test)

### Clone & Install

```powershell
cd d:\Projects\0049-YMSL\tools\lm_translator
npm install
```

### Compile

```powershell
npm run compile    # Build một lần
npm run watch      # Build tự động khi có thay đổi
```

### Debug

1. Mở thư mục `lm_translator` trong VSCode
2. Nhấn `F5` để chạy Extension Development Host
3. Một cửa sổ VSCode mới mở với extension đã load

## 📦 Đóng gói Extension

### Cài đặt vsce (lần đầu)

```powershell
npm install -g @vscode/vsce
```

### Tạo VSIX package

```powershell
cd d:\Projects\0049-YMSL\tools\lm_translator
vsce package --allow-missing-repository
```

Output: `lm-translator-x.x.x.vsix`

### Cài đặt VSIX

```powershell
code --install-extension lm-translator-0.0.1.vsix
```

Hoặc trong VSCode:
1. `Ctrl+Shift+P` → "Extensions: Install from VSIX..."
2. Chọn file `.vsix`

## 📁 Project Structure

```
lm_translator/
├── .vscode/           # VSCode debugging config
├── src/
│   ├── extension.ts   # Entry point
│   ├── config.ts      # Configuration
│   ├── types.ts       # TypeScript types
│   ├── lmStudioService.ts  # API client
│   ├── hoverProvider.ts    # Hover translation
│   ├── commands.ts    # Extension commands
│   ├── translationPanel.ts # Webview UI
│   └── statusBar.ts   # Status bar
├── out/               # Compiled JavaScript
├── package.json       # Extension manifest
└── tsconfig.json      # TypeScript config
```

## 🔄 Version Update

1. Sửa `version` trong `package.json`
2. Compile: `npm run compile`
3. Package: `vsce package --allow-missing-repository`
4. Install: `code --install-extension lm-translator-x.x.x.vsix`

## 🧪 Testing

1. Chạy LM Studio với model đã load
2. Nhấn `F5` trong VSCode
3. Test các tính năng:
   - Hover lên comment
   - Select text → Right-click → Translate
   - Click status bar
   - `Ctrl+Shift+T` / `Ctrl+Shift+M`
