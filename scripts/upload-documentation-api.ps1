<#
.SYNOPSIS
  Копирует documentation_api.pdf с локального ПК на сервер по SCP (OpenSSH).

.DESCRIPTION
  После копирования файл можно открыть на сервере в Cursor/IDE или положить в клон репозитория и закоммитить
  (если документация не секретная). Подставьте свой SSH-хост и путь.

  Требования: Windows 10+ с клиентом OpenSSH (scp) — «Параметры → Приложения → Дополнительные компоненты → OpenSSH Client».

.EXAMPLE
  .\scripts\upload-documentation-api.ps1
.EXAMPLE
  .\scripts\upload-documentation-api.ps1 -RemoteHost "user@shectory.example.ru" -RemoteDir "~/ourdiary"
#>

[CmdletBinding()]
param(
    [string] $LocalPath = "C:\Temp\documentation_api.pdf",
    [string] $RemoteHost = "hoster",
    [string] $RemoteDir = "~/ourdiary",
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
    Write-Error "scp завершился с кодом $LASTEXITCODE. Проверьте: ssh $RemoteHost, ключи, known_hosts, путь на сервере."
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Готово. На сервере, например: ssh $RemoteHost `"cat $RemotePath | head`" или откройте файл в Cursor в каталоге клона."
exit 0
