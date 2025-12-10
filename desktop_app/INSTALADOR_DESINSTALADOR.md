# Guía de Instalador y Desinstalador

## Funcionalidades Implementadas

### 1. Edición de Placa (Solo Administradores)
- Los administradores pueden editar la placa del equipo desde la pantalla de login
- Botón "Editar placa del equipo" visible en la pantalla de login
- Requiere autenticación de administrador para editar

### 2. Instalador
- Script de Inno Setup para crear instalador de Windows
- Instala la aplicación en `C:\Program Files\SGE-SENA Desktop`
- Crea accesos directos y entradas en el registro
- Requiere privilegios de administrador

### 3. Desinstalador con Autenticación
- Aplicación Flutter separada que requiere autenticación
- Solo administradores registrados en el sistema web pueden desinstalar
- Verifica credenciales antes de permitir la desinstalación

## Pasos para Crear el Instalador

### Paso 1: Compilar la Aplicación
```bash
cd desktop_app
flutter build windows --release
```

### Paso 2: Instalar Inno Setup
1. Descarga Inno Setup desde: https://jrsoftware.org/isinfo.php
2. Instala Inno Setup Compiler

### Paso 3: Compilar el Instalador
1. Abre Inno Setup Compiler
2. Abre el archivo `installer/setup.iss`
3. Ajusta la ruta en la línea:
   ```
   Source: "..\build\windows\x64\runner\Release\*"
   ```
   Asegúrate de que apunte a donde se generó tu build
4. Compila: Build > Compile
5. El instalador se generará en `installer/output/SGE-SENA-Desktop-Setup.exe`

## Pasos para Crear el Desinstalador

### Paso 1: Compilar el Desinstalador
```bash
cd desktop_app/uninstaller
flutter pub get
flutter build windows --release
```

### Paso 2: Incluir en el Instalador
1. Copia `uninstaller/build/windows/x64/runner/Release/uninstaller.exe`
2. Colócalo en la carpeta de la aplicación principal
3. Modifica `setup.iss` para incluir el desinstalador:
   ```
   Source: "uninstaller\build\windows\x64\runner\Release\uninstaller.exe"; DestDir: "{app}"; Flags: ignoreversion
   ```

## Uso del Desinstalador

1. Ejecuta `uninstaller.exe` desde la carpeta de instalación
2. Ingresa las credenciales de un administrador registrado en el sistema web
3. Confirma la desinstalación
4. La aplicación se desinstalará completamente

## Estructura de Archivos

```
desktop_app/
├── installer/
│   ├── setup.iss          # Script de Inno Setup
│   └── README.md          # Documentación del instalador
├── uninstaller/
│   ├── lib/
│   │   ├── main.dart
│   │   ├── screens/
│   │   │   └── uninstall_screen.dart
│   │   └── services/
│   │       └── auth_service.dart
│   └── pubspec.yaml
└── ...
```

## Notas Importantes

- El instalador requiere privilegios de administrador
- El desinstalador verifica credenciales contra el servidor web
- Solo administradores pueden editar la placa o desinstalar
- La placa se guarda localmente y persiste entre sesiones

