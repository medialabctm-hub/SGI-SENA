# Script de verificación de Flutter para Windows
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verificación de Instalación de Flutter" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar si Flutter está en el PATH
$flutterInPath = $false
$flutterPath = $null

try {
    $flutterVersion = flutter --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $flutterInPath = $true
        Write-Host "✓ Flutter está instalado y en el PATH" -ForegroundColor Green
        Write-Host "Versión:" -ForegroundColor Yellow
        $flutterVersion | Select-Object -First 3
        $flutterPath = (Get-Command flutter).Source
        Write-Host "Ubicación: $flutterPath" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ Flutter NO está en el PATH" -ForegroundColor Red
}

# Buscar Flutter en ubicaciones comunes
if (-not $flutterInPath) {
    Write-Host ""
    Write-Host "Buscando Flutter en ubicaciones comunes..." -ForegroundColor Yellow
    
    $commonPaths = @(
        "$env:USERPROFILE\flutter",
        "$env:USERPROFILE\Documents\flutter",
        "C:\src\flutter",
        "C:\flutter",
        "D:\flutter",
        "$env:LOCALAPPDATA\flutter"
    )
    
    $found = $false
    foreach ($path in $commonPaths) {
        $flutterBin = Join-Path $path "bin\flutter.bat"
        if (Test-Path $flutterBin) {
            Write-Host "✓ Flutter encontrado en: $path" -ForegroundColor Green
            Write-Host ""
            Write-Host "Para agregarlo al PATH, ejecuta:" -ForegroundColor Yellow
            Write-Host "[System.Environment]::SetEnvironmentVariable('Path', [System.Environment]::GetEnvironmentVariable('Path', 'User') + ';$path\bin', 'User')" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "O manualmente:" -ForegroundColor Yellow
            Write-Host "1. Busca 'Variables de entorno' en el menú de inicio" -ForegroundColor White
            Write-Host "2. Edita la variable 'Path' del usuario" -ForegroundColor White
            Write-Host "3. Agrega: $path\bin" -ForegroundColor White
            Write-Host "4. Reinicia PowerShell" -ForegroundColor White
            $found = $true
            break
        }
    }
    
    if (-not $found) {
        Write-Host "✗ Flutter no se encontró en ubicaciones comunes" -ForegroundColor Red
        Write-Host ""
        Write-Host "Necesitas instalar Flutter:" -ForegroundColor Yellow
        Write-Host "1. Descarga desde: https://flutter.dev/docs/get-started/install/windows" -ForegroundColor White
        Write-Host "2. Extrae en una carpeta (ej: C:\src\flutter)" -ForegroundColor White
        Write-Host "3. Agrega la carpeta \bin al PATH" -ForegroundColor White
        Write-Host ""
        Write-Host "Ver archivo INSTALACION_FLUTTER.md para más detalles" -ForegroundColor Cyan
    }
}

# Verificar requisitos
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verificación de Requisitos" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Git
try {
    $gitVersion = git --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Git está instalado" -ForegroundColor Green
    }
} catch {
    Write-Host "✗ Git NO está instalado" -ForegroundColor Red
    Write-Host "  Descarga desde: https://git-scm.com/download/win" -ForegroundColor Yellow
}

# Visual Studio (verificación básica)
$vsPaths = @(
    "${env:ProgramFiles}\Microsoft Visual Studio",
    "${env:ProgramFiles(x86)}\Microsoft Visual Studio"
)

$vsFound = $false
foreach ($vsPath in $vsPaths) {
    if (Test-Path $vsPath) {
        Write-Host "✓ Visual Studio encontrado" -ForegroundColor Green
        $vsFound = $true
        break
    }
}

if (-not $vsFound) {
    Write-Host "⚠ Visual Studio no encontrado (necesario para compilar)" -ForegroundColor Yellow
    Write-Host "  Descarga Visual Studio Community desde: https://visualstudio.microsoft.com/downloads/" -ForegroundColor Yellow
    Write-Host "  Selecciona: 'Desarrollo para el escritorio de C++'" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Para más información, consulta:" -ForegroundColor Cyan
Write-Host "  - INSTALACION_FLUTTER.md" -ForegroundColor Yellow
Write-Host "  - https://flutter.dev/docs/get-started/install/windows" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

