#!/bin/bash
# QuikKart: serves this folder at http://localhost:8000 and opens the app in the browser.
# Keep this window open while you use the app. Press Ctrl+C or close the window to stop.
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then PY=python3
elif command -v python >/dev/null 2>&1 && python -c 'import sys; sys.exit(sys.version_info[0] < 3)'; then PY=python
else
  echo "Python 3 was not found. Install it from https://www.python.org/downloads/ and open this file again."
  read -r -p "Press Enter to close."
  exit 1
fi
echo "Starting QuikKart at http://localhost:8000/QuikKart_Stimulus_App.html"
echo "Keep this window open during the session. Press Ctrl+C or close it to stop."
(sleep 2; open "http://localhost:8000/QuikKart_Stimulus_App.html") &
exec "$PY" -m http.server 8000 --bind 127.0.0.1
