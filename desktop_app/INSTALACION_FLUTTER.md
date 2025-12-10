# Guía de Instalación de Flutter para Windows

## Paso 1: Descargar Flutter

1. Ve a la página oficial de Flutter: https://flutter.dev/docs/get-started/install/windows
2. Descarga el SDK de Flutter para Windows
3. Extrae el archivo ZIP en una ubicación permanente (ej: `C:\src\flutter`)
   - **IMPORTANTE**: No extraigas Flutter en una carpeta que requiera privilegios de administrador
   - **NO** lo extraigas en `C:\Program Files\`

## Paso 2: Agregar Flutter al PATH

1. Busca "Variables de entorno" en el menú de inicio de Windows
2. Haz clic en "Editar las variables de entorno del sistema"
3. Haz clic en "Variables de entorno..."
4. En "Variables del sistema", busca la variable `Path` y haz clic en "Editar"
5. Haz clic en "Nuevo" y agrega la ruta completa a Flutter (ej: `C:\src\flutter\bin`)
6. Haz clic en "Aceptar" en todas las ventanas

## Paso 3: Verificar la Instalación

Abre una **nueva** ventana de PowerShell o CMD y ejecuta:

```powershell
flutter doctor
```

Este comando verificará tu instalación y te dirá qué falta configurar.

## Paso 4: Requisitos Adicionales para Windows

Flutter requiere:

1. **Git para Windows**: https://git-scm.com/download/win
2. **Visual Studio** (para compilar aplicaciones Windows):
   - Descarga Visual Studio Community: https://visualstudio.microsoft.com/downloads/
   - Durante la instalación, selecciona:
     - "Desarrollo para el escritorio de C++"
     - "SDK de Windows 10/11"

## Paso 5: Habilitar Desarrollo de Escritorio

Ejecuta:

```powershell
flutter config --enable-windows-desktop
```

## Paso 6: Verificar que Todo Está Listo

```powershell
flutter doctor -v
```

Deberías ver que Windows desktop está habilitado.

## Instalación Rápida (Alternativa con Chocolatey)

Si tienes Chocolatey instalado, puedes instalar Flutter más rápido:

```powershell
choco install flutter
```

Luego reinicia PowerShell y ejecuta:

```powershell
flutter doctor
```

## Solución de Problemas Comunes

### "flutter no se reconoce como comando"
- Asegúrate de haber agregado Flutter al PATH
- Cierra y vuelve a abrir PowerShell/CMD
- Verifica la ruta: `echo $env:PATH` (PowerShell) o `echo %PATH%` (CMD)

### "No se puede encontrar Git"
- Instala Git desde: https://git-scm.com/download/win
- Asegúrate de agregar Git al PATH durante la instalación

### "Visual Studio no encontrado"
- Instala Visual Studio Community con las herramientas de C++
- Ejecuta `flutter doctor` nuevamente después de la instalación

## Después de Instalar Flutter

Una vez que Flutter esté instalado correctamente, puedes continuar con la aplicación:

```powershell
cd desktop_app
flutter pub get
flutter run -d windows
```

