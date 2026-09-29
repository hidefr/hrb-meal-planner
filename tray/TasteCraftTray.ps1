# =============================================================================
# TasteCraft - Windows System Tray Appliance Monitor
# =============================================================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# 1. Single-Instance Mutex
$mutexName = "Local\TasteCraftTrayMonitor"
$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, $mutexName, [ref]$createdNew)
if (-not $createdNew) {
    [System.Windows.Forms.MessageBox]::Show(
        "TasteCraft Tray is already running in your notification area.",
        "TasteCraft",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    )
    exit
}

# 2. Directory Paths
$ScriptDir    = if ($PSScriptRoot) { $PSScriptRoot } else { "C:\antigravity-projects\hrb-meal-planner\tray" }
$ProjectRoot  = Split-Path -Parent $ScriptDir
$BackendDir   = Join-Path $ProjectRoot "backend"
$DataDir      = Join-Path $BackendDir "data"
$VenvPython   = Join-Path $BackendDir ".venv\Scripts\python.exe"

# 3. Dynamic High-DPI State Icon Generation
function Create-StateIcon([string]$state) {
    $bmp = New-Object System.Drawing.Bitmap 32, 32
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.Clear([System.Drawing.Color]::Transparent)

    $color = switch ($state) {
        'online'  { [System.Drawing.Color]::FromArgb(46, 204, 113) }  # Emerald Green
        'busy'    { [System.Drawing.Color]::FromArgb(243, 156, 18) }  # Warm Amber
        default   { [System.Drawing.Color]::FromArgb(231, 76, 60) }   # Crimson Red
    }

    # Outer colored circle
    $brush = New-Object System.Drawing.SolidBrush $color
    $g.FillEllipse($brush, 2, 2, 28, 28)

    # Clean white inner border
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 255)), 2.2
    $g.DrawEllipse($pen, 3.5, 3.5, 25, 25)

    # Central Glyph "TC" (or "~" for busy)
    $char = if ($state -eq 'busy') { "~" } else { "TC" }
    $fontSize = if ($char -eq "TC") { 9.5 } else { 12 }
    $font = New-Object System.Drawing.Font ("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold)
    $whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    $g.DrawString($char, $font, $whiteBrush, (New-Object System.Drawing.RectangleF 0, 1, 32, 32), $sf)

    $hIcon = $bmp.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)

    $brush.Dispose()
    $pen.Dispose()
    $whiteBrush.Dispose()
    $font.Dispose()
    $g.Dispose()
    $bmp.Dispose()
    return $icon
}

# Cache status icons to eliminate GDI handle leaks
$script:iconCache = @{
    'online'  = Create-StateIcon 'online'
    'busy'    = Create-StateIcon 'busy'
    'offline' = Create-StateIcon 'offline'
}
$script:currentState = ""
$script:localIp = "127.0.0.1"

# Helper to find current LAN IP
function Get-LanIp {
    try {
        $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
            $_.InterfaceAlias -match "Wi-Fi|Wireless|Ethernet" -and $_.IPAddress -notlike "169.254*" 
        } | Select-Object -First 1).IPAddress
        if ($ip) { return $ip }
    } catch {}
    return "127.0.0.1"
}
$script:localIp = Get-LanIp

# 4. Fast Non-Blocking Status Probe
function Get-ServerStatus {
    $portOpen = $false
    $healthy  = $false
    $model    = ""

    # Socket probe on port 8000 (<200ms)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $ar = $tcp.BeginConnect([System.Net.IPAddress]::Loopback, 8000, $null, $null)
        if ($ar.AsyncWaitHandle.WaitOne(200, $false) -and $tcp.Connected) {
            $portOpen = $true
            $tcp.EndConnect($ar)
        }
        $tcp.Close()
    } catch {}

    # If socket responded, verify health endpoint
    if ($portOpen) {
        try {
            $res = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($res -and $res.status -eq "healthy") {
                $healthy = $true
                $model = $res.llm_model
            }
        } catch {
            $healthy = $true # Port is open and answering
        }
    }

    return [PSCustomObject]@{
        Running = $portOpen
        Healthy = $healthy
        Model   = $model
    }
}

