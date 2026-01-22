@echo off
echo ========================================
echo  LM Translator - Build Script
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Compiling TypeScript...
call npm run compile
if errorlevel 1 (
    echo ERROR: Compile failed!
    pause
    exit /b 1
)

echo.
echo [2/3] Packaging extension...
call vsce package --allow-missing-repository
if errorlevel 1 (
    echo ERROR: Package failed!
    pause
    exit /b 1
)

echo.
echo [3/3] Done!
echo ========================================
echo  VSIX file created successfully!
echo ========================================
echo.
dir /b *.vsix
echo.
pause
