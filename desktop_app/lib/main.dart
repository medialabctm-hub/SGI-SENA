import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';
import 'screens/lock_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Configurar la ventana para que ocupe toda la pantalla y se mantenga siempre al frente
  await windowManager.ensureInitialized();
  
  WindowOptions windowOptions = const WindowOptions(
    size: Size(800, 600),
    center: true,
    backgroundColor: Colors.transparent,
    skipTaskbar: false,
    titleBarStyle: TitleBarStyle.hidden,
    alwaysOnTop: true,
    fullScreen: true,
  );
  
  windowManager.waitUntilReadyToShow(windowOptions, () async {
    await windowManager.show();
    await windowManager.focus();
    await windowManager.setFullScreen(true);
    await windowManager.setAlwaysOnTop(true);
  });

  // Verificar si la placa está configurada para decidir qué pantalla mostrar
  runApp(const SgeSenaDesktopApp());
}

class SgeSenaDesktopApp extends StatelessWidget {
  const SgeSenaDesktopApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SGE-SENA Desktop',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const LockScreen(),
    );
  }
}

