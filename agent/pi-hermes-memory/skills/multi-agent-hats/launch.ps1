#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Launch all multi-agent hat sessions in Windows Terminal tabs.

.DESCRIPTION
    Opens one Windows Terminal tab per hat-agent, each colour-coded and titled
    to reflect its role. The Orchestrator also gets /launch-expert so new
    specialist agents can be spun up on demand without leaving the session.

.PARAMETER Project
    Coms project namespace shared by all agents.
    Default: name of the current directory.

.PARAMETER Cwd
    Working directory all agents start in.
    Default: current directory at the time the script is run.

.PARAMETER Only
    Comma-separated list of agent names to launch (e.g. "Orchestrator,Coder").
    Default: all agents.

.PARAMETER TimeoutMinutes
    Timeout (minutes) for worker hat agents (Planner, Coder, Tester …).
    The Orchestrator is always fixed at 15 min — it only waits, never works.
    Default: 60.

.EXAMPLE
    .\launch.ps1
.EXAMPLE
    .\launch.ps1 -Project alsmart
.EXAMPLE
    .\launch.ps1 -Only Tester,Reviewer
#>
param(
    [string]   $Project        = "",
    [string]   $Cwd            = (Get-Location).Path,
    [string[]] $Only           = @(),
    [int]      $TimeoutMinutes = 60
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Project)) {
    $Project = Split-Path -Leaf (Get-Location).Path
}

# ── Paths ──────────────────────────────────────────────────────────────────────

$skillDir    = Join-Path $PSScriptRoot "agents"
$ext         = Join-Path $env:USERPROFILE ".pi\agent\extensions\coms.ts"
$hatTitlebar = Join-Path $env:USERPROFILE ".pi\agent\extensions\hat-titlebar.ts"
$hatExpert   = Join-Path $env:USERPROFILE ".pi\agent\extensions\hat-expert.ts"

# ── Agent definitions ──────────────────────────────────────────────────────────
# TimeoutMinutes:
#   Orchestrator = 15  (it only calls coms_await — short is correct)
#   Others       = $TimeoutMinutes param (they do real work)

$agents = @(
    [pscustomobject]@{ Name = "Orchestrator"; Title = "🎩 Orchestrator · Boss";       File = "orchestrator.md"; Color = "#FF7EDB"; TimeoutMinutes = 15 }
    [pscustomobject]@{ Name = "Planner";      Title = "📋 Planner · Strategy";        File = "planner.md";      Color = "#36F9F6"; TimeoutMinutes = $TimeoutMinutes }
    [pscustomobject]@{ Name = "Coder";        Title = "💻 Coder · Implementation";    File = "coder.md";        Color = "#72F1B8"; TimeoutMinutes = $TimeoutMinutes }
    [pscustomobject]@{ Name = "Tester";       Title = "🧪 Tester · QA";              File = "tester.md";       Color = "#FEDE5D"; TimeoutMinutes = $TimeoutMinutes }
    [pscustomobject]@{ Name = "Reviewer";     Title = "🔍 Reviewer · Quality";        File = "reviewer.md";     Color = "#C792EA"; TimeoutMinutes = $TimeoutMinutes }
    [pscustomobject]@{ Name = "Documenter";   Title = "📝 Documenter · Docs";        File = "documenter.md";   Color = "#FF8B39"; TimeoutMinutes = $TimeoutMinutes }
)

# ── Filter to -Only if supplied ────────────────────────────────────────────────

if ($Only.Count -gt 0) {
    $agents = $agents | Where-Object { $Only -contains $_.Name }
    if ($agents.Count -eq 0) {
        Write-Error "None of the specified agents ($($Only -join ', ')) matched."
        exit 1
    }
}

# ── Preflight checks ───────────────────────────────────────────────────────────

foreach ($p in @($ext, $hatTitlebar, $hatExpert)) {
    if (-not (Test-Path $p)) { Write-Error "Extension not found: $p"; exit 1 }
}
foreach ($agent in $agents) {
    $f = Join-Path $skillDir $agent.File
    if (-not (Test-Path $f)) { Write-Error "Agent prompt not found: $f"; exit 1 }
}
if (-not (Test-Path $Cwd -PathType Container)) {
    Write-Error "Working directory not found: $Cwd"; exit 1
}

# ── Banner ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  🎩  Multi-Agent Hat Launcher" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  Project : $Project" -ForegroundColor White
Write-Host "  Cwd     : $Cwd" -ForegroundColor White
Write-Host "  Agents  : $($agents.Title -join ' | ')" -ForegroundColor White
Write-Host ""

# ── Write temp launcher scripts ────────────────────────────────────────────────

$tempDir  = [System.IO.Path]::GetTempPath()
$wtParts  = [System.Collections.Generic.List[string]]::new()
$tempFiles = [System.Collections.Generic.List[string]]::new()

foreach ($agent in $agents) {
    $agentFile    = Join-Path $skillDir $agent.File
    $launcherPath = Join-Path $tempDir "hat-$($agent.Name.ToLower())-$(Get-Random).ps1"
    $tempFiles.Add($launcherPath)

    $timeoutMs    = $agent.TimeoutMinutes * 60 * 1000
    $cwdEsc       = $Cwd          -replace "'", "''"
    $extEsc       = $ext          -replace "'", "''"
    $titlebarEsc  = $hatTitlebar  -replace "'", "''"
    $expertEsc    = $hatExpert    -replace "'", "''"
    $projectEsc   = $Project      -replace "'", "''"
    $agentFileEsc = $agentFile    -replace "'", "''"
    $launcherEsc  = $launcherPath -replace "'", "''"

    # Orchestrator also loads hat-expert so /launch-expert is available there
    if ($agent.Name -eq "Orchestrator") {
        $piCmd = "pi -e '$extEsc' ``
       -e '$titlebarEsc' ``
       -e '$expertEsc' ``
       --project '$projectEsc' ``
       --append-system-prompt '$agentFileEsc'"
    } else {
        $piCmd = "pi -e '$extEsc' ``
       -e '$titlebarEsc' ``
       --project '$projectEsc' ``
       --append-system-prompt '$agentFileEsc'"
    }

    Set-Content -Path $launcherPath -Encoding UTF8 -Value @"
`$env:PI_COMS_TIMEOUT_MS = '$timeoutMs'
Set-Location '$cwdEsc'
try {
    $piCmd
} finally {
    Remove-Item -LiteralPath '$launcherEsc' -ErrorAction SilentlyContinue
}
"@

    $tab = "new-tab --title `"$($agent.Title)`" --tabColor `"$($agent.Color)`" pwsh -NoExit -File `"$launcherPath`""
    $wtParts.Add($tab)
}

# ── Launch Windows Terminal ────────────────────────────────────────────────────

$wtArgs = $wtParts -join " ; "

try {
    Start-Process -FilePath "wt.exe" -ArgumentList $wtArgs
} catch {
    foreach ($f in $tempFiles) { Remove-Item $f -ErrorAction SilentlyContinue }
    Write-Error "Failed to launch Windows Terminal: $_"
    exit 1
}

Write-Host "  ✅  $($agents.Count) tab(s) opened in Windows Terminal." -ForegroundColor Green
Write-Host "  💬  Talk to the 🎩 Orchestrator · Boss tab to start a task." -ForegroundColor Cyan
Write-Host "  🎓  Type /launch-expert <topic> in the Orchestrator to add specialists." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Tip: run  coms_list  in the Orchestrator to verify the pool is up." -ForegroundColor DarkGray
Write-Host ""
