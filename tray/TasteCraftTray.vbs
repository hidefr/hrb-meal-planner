' TasteCraft - System Tray Monitor Launcher
Option Explicit
Dim sh, cmd
Set sh = CreateObject("WScript.Shell")
cmd = "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File ""C:\antigravity-projects\hrb-meal-planner\tray\TasteCraftTray.ps1"""
sh.Run cmd, 0, False
