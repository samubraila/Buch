@echo off
title LeseWelt
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  python server.py
) else (
  where py >nul 2>nul && py server.py || (
    echo Python wurde nicht gefunden. Bitte von https://www.python.org installieren.
    pause
  )
)
