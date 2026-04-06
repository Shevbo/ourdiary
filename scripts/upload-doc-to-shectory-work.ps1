# Важно: это скрипт PowerShell (.ps1). Файл bash (.sh) нельзя переименовывать в .ps1 — синтаксис другой.
# Скопируйте из репозитория именно upload-doc-to-shectory-work.ps1 или запускайте .sh в Git Bash/WSL.

#requires -Version 5.1
<#
.SYNOPSIS
  Отправка файла на shectory-work в <проект>/docs/ (аналог upload-doc-to-shectory-work.sh).

.DESCRIPTION
  Нужны ssh и scp в PATH (Компоненты Windows: OpenSSH Client).
  Интерактивно: путь к файлу и номер проекта из списка ~/workspaces на удалённой машине.

.EXAMPLE
  .\upload-doc-to-shectory-work.ps1
  .\upload-doc-to-shectory-work.ps1 -FilePath 'C:\dev\TabscannerAPI.docx' -ProjectNumber 2
  .\upload-doc-to-shectory-work.ps1 -FilePath 'C:\x\y.pdf' -ProjectNumber 1 -Yes

  Переменные окружения: REMOTE_HOST, REMOTE_WORKSPACES, SHECTORY_DOCS_PROJECTS_FILE
  Кодировка скрипта: UTF-8 (для Windows PowerShell 5.1 при кириллице удобно UTF-8 с BOM).
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
    throw "Не найден ssh. Установите «OpenSSH Клиент» (Параметры Windows → Приложения → Дополнительные компоненты)."
  }
  if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
    throw "Не найден scp (часть OpenSSH Client)."
  }
}

function Resolve-LocalFile {
  param([Parameter(Mandatory)][string] $Path)
  $p = $Path.Trim()
  if ($p.StartsWith('~')) {
    $p = $env:USERPROFILE + $p.Substring(1)
  }
  if (-not (Test-Path -LiteralPath $p -PathType Leaf)) {
    throw "Нет такого файла: $p"
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
  # Одна строка для удалённого bash: каталог $HOME/<workspaces>
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
  Write-Host "Куда положить (папка docs внутри проекта на ${RemoteHostName}):"
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

# --- локальный файл ---
if (-not $FilePath) {
  $FilePath = Read-Host 'Полный путь к файлу для отправки'
}
if ([string]::IsNullOrWhiteSpace($FilePath)) {
  throw 'Путь к файлу пустой.'
}
$LocalPath = Resolve-LocalFile -Path $FilePath
$BaseName = Split-Path -Leaf $LocalPath

# --- список проектов ---
$projects = @(Get-ProjectsFromRemote -RemoteHostName $RemoteHost -WorkspacesSegment $RemoteWorkspaces)
if ($projects.Count -gt 0) {
  Write-Host "(Список каталогов с ${RemoteHost}, ~/${RemoteWorkspaces}/)" -ForegroundColor DarkGray
}
else {
  Write-Host "Не удалось получить список по SSH; пробую файл $ProjectsFile" -ForegroundColor Yellow
  $projects = @(Get-ProjectsFromFile -ListPath $ProjectsFile)
  if ($projects.Count -eq 0) {
    Write-Host 'Используется запасной вариант: только ourdiary.' -ForegroundColor Yellow
    $projects = @('ourdiary')
  }
}

# --- выбор проекта ---
if ($ProjectNumber -lt 1) {
  Show-ProjectMenu -Projects $projects -RemoteHostName $RemoteHost -WorkspacesSegment $RemoteWorkspaces
  $in = Read-Host "Номер проекта [1-$($projects.Count)]"
  $parsedN = 0
  if (-not [int]::TryParse($in.Trim(), [ref]$parsedN)) {
    throw "Введите число от 1 до $($projects.Count)."
  }
  $ProjectNumber = $parsedN
}

if ($ProjectNumber -lt 1 -or $ProjectNumber -gt $projects.Count) {
  throw "Номер должен быть от 1 до $($projects.Count)."
}

$proj = $projects[$ProjectNumber - 1]
$remoteTarget = "${RemoteHost}:~/${RemoteWorkspaces}/${proj}/docs/${BaseName}"

Write-Host ""
Write-Host "Локально:   $LocalPath"
Write-Host "Удалённо:   $remoteTarget"
Write-Host ""

if (-not $Yes) {
  $confirm = Read-Host 'Отправить? [y/N]'
  if ($confirm -notmatch '^(y|yes)$') {
    Write-Host 'Отменено.'
    exit 0
  }
}

# Команда для удалённого bash; $HOME раскрывается на сервере (в PowerShell не подставляем)
$mkdirCmd = 'mkdir -p "$HOME/' + $RemoteWorkspaces + '/' + $proj + '/docs"'

& ssh -q -o ConnectTimeout=12 $RemoteHost $mkdirCmd
if ($LASTEXITCODE -ne 0) {
  throw "ssh mkdir завершился с кодом $LASTEXITCODE"
}

& scp $LocalPath $remoteTarget
if ($LASTEXITCODE -ne 0) {
  throw "scp завершился с кодом $LASTEXITCODE"
}

Write-Host 'Готово.'
