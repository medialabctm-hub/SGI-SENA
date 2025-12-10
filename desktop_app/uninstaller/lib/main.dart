import 'package:flutter/material.dart';
import 'screens/uninstall_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  runApp(const UninstallerApp());
}

class UninstallerApp extends StatelessWidget {
  const UninstallerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Desinstalador SGE-SENA Desktop',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const UninstallScreen(),
    );
  }
}