# 5. Service Control Operations
function Start-TasteCraft {
    $script = Join-Path $ScriptDir "start_services.vbs"
    if (Test-Path $script) {
        Start-Process "wscript.exe" "`"$script`"" -WindowStyle Hidden
    }
}

function Stop-TasteCraft {
    $script = Join-Path $ScriptDir "stop_services.vbs"
    if (Test-Path $script) {
        Start-Process "wscript.exe" "`"$script`"" -WindowStyle Hidden
    }
}

function Restart-TasteCraft {
    $script = Join-Path $ScriptDir "restart_services.vbs"
    if (Test-Path $script) {
        Start-Process "wscript.exe" "`"$script`"" -WindowStyle Hidden
    }
}

# 6. UI Setup: NotifyIcon & Context Menu
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip
$notifyIcon.ContextMenuStrip = $contextMenu

# Status Header Item
$menuHeader = New-Object System.Windows.Forms.ToolStripMenuItem
$menuHeader.Enabled = $false
$menuHeader.Font = New-Object System.Drawing.Font ($contextMenu.Font, [System.Drawing.FontStyle]::Bold)
$contextMenu.Items.Add($menuHeader) | Out-Null

$menuPortInfo = New-Object System.Windows.Forms.ToolStripMenuItem
$menuPortInfo.Enabled = $false
$contextMenu.Items.Add($menuPortInfo) | Out-Null

$menuMobileInfo = New-Object System.Windows.Forms.ToolStripMenuItem
$menuMobileInfo.Enabled = $false
$contextMenu.Items.Add($menuMobileInfo) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# Service Control Actions
$menuStart = New-Object System.Windows.Forms.ToolStripMenuItem
$menuStart.Text = "Start TasteCraft"
$menuStart.Add_Click({
    $notifyIcon.Icon = $script:iconCache['busy']
    $notifyIcon.Text = "TasteCraft: Starting..."
    $notifyIcon.ShowBalloonTip(2000, "TasteCraft", "Starting TasteCraft server on port 8000...", [System.Windows.Forms.ToolTipIcon]::Info)
    Start-TasteCraft
})
$contextMenu.Items.Add($menuStart) | Out-Null

$menuStop = New-Object System.Windows.Forms.ToolStripMenuItem
$menuStop.Text = "Stop TasteCraft"
$menuStop.Add_Click({
    $notifyIcon.Icon = $script:iconCache['busy']
    $notifyIcon.Text = "TasteCraft: Stopping..."
    $notifyIcon.ShowBalloonTip(2000, "TasteCraft", "Stopping TasteCraft services...", [System.Windows.Forms.ToolTipIcon]::Info)
    Stop-TasteCraft
})
$contextMenu.Items.Add($menuStop) | Out-Null

$menuRestart = New-Object System.Windows.Forms.ToolStripMenuItem
$menuRestart.Text = "Restart TasteCraft"
$menuRestart.Add_Click({
    $notifyIcon.Icon = $script:iconCache['busy']
    $notifyIcon.Text = "TasteCraft: Restarting..."
    $notifyIcon.ShowBalloonTip(2000, "TasteCraft", "Restarting TasteCraft services...", [System.Windows.Forms.ToolTipIcon]::Info)
    Restart-TasteCraft
})
$contextMenu.Items.Add($menuRestart) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# Launch & Copy Actions
$menuOpenBrowser = New-Object System.Windows.Forms.ToolStripMenuItem
$menuOpenBrowser.Text = "Open Web App (Browser)"
$menuOpenBrowser.Font = New-Object System.Drawing.Font ($contextMenu.Font, [System.Drawing.FontStyle]::Bold)
$menuOpenBrowser.Add_Click({
    Start-Process "http://localhost:8000"
})
$contextMenu.Items.Add($menuOpenBrowser) | Out-Null

$menuCopyMobile = New-Object System.Windows.Forms.ToolStripMenuItem
$menuCopyMobile.Text = "Copy Mobile URL for Phones"
$menuCopyMobile.Add_Click({
    $mobileUrl = "http://" + $script:localIp + ":8000"
    [System.Windows.Forms.Clipboard]::SetText($mobileUrl)
    $notifyIcon.ShowBalloonTip(3000, "TasteCraft Link Copied", "Mobile URL copied to clipboard: $mobileUrl`nOpen Safari or Chrome on your phone to install.", [System.Windows.Forms.ToolTipIcon]::Info)
})
$contextMenu.Items.Add($menuCopyMobile) | Out-Null

