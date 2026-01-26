# Changelog

All notable changes to this project will be documented in this file.

## [0.0.3] - 2026-01-26
### Fixed
- Fixed extension activation failure caused by initialization order of `StatusBarManager` vs `TranslationServiceManager`.
- Fixed `google-translate-api-x` import issue by loading it dynamically to support ESM.

## [0.0.2] - 2026-01-26
### Added
- Added support for **Google Translate** provider.
- Added `lmTranslator.provider` setting to switch between LM Studio and Google Translate.
- Added **Target Language** selector to the Translation Panel.
- Added comprehensive status bar indicators for connection and caching.
- Implemented `TranslationServiceManager` for extensible provider support.

### Changed
- Refactored `LMStudioService` to implement generic `ITranslationService`.
- Updated `README.md` with new features and settings.

## [0.0.1] - Initial Release
- Basic LM Studio integration.
- Hover translation.
- Inline decorations.
- Translation panel.
