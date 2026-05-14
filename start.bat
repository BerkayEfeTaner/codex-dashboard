@echo off
setlocal
cd /d "%~dp0"
start "Codex Dashboard Backend" cmd /k "cd backend && npm.cmd run dev"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddSeconds(20); do { try { $response=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3132/api/health -TimeoutSec 1; if ($response.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Milliseconds 500 } while ((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 (
  echo Backend did not become healthy on http://127.0.0.1:3132
  echo Frontend was not started to avoid API 502.
  exit /b 1
)
start "Codex Dashboard Frontend" cmd /k "cd frontend && npm.cmd run dev -- --host 127.0.0.1"
echo Codex Dashboard starting...
echo Frontend: http://127.0.0.1:5174
echo Backend:  http://127.0.0.1:3132
