# Instalador y Desinstalador SGE-SENA Desktop

## Requisitos

### Para crear el instalador:
- **Inno Setup Compiler** (gratuito): https://jrsoftware.org/isinfo.php
- Build compilado de Flutter: `flutter build windows --release`

### Para crear el desinstalador:
- Flutter SDK
- Compilar el desinstalador: `cd uninstaller && flutter build windows --release`

## Crear el Instalador

1. **Compilar la aplicación Flutter:**
   ```bash
   cd desktop_app
   flutter build windows --release
   ```

2. **Abrir Inno Setup Compiler**

3. **Abrir el script `setup.iss`**

4. **Ajustar la ruta en el script:**
   - Busca la línea: `Source: "..\build\windows\x64\runner\Release\*"`
   - Ajusta la ruta según donde se genere tu build

5. **Compilar el instalador:**
   - En Inno Setup: Build > Compile
   - El instalador se generará en `installer/output/`

## Crear el Desinstalador

1. **Compilar el desinstalador:**
   ```bash
   cd desktop_app/uninstaller
   flutter pub get
   flutter build windows --release
   ```

2. **Copiar el ejecutable del desinstalador:**
   - Copia `build/windows/x64/runner/Release/uninstaller.exe`
   - Colócalo en la carpeta de instalación de la aplicación

## Estructura del Instalador

El instalador:
- Instala la aplicación en `C:\Program Files\SGE-SENA Desktop`
- Crea accesos directos en el escritorio y menú inicio
- Crea entradas en el registro de Windows
- Genera un desinstalador estándar de Windows

## Estructura del Desinstalador

El desinstalador personalizado:
- Requiere autenticación de administrador del sistema web
- Verifica credenciales antes de permitir la desinstalación
- Elimina la aplicación y todos sus datos
- Limpia entradas del registro y accesos directos

## Notas Importantes

- El instalador requiere privilegios de administrador
- El desinstalador personalizado debe estar en la misma carpeta que la aplicación
- El desinstalador verifica las credenciales contra el servidor web
- Solo administradores registrados pueden desinstalar

