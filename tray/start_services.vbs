' TasteCraft - Silent Background Service Starter
Option Explicit
Dim sh, fso, scriptDir, projectRoot, backendDir, pythonExe, runCmd

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectRoot = fso.GetParentFolderName(scriptDir)
backendDir = projectRoot & "\backend"
pythonExe = backendDir & "\.venv\Scripts\python.exe"

sh.CurrentDirectory = backendDir
runCmd = Chr(34) & pythonExe & Chr(34) & " run.py"
sh.Run runCmd, 0, False
