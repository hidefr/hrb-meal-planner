@echo off
title TasteCraft Meal Planner
echo ========================================================
echo   TasteCraft Meal Planner & Grocery Copilot
echo   Local:   http://localhost:8000
echo   Network: http://192.168.0.47:8000 (for Mobile Phones)
echo ========================================================
cd /d "%~dp0backend"
call .venv\Scripts\activate.bat
python run.py
pause
