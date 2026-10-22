# Gera supabase\seed.sql (com dados reais, ignorado pelo git) a partir de dados\relatorios-2025.json
param([string]$Json = 'dados\relatorios-2025.json')

$raiz = Split-Path -Parent $PSScriptRoot
$dados = [IO.File]::ReadAllText((Join-Path $raiz $Json), [Text.Encoding]::UTF8)
if ($dados.Contains('$json$')) { throw 'O JSON contém o delimitador $json$; ajuste o modelo.' }
$modelo = [IO.File]::ReadAllText((Join-Path $raiz 'supabase\seed-modelo.sql'), [Text.Encoding]::UTF8)
$saida = Join-Path $raiz 'supabase\seed.sql'
[IO.File]::WriteAllText($saida, $modelo.Replace('__DADOS__', $dados), (New-Object Text.UTF8Encoding $false))
Write-Host "Gerado: $saida"
