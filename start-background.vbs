Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\backend"
WshShell.Run Chr(34) & WshShell.CurrentDirectory & "\.venv\Scripts\python.exe" & Chr(34) & " run.py", 0, False
