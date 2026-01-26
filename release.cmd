@echo off
setlocal
echo ========================================
echo  LM Translator - Release Script
echo ========================================
echo.

:: Check for uncommitted changes
git diff-index --quiet HEAD --
if errorlevel 1 (
    echo [ERROR] You have uncommitted changes. Please commit or stash them first.
    exit /b 1
)

:: Select release type
echo Select release type:
echo 1. Patch (0.0.x)
echo 2. Minor (0.x.0)
echo 3. Major (x.0.0)
echo.
set /p choice="Enter choice (1-3): "

if "%choice%"=="1" set TYPE=patch
if "%choice%"=="2" set TYPE=minor
if "%choice%"=="3" set TYPE=major

if not defined TYPE (
    echo Invalid choice. Exiting.
    exit /b 1
)

echo.
echo [1/5] Bumping version (%TYPE%)...
call npm version %TYPE% --no-git-tag-version
if errorlevel 1 exit /b 1

:: Get new version
for /f "tokens=*" %%i in ('node -p "require('./package.json').version"') do set VERSION=%%i

echo.
echo [2/5] New version is: %VERSION%
echo.
echo PLEASE UPDATE CHANGELOG.md NOW!
echo Add an entry for [%VERSION%] with today's date.
echo.
echo Press any key when you have updated CHANGELOG.md...
pause >nul

echo.
echo [3/6] Building VSIX package...
call vsce package --allow-missing-repository
if errorlevel 1 (
    echo [ERROR] Build failed.
    exit /b 1
)

echo.
echo [4/6] Committing changes...
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v%VERSION%"

echo.
echo [5/6] Creating tag v%VERSION%...
git tag v%VERSION%

echo.
echo [6/6] Pushing to GitHub...
git push origin main
git push origin v%VERSION%

echo.
echo [7/7] Creating GitHub Release...
where gh >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARN] GitHub CLI 'gh' not found. Skipping release creation.
    echo Please manually create release v%VERSION% and upload 'lm-translator-%VERSION%.vsix'.
) else (
    echo Creating release v%VERSION% and uploading VSIX...
    gh release create v%VERSION% "lm-translator-%VERSION%.vsix" --title "v%VERSION%" --notes-file CHANGELOG.md
    if errorlevel 1 (
        echo [WARN] Failed to create GitHub release. Check your 'gh' auth status.
    ) else (
        echo GitHub Release created successfully!
    )
)

echo.
echo ========================================
echo  Release v%VERSION% completed!
echo ========================================
echo.
pause
