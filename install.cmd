@echo off
echo ========================================
echo  LM Translator - Install Script
echo ========================================
echo.

cd /d "%~dp0"

:: Find the latest VSIX file
for /f "delims=" %%i in ('dir /b /o-d *.vsix 2^>nul') do (
    set "VSIX_FILE=%%i"
    goto :found
)

echo ERROR: No VSIX file found!
echo Please run build.cmd first.
pause
exit /b 1

:found
echo Installing: %VSIX_FILE%
echo.

code --install-extension "%VSIX_FILE%" --force
if errorlevel 1 (
    echo ERROR: Installation failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Extension installed successfully!
echo ========================================
echo.
echo Please reload VSCode:
echo   Ctrl+Shift+P ^> "Reload Window"
echo.
pause
