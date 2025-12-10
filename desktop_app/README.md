# SGE-SENA Desktop App

Aplicación de escritorio Flutter para gestión de equipos del sistema SGE-SENA.

## Características

- **Bloqueo de pantalla**: La aplicación bloquea la pantalla hasta que se autentique un usuario
- **Verificación de placa**: Valida que la placa del equipo coincida con la asignada en el sistema web
- **Autenticación segura**: Login con validación de placa del equipo
- **Sesión persistente**: Mantiene la sesión activa hasta que se cierre manualmente

## Requisitos

- Flutter SDK >= 3.0.0
- Dart SDK >= 3.0.0
- Windows, Linux o macOS

## Instalación

1. Asegúrate de tener Flutter instalado y configurado
2. Navega al directorio de la aplicación:
   ```bash
   cd desktop_app
   ```

3. Instala las dependencias:
   ```bash
   flutter pub get
   ```

## Configuración

### URL de la API

Por defecto, la aplicación está configurada para usar la API en producción:
- `https://sgi-sena.up.railway.app`

Para cambiar a desarrollo local, edita `lib/config/app_config.dart`:
```dart
static const String apiBaseUrl = 'http://localhost:3000';
```

## Ejecución

### Windows
```bash
flutter run -d windows
```

### Linux
```bash
flutter run -d linux
```

### macOS
```bash
flutter run -d macos
```

## Compilación

### Windows
```bash
flutter build windows
```

### Linux
```bash
flutter build linux
```

### macOS
```bash
flutter build macos
```

## Funcionamiento

### Configuración Inicial (Solo Administradores)

1. **Primera vez**: Al iniciar la aplicación por primera vez, se muestra la pantalla de configuración
2. **Configuración de placa**: Un administrador debe:
   - Ingresar su cédula y contraseña de administrador
   - Ingresar la placa del equipo manualmente
   - Hacer clic en "Configurar"
3. **Guardado local**: La placa se guarda localmente en el equipo y se usa para todas las sesiones futuras
4. **Una sola vez**: Esta configuración solo se hace una vez por equipo

### Login Normal

1. **Al iniciar**: La aplicación verifica si la placa está configurada
   - Si NO está configurada: Muestra la pantalla de configuración
   - Si está configurada: Muestra la pantalla de login
2. **Login**: El usuario ingresa su cédula y contraseña
3. **Validación**: El servidor verifica que:
   - Las credenciales sean correctas
   - La placa del equipo (guardada) esté asignada al usuario en el sistema web
4. **Desbloqueo**: Si todo es correcto, el sistema se desbloquea y muestra la pantalla principal
5. **Bloqueo**: Si la placa no coincide o las credenciales son incorrectas, se muestra un error y el sistema permanece bloqueado

### Características Importantes

- **Placa configurada por administrador**: Solo un administrador puede configurar la placa del equipo
- **Almacenamiento local**: La placa se guarda en el equipo y persiste entre sesiones
- **Verificación con servidor**: Cada login verifica que la placa guardada coincida con las asignaciones en el sistema web
- **Diseño similar a la web**: La interfaz replica el diseño de la aplicación web SGI-SENA

## Notas Importantes

- Esta es una aplicación **temporal para pruebas**
- La aplicación verifica la placa del equipo en cada login
- Si la placa no está asignada al usuario en el sistema web, no se permitirá el acceso
- La sesión se mantiene activa hasta que se cierre manualmente

## Estructura del Proyecto

```
lib/
├── main.dart                 # Punto de entrada de la aplicación
├── config/
│   └── app_config.dart       # Configuración de la aplicación
├── screens/
│   ├── lock_screen.dart      # Pantalla de bloqueo/login
│   └── unlocked_screen.dart  # Pantalla principal desbloqueada
└── services/
    ├── auth_service.dart      # Servicio de autenticación con API
    ├── device_service.dart    # Servicio para obtener info del dispositivo
    └── storage_service.dart   # Servicio para almacenamiento local
```

## Dependencias Principales

- `window_manager`: Control de ventana (fullscreen, always on top)
- `device_info_plus`: Obtención de información del hardware
- `http`: Cliente HTTP para comunicación con la API
- `shared_preferences`: Almacenamiento local de datos

## Solución de Problemas

### La placa no se detecta correctamente
- En Windows, la aplicación usa `deviceId` o `computerName` como placa
- En Linux, usa `machineId` o `hostname`
- En macOS, usa `serialNumber` o `hostName`
- Si falla, se usa `hostname` como último recurso

### Error de conexión con la API
- Verifica que la URL de la API sea correcta
- Asegúrate de que el servidor esté en ejecución
- Revisa la configuración de red/firewall

## Licencia

Este proyecto es parte del sistema SGE-SENA.

