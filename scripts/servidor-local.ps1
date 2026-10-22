# Servidor local simples para testar o app em http://localhost:8080
# Uso: powershell -ExecutionPolicy Bypass -File scripts\servidor-local.ps1
param([int]$Porta = 8080)

$raiz = Split-Path -Parent $PSScriptRoot
$tipos = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'
  '.webmanifest' = 'application/manifest+json'
}

$http = New-Object System.Net.HttpListener
$http.Prefixes.Add("http://localhost:$Porta/")
$http.Start()
Write-Host "Servindo $raiz em http://localhost:$Porta/ (Ctrl+C para parar)"

try {
  while ($http.IsListening) {
    $ctx = $http.GetContext()
    $caminho = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($caminho -eq '') { $caminho = 'index.html' }
    $arquivo = Join-Path $raiz $caminho
    $completo = [IO.Path]::GetFullPath($arquivo)
    if ($completo.StartsWith($raiz) -and (Test-Path $completo -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($completo)
      $ext = [IO.Path]::GetExtension($completo).ToLower()
      $ctx.Response.ContentType = if ($tipos[$ext]) { $tipos[$ext] } else { 'application/octet-stream' }
      $ctx.Response.Headers.Add('Cache-Control', 'no-store')
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  }
} finally {
  $http.Stop()
}
