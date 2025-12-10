# Configurar Visual Studio para Flutter Windows

## Problema
Visual Studio Build Tools está instalado pero incompleto. Necesitas completar la instalación con las herramientas necesarias.

## Pasos para Completar la Instalación

1. **Visual Studio Installer debería haberse abierto automáticamente**
   - Si no se abrió, búscalo en el menú de inicio: "Visual Studio Installer"

2. **En Visual Studio Installer:**
   - Busca "Visual Studio Build Tools 2019" en la lista
   - Haz clic en el botón **"Modificar"** (no "Desinstalar")

3. **Selecciona las siguientes cargas de trabajo:**
   - ✅ **"Desarrollo para el escritorio de C++"** (Desktop development with C++)
     - Esto incluye automáticamente:
       - MSVC v142 - VS 2019 C++ x64/x86 build tools
       - Windows 10 SDK (10.0.19041.0 o superior)
       - CMake tools para Windows
       - C++ core features

4. **En la pestaña "Componentes individuales", verifica que estén seleccionados:**
   - ✅ Windows 10 SDK (10.0.19041.0 o superior)
   - ✅ MSVC v142 - VS 2019 C++ x64/x86 build tools (v14.29)
   - ✅ C++ CMake tools para Windows

5. **Haz clic en "Modificar"** y espera a que se complete la instalación
   - Esto puede tardar varios minutos dependiendo de tu conexión

6. **Después de completar la instalación:**
   - Cierra Visual Studio Installer
   - Reinicia PowerShell o CMD
   - Ejecuta: `flutter doctor` para verificar
   - Luego ejecuta: `flutter run -d windows`

## Alternativa: Instalar Visual Studio Community (Recomendado)

Si prefieres una instalación más completa, puedes instalar Visual Studio Community:

1. Descarga desde: https://visualstudio.microsoft.com/downloads/
2. Durante la instalación, selecciona:
   - ✅ **"Desarrollo para el escritorio de C++"**
   - ✅ **"Desarrollo para escritorio de .NET"** (opcional)
3. Completa la instalación
4. Ejecuta `flutter doctor` para verificar

## Verificar la Instalación

Después de completar la instalación, ejecuta:

```powershell
$env:Path += ";C:\flutter\bin"
flutter doctor
```

Deberías ver:
```
[√] Visual Studio - develop Windows apps
```

En lugar de:
```
[!] Visual Studio - develop Windows apps
    X The current Visual Studio installation is incomplete.
```

## Nota Importante

- La instalación puede tardar 10-30 minutos dependiendo de tu conexión
- Asegúrate de tener suficiente espacio en disco (al menos 3-5 GB)
- No cierres Visual Studio Installer durante la instalación

