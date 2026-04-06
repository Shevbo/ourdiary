<#
.SYNOPSIS
  Копирует documentation_api.pdf с локального ПК на сервер по SCP (OpenSSH).

  ВАЖНО: запускать ТОЛЬКО в Windows PowerShell (pwsh или powershell.exe), на своём ПК.
  НЕ вставлять этот файл в bash на Linux (ssh shectory@…). Это не команды оболочки сервера.
  На Linux/macOS используйте: scripts/upload-documentation-api.sh

.DESCRIPTION
  После копирования файл можно открыть на сервере в Cursor/IDE или положить в клон репозитория и закоммитить
  (если документация не секретная).

  По умолчанию: SSH-алиас **shectory-work** (ключ в ~/.ssh, без пароля) и каталог клона **~/workspaces/ourdiary**
  — как в реестре Shectory / deploy-project.sh.

  Требования: Windows 10+ с клиентом OpenSSH (scp) — «Параметры → Приложения → Дополнительные компоненты → OpenSSH Client».

.EXAMPLE
  .\scripts\upload-documentation-api.ps1
.EXAMPLE
  .\scripts\upload-documentation-api.ps1 -RemoteDir "~/ourdiary"
#>

[CmdletBinding()]
param(
    [string] $LocalPath = "C:\Temp\documentation_api.pdf",
    [string] $RemoteHost = "shectory-work",
    [string] $RemoteDir = "~/workspaces/ourdiary",
    [string] $RemoteFileName = "documentation_api.pdf"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $LocalPath)) {
    Write-Error "Файл не найден: $LocalPath"
    exit 1
}

$RemotePath = "$RemoteDir/$RemoteFileName".Replace("//", "/")

Write-Host "Локально:  $LocalPath"
Write-Host "Удалённо: ${RemoteHost}:$RemotePath"
Write-Host ""

# scp из OpenSSH; путь с пробелами передаём как есть — scp на Windows обычно справляется
& scp $LocalPath "${RemoteHost}:$RemotePath"

if ($LASTEXITCODE -ne 0) {
    Write-Error "scp завершился с кодом $LASTEXITCODE. Проверьте: ssh $RemoteHost (без пароля), known_hosts, путь на сервере."
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Готово. На сервере, например: ssh $RemoteHost `"cat $RemotePath | head`" или откройте файл в Cursor в каталоге клона."
exit 0
