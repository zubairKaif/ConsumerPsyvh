@echo off
rem QuikKart: serves this folder at http://localhost:8000 and opens the app in the browser.
rem Keep this window open while you use the app. Close it to stop the server.
cd /d "%~dp0"
rem Accept only a Python 3 that has http.server (rejects Python 2 and the Microsoft Store stub).
set "PY="
python -c "import http.server" >nul 2>&1 && set "PY=python"
if not defined PY (py -3 -c "import http.server" >nul 2>&1 && set "PY=py -3")
if not defined PY (
  echo Python 3 was not found.
  echo Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH",
  echo then double-click this file again.
  pause
  exit /b 1
)
echo Starting QuikKart at http://localhost:8000/QuikKart_Stimulus_App.html
echo Keep this window open during the session. Close it to stop.
start "" /b cmd /c "ping -n 3 127.0.0.1 >nul & start "" http://localhost:8000/QuikKart_Stimulus_App.html"
%PY% -m http.server 8000 --bind 127.0.0.1
pause
