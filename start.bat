@echo off
setlocal
cd /d "%~dp0"
start "Codex Dashboard Backend" cmd /k "cd backend && npm.cmd run dev"
start "Codex Dashboard Frontend" cmd /k "cd frontend && npm.cmd run dev"
echo Codex Dashboard starting...
echo Frontend: http://localhost:5174
echo Backend:  http://localhost:3132
