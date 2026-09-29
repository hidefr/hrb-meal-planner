' TasteCraft - Silent Background Service Starter
Option Explicit
Dim sh, fso, scriptDir, projectRoot, pythonExe, cmd

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectRoot = fso.GetParentFolderName(scriptDir)
pythonExe = projectRoot & "\backend\.venv\Scripts\python.exe"

' Launch detached background python process using Start-Process with WindowStyle Hidden
cmd = "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -Command ""Start-Process -FilePath '" & pythonExe & "' -ArgumentList 'run.py' -WorkingDirectory '" & projectRoot & "\backend' -WindowStyle Hidden"""
sh.Run cmd, 0, True
