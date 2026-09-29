' TasteCraft - Silent Background Service Stopper
Option Explicit
Dim sh, cmd
Set sh = CreateObject("WScript.Shell")

' Stop any TasteCraft python/pythonw process and free port 8000 safely
cmd = "powershell.exe -WindowStyle Hidden -Command ""Get-Process python, pythonw -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*hrb-meal-planner*' } | Stop-Process -Force -ErrorAction SilentlyContinue; $conn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue; if ($conn) { Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue }"""
sh.Run cmd, 0, True
