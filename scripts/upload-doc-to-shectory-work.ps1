#requires -Version 5.1
# Skript PowerShell. Ne pereimenovyvajte .sh v .ps1. Sohranite kak UTF-8 s BOM.

<#
.SYNOPSIS
  Otpravka fajla na shectory-work v proekt/docs/
.DESCRIPTION
  Nuzhny ssh i scp (Windows: OpenSSH Client).
.EXAMPLE
  .\upload-doc-to-shectory-work.ps1 -FilePath C:\dev\doc.docx -ProjectNumber 2 -Yes
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string] $FilePath,
  [Parameter(Position = 1)]
  [int] $ProjectNumber = 0,
  [Alias('y')]
  [switch] $Yes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-OpenSshAvailable {
  if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    throw "Ne najden ssh. Ustanovite OpenSSH Client: Parametry Windows - Prilozhenija - Dopolnitelnye komponenty."
  }
  if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
    throw "Ne najden scp (OpenSSH Client)."
  }
}

function Resolve-LocalFile {
  param([Parameter(Mandatory)][string] $Path)
  $p = $Path.Trim()
  if ($p.StartsWith('~')) {
    $p = $env:USERPROFILE + $p.Substring(1)
  }
  if (-not (Test-Path -LiteralPath $p -PathType Leaf)) {
    throw "Net takogo fajla: $p"
  }
  return (Resolve-Path -LiteralPath $p).Path
}

function Get-ProjectsFromFile {
  param([string] $ListPath)
  if (-not (Test-Path -LiteralPath $ListPath -PathType Leaf)) {
    return @()
  }
  Get-Content -LiteralPath $ListPath -Encoding UTF8 |
    ForEach-Object {
      $line = ($_ -split '#', 2)[0].Trim()
      if ($line) { $line }
    }
}

function Get-ProjectsFromRemote {
  param(
    [string] $RemoteHostName,
    [string] $WorkspacesSegment
  )
  $remoteCmd = 'test -d "$HOME/' + $WorkspacesSegment + '" && ls -1 "$HOME/' + $WorkspacesSegment + '"'
  try {
    $out = & ssh -q -o ConnectTimeout=12 -o BatchMode=no $RemoteHostName $remoteCmd 2>$null
  }
  catch {
    return @()
  }
  if ($LASTEXITCODE -ne 0) { return @() }
  if (-not $out) { return @() }
  $list = @($out)
  return @(
    $list |
      ForEach-Object { $_.Trim() } |
      Where-Object { $_ -and ($_ -notmatch '^\.') }
  )
}

function Show-ProjectMenu {
  param(
    [string[]] $Projects,
    [string] $RemoteHostName,
    [string] $WorkspacesSegment
  )
  Write-Host ""
  Write-Host "Kuda polozhit (papka docs v proekte na ${RemoteHostName}):"
  for ($i = 0; $i -lt $Projects.Count; $i++) {
    $name = $Projects[$i]
    Write-Host ("  {0}) {1}  ->  ~/{2}/{1}/docs/" -f ($i + 1), $name, $WorkspacesSegment)
  }
  Write-Host ""
}

Test-OpenSshAvailable

$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$RemoteHost = if ($env:REMOTE_HOST) { $env:REMOTE_HOST } else { 'shectory-work' }
$RemoteWorkspaces = if ($env:REMOTE_WORKSPACES) { $env:REMOTE_WORKSPACES } else { 'workspaces' }
$ProjectsFile = if ($env:SHECTORY_DOCS_PROJECTS_FILE) {
  $env:SHECTORY_DOCS_PROJECTS_FILE
}
else {
  Join-Path $ScriptDir 'shectory-work-docs-projects.list'
}

if (-not $FilePath) {
  $FilePath = Read-Host 'Polnyj put k fajlu'
}
if ([string]::IsNullOrWhiteSpace($FilePath)) {
  throw 'Put pustoj.'
}
$LocalPath = Resolve-LocalFile -Path $FilePath
$BaseName = Split-Path -Leaf $LocalPath

$projects = @(Get-ProjectsFromRemote -RemoteHostName $RemoteHost -WorkspacesSegment $RemoteWorkspaces)
if ($projects.Count -gt 0) {
  Write-Host "(Spisok s ${RemoteHost}, ~/${RemoteWorkspaces}/)" -ForegroundColor DarkGray
}
else {
  Write-Host "Ne udalos po SSH; probuju fajl $ProjectsFile" -ForegroundColor Yellow
  $projects = @(Get-ProjectsFromFile -ListPath $ProjectsFile)
  if ($projects.Count -eq 0) {
    Write-Host 'Zapas: tolko ourdiary.' -ForegroundColor Yellow
    $projects = @('ourdiary')
  }
}

if ($ProjectNumber -lt 1) {
  Show-ProjectMenu -Projects $projects -RemoteHostName $RemoteHost -WorkspacesSegment $RemoteWorkspaces
  $in = Read-Host "Nomer proekta [1-$($projects.Count)]"
  $parsedN = 0
  if (-not [int]::TryParse($in.Trim(), [ref]$parsedN)) {
    throw "Vvedite chislo ot 1 do $($projects.Count)."
  }
  $ProjectNumber = $parsedN
}

if ($ProjectNumber -lt 1 -or $ProjectNumber -gt $projects.Count) {
  throw "Nomer ot 1 do $($projects.Count)."
}

$proj = $projects[$ProjectNumber - 1]
$remoteTarget = "${RemoteHost}:~/${RemoteWorkspaces}/${proj}/docs/${BaseName}"

Write-Host ""
Write-Host "Lokalno:   $LocalPath"
Write-Host "Udalenno:  $remoteTarget"
Write-Host ""

if (-not $Yes) {
  $confirm = Read-Host 'Otpravit? [y/N]'
  if ($confirm -notmatch '^(y|yes)$') {
    Write-Host 'Otmeneno.'
    exit 0
  }
}

$mkdirCmd = 'mkdir -p "$HOME/' + $RemoteWorkspaces + '/' + $proj + '/docs"'

& ssh -q -o ConnectTimeout=12 $RemoteHost $mkdirCmd
if ($LASTEXITCODE -ne 0) {
  throw "ssh mkdir kod $LASTEXITCODE"
}

& scp $LocalPath $remoteTarget
if ($LASTEXITCODE -ne 0) {
  throw "scp kod $LASTEXITCODE"
}

Write-Host 'Gotovo.'
