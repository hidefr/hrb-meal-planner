' =============================================================================
' TasteCraft Unified Web App & Services Launcher
' Ensures the System Tray Monitor and backend server are running,
' then opens TasteCraft in the default browser.
' =============================================================================
Option Explicit
Dim sh, fso, scriptDir, projectRoot, wmi, colProcesses

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
Set wmi = GetObject("winmgmts:\\.\root\cimv2")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectRoot = fso.GetParentFolderName(scriptDir)
sh.CurrentDirectory = projectRoot

' 1. Ensure System Tray Monitor is running
Set colProcesses = wmi.ExecQuery("Select ProcessId from Win32_Process Where CommandLine Like '%TasteCraftTray.ps1%'")
If colProcesses.Count = 0 Then
    sh.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & scriptDir & "\TasteCraftTray.ps1""", 0, False
End If

' 2. Ensure Backend Service is running on port 8000
Set colProcesses = wmi.ExecQuery("Select ProcessId from Win32_Process Where CommandLine Like '%backend%' And CommandLine Like '%run.py%'")
If colProcesses.Count = 0 Then
    sh.Run "wscript.exe """ & scriptDir & "\start_services.vbs""", 0, True
    WScript.Sleep 1000
End If

' 3. Open TasteCraft in the browser
sh.Run "http://localhost:8000", 1, False
