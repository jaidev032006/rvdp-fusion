@echo off
title RVDP-FUSION
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Download from https://nodejs.org then run this again. & pause & exit /b)
start "" http://localhost:3000
node server.js
pause
