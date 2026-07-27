# Servidor estatico minimo em PowerShell.
# Existe porque esta maquina nao tem Node nem Python instalados.
param([int]$Port = 4173)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.svg'  = 'image/svg+xml'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
  '.txt'  = 'text/plain; charset=utf-8'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.mp4'  = 'video/mp4'
  '.webm' = 'video/webm'
  '.mov'  = 'video/quicktime'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Servindo $root em http://localhost:$Port/"

while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $res = $ctx.Response
  # HEAD nao pode ter corpo: escrever bytes estoura o Content-Length e gera 500
  $isHead = $ctx.Request.HttpMethod -eq 'HEAD'
  try {
    # UnescapeDataString e necessario: os arquivos tem espacos e acentos
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }

    $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
    # impede sair da pasta do projeto via ../
    if (-not $full.StartsWith($root)) {
      $res.StatusCode = 403
      Write-Host "403 $rel"
      $res.Close(); continue
    }
    if (Test-Path -LiteralPath $full -PathType Container) {
      $full = Join-Path $full 'index.html'
    }

    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ct = $mime[$ext]
      if (-not $ct) { $ct = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $res.ContentType = $ct
      $res.Headers.Add('Cache-Control', 'no-store')
      $res.ContentLength64 = $bytes.Length
      if (-not $isHead) { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
      Write-Host "200 $rel"
    } else {
      $res.StatusCode = 404
      $b = [System.Text.Encoding]::UTF8.GetBytes('404 - nao encontrado')
      $res.ContentLength64 = $b.Length
      if (-not $isHead) { $res.OutputStream.Write($b, 0, $b.Length) }
      Write-Host "404 $rel"
    }
  } catch {
    try { $res.StatusCode = 500 } catch {}
    Write-Host "500 $($_.Exception.Message)"
  } finally {
    try { $res.Close() } catch {}
  }
}
