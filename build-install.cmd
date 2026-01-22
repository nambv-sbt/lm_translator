@echo off
echo ========================================
echo  LM Translator - Build ^& Install
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] Compiling TypeScript...
call npm run compile
if errorlevel 1 (
    echo ERROR: Compile failed!
    pause
    exit /b 1
)

echo.
echo [2/4] Packaging extension...
call vsce package --allow-missing-repository
if errorlevel 1 (
    echo ERROR: Package failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Installing extension...
for /f "delims=" %%i in ('dir /b /o-d *.vsix 2^>nul') do (
    set "VSIX_FILE=%%i"
    goto :install
)

echo ERROR: No VSIX file found!
pause
exit /b 1

:install
echo Installing: %VSIX_FILE%
code --install-extension "%VSIX_FILE%" --force
if errorlevel 1 (
    echo ERROR: Installation failed!
    pause
    exit /b 1
)

echo.
echo [4/4] Done!
echo ========================================
echo  Build ^& Install completed!
echo ========================================
echo.
echo Please reload VSCode:
echo   Ctrl+Shift+P ^> "Reload Window"
echo.
pause