$menuOpenDir = New-Object System.Windows.Forms.ToolStripMenuItem
$menuOpenDir.Text = "Open Project Folder"
$menuOpenDir.Add_Click({
    Start-Process "explorer.exe" $ProjectRoot
})
$contextMenu.Items.Add($menuOpenDir) | Out-Null

$menuOpenData = New-Object System.Windows.Forms.ToolStripMenuItem
$menuOpenData.Text = "Open Data Folder"
$menuOpenData.Add_Click({
    if (Test-Path $DataDir) { Start-Process "explorer.exe" $DataDir } else { Start-Process "explorer.exe" $BackendDir }
})
$contextMenu.Items.Add($menuOpenData) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# Exit Tray Menu
$menuExit = New-Object System.Windows.Forms.ToolStripMenuItem
$menuExit.Text = "Exit Tray Monitor"
$menuExit.Add_Click({
    $timer.Stop()
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    if ($mutex) {
        $mutex.ReleaseMutex()
        $mutex.Dispose()
    }
    [System.Windows.Forms.Application]::Exit()
})
$contextMenu.Items.Add($menuExit) | Out-Null

# Double-click tray icon opens local Web App
$notifyIcon.Add_DoubleClick({
    Start-Process "http://localhost:8000"
})

# 7. Update UI Function
function Update-UI {
    $script:localIp = Get-LanIp
    $status = Get-ServerStatus
    $isRunning = $status.Running

    $newState = if ($isRunning) { 'online' } else { 'offline' }

    if ($newState -ne $script:currentState) {
        $notifyIcon.Icon = $script:iconCache[$newState]
        $script:currentState = $newState
    }

    if ($isRunning) {
        $notifyIcon.Text = "TasteCraft: ONLINE (http://" + $script:localIp + ":8000)"
        $menuHeader.Text = "STATUS: TASTECRAFT ONLINE"
        $menuHeader.ForeColor = [System.Drawing.Color]::FromArgb(46, 204, 113)
        $menuPortInfo.Text = "  Local:   http://localhost:8000"
        $menuMobileInfo.Text = "  Mobile:  http://" + $script:localIp + ":8000"
        $menuStart.Enabled = $false
        $menuStop.Enabled = $true
        $menuRestart.Enabled = $true
        $menuOpenBrowser.Enabled = $true
        $menuCopyMobile.Enabled = $true
    } else {
        $notifyIcon.Text = "TasteCraft: OFFLINE (Stopped)"
        $menuHeader.Text = "STATUS: OFFLINE (Stopped)"
        $menuHeader.ForeColor = [System.Drawing.Color]::FromArgb(231, 76, 60)
        $menuPortInfo.Text = "  Local:   Port 8000 (Inactive)"
        $menuMobileInfo.Text = "  Mobile:  http://" + $script:localIp + ":8000 (Waiting)"
        $menuStart.Enabled = $true
        $menuStop.Enabled = $false
        $menuRestart.Enabled = $false
        $menuOpenBrowser.Enabled = $false
        $menuCopyMobile.Enabled = $true
    }
}

$contextMenu.Add_Opening({
    Update-UI
})

# 8. Background Polling Timer (every 3.5 seconds)
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3500
$timer.Add_Tick({
    Update-UI
})

# Auto-start service on tray launch if offline
$initStatus = Get-ServerStatus
if (-not $initStatus.Running) {
    Start-TasteCraft
}

# Initial setup
Update-UI
$notifyIcon.Visible = $true
$timer.Start()

# 9. Application Loop
[System.Windows.Forms.Application]::Run()
