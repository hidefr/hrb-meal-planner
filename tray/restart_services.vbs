' TasteCraft - Silent Background Service Restarter
Option Explicit
Dim sh, fso, scriptDir, stopScript, startScript

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
stopScript = scriptDir & "\stop_services.vbs"
startScript = scriptDir & "\start_services.vbs"

' 1. Stop existing process and wait for completion
sh.Run "wscript.exe " & Chr(34) & stopScript & Chr(34), 0, True

' 2. Clean pause for socket release
WScript.Sleep 1500

' 3. Start fresh process and wait for launcher to finish
sh.Run "wscript.exe " & Chr(34) & startScript & Chr(34), 0, True
