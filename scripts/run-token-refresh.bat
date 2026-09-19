@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
"C:\Program Files\nodejs\node.exe" scripts\refresh-instagram-token.js >> logs\token-refresh.log 2>&1
