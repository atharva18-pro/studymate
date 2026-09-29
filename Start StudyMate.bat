@echo off
cd /d "%~dp0"
title StudyMate Server
echo Starting StudyMate at http://localhost:3000 ...
echo Keep this window open while using the app. Close it to stop the server.
echo.
node server/index.js
pause
