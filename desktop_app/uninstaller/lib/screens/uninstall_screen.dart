import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/auth_service.dart';

/// Pantalla de desinstalación que requiere autenticación de administrador
class UninstallScreen extends StatefulWidget {
  const UninstallScreen({super.key});

  @override
  State<UninstallScreen> createState() => _UninstallScreenState();
}

class _UninstallScreenState extends State<UninstallScreen> {
  final _formKey = GlobalKey<FormState>();
  final _cedulaController = TextEditingController();
  final _contrasenaController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;
  bool _mostrarContrasena = false;
  bool _isUninstalling = false;

  @override
  void dispose() {
    _cedulaController.dispose();
    _contrasenaController.dispose();
    super.dispose();
  }

  /// Verifica si el usuario es administrador y procede con la desinstalación
  Future<void> _handleUninstall() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Verificar que el usuario es administrador
      final loginResult = await AuthService.loginNormal(
        cedula: _cedulaController.text.trim(),
        contrasena: _contrasenaController.text,
      );

      if (loginResult['success'] == true) {
        final isAdmin = loginResult['isAdmin'] == true;
        
        if (!isAdmin) {
          setState(() {
            _errorMessage = 'Solo los administradores pueden desinstalar la aplicación';
            _isLoading = false;
          });
          return;
        }

        // Confirmar desinstalación
        final confirm = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Confirmar Desinstalación'),
            content: const Text(
              '¿Está seguro que desea desinstalar SGE-SENA Desktop?\n\n'
              'Esta acción eliminará la aplicación y todos sus datos.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancelar'),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(true),
                style: TextButton.styleFrom(
                  foregroundColor: Colors.red,
                ),
                child: const Text('Desinstalar'),
              ),
            ],
          ),
        );

        if (confirm != true) {
          setState(() {
            _isLoading = false;
          });
          return;
        }

        // Proceder con la desinstalación
        setState(() {
          _isUninstalling = true;
          _isLoading = false;
        });

        await _performUninstall();
      } else {
        setState(() {
          _errorMessage = loginResult['error'] ?? 'Error al verificar credenciales';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Error de conexión: ${e.toString()}';
        _isLoading = false;
      });
    }
  }

  /// Realiza la desinstalación de la aplicación
  Future<void> _performUninstall() async {
    try {
      // Obtener la ruta de instalación desde el registro de Windows
      // Por defecto: C:\Program Files\SGE-SENA Desktop
      final installPath = r'C:\Program Files\SGE-SENA Desktop';
      final uninstallerPath = '$installPath\\unins000.exe';

      // Verificar si existe el desinstalador de Inno Setup
      if (await File(uninstallerPath).exists()) {
        // Ejecutar el desinstalador silencioso
        await Process.start(
          uninstallerPath,
          ['/SILENT', '/FORCECLOSEAPPLICATIONS'],
          mode: ProcessStartMode.detached,
        ).then((process) => process.exitCode);
      } else {
        // Si no existe, intentar eliminar manualmente
        final appDir = Directory(installPath);
        if (await appDir.exists()) {
          await appDir.delete(recursive: true);
        }

        // Eliminar datos de usuario
        final localAppData = Platform.environment['LOCALAPPDATA'];
        if (localAppData != null) {
          final userDataPath = '$localAppData\\sge_sena_desktop';
          final userDataDir = Directory(userDataPath);
          if (await userDataDir.exists()) {
            await userDataDir.delete(recursive: true);
          }
        }

        // Eliminar accesos directos y entradas del registro (simplificado)
        // En producción, usar un script más completo
      }

      // Mostrar mensaje de éxito y cerrar
      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => AlertDialog(
            title: const Text('Desinstalación Completada'),
            content: const Text('La aplicación ha sido desinstalada correctamente.'),
            actions: [
              TextButton(
                onPressed: () {
                  exit(0);
                },
                child: const Text('Cerrar'),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Error durante la desinstalación: ${e.toString()}';
        _isUninstalling = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Container(
              width: 560,
              constraints: const BoxConstraints(maxWidth: 560),
              padding: const EdgeInsets.all(36.0),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.06),
                    blurRadius: 18,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Icono
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Icon(
                        Icons.delete_forever,
                        size: 64,
                        color: Colors.red.shade700,
                      ),
                    ),
                    
                    // Título
                    Text(
                      'Desinstalar SGE-SENA Desktop',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: Colors.red.shade700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Se requiere autenticación de administrador',
                      style: TextStyle(
                        fontSize: 16,
                        color: const Color(0xFF777777),
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Mensaje informativo
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: Colors.red.shade200,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.warning_amber_rounded,
                            size: 20,
                            color: Colors.red.shade700,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Solo los administradores registrados en el sistema web pueden desinstalar la aplicación.',
                              style: TextStyle(
                                fontSize: 13,
                                color: Colors.red.shade700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    if (!_isUninstalling) ...[
                      // Campo de cédula
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFFDAD6D3)),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: TextFormField(
                          controller: _cedulaController,
                          decoration: InputDecoration(
                            hintText: 'Cédula de Administrador',
                            prefixIcon: const Icon(Icons.person_outline),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 14,
                            ),
                          ),
                          keyboardType: TextInputType.number,
                          textInputAction: TextInputAction.next,
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'La cédula es obligatoria';
                            }
                            return null;
                          },
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Campo de contraseña
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: const Color(0xFFDAD6D3)),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: TextFormField(
                          controller: _contrasenaController,
                          decoration: InputDecoration(
                            hintText: 'Contraseña',
                            prefixIcon: const Icon(Icons.lock_outline),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _mostrarContrasena
                                    ? Icons.visibility_off
                                    : Icons.visibility,
                              ),
                              onPressed: () {
                                setState(() {
                                  _mostrarContrasena = !_mostrarContrasena;
                                });
                              },
                            ),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 14,
                            ),
                          ),
                          obscureText: !_mostrarContrasena,
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _handleUninstall(),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'La contraseña es obligatoria';
                            }
                            return null;
                          },
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Mensaje de error
                      if (_errorMessage != null)
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDC3545).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: const Color(0xFFDC3545).withOpacity(0.3),
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.error_outline,
                                color: Color(0xFFDC3545),
                                size: 20,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _errorMessage!,
                                  style: const TextStyle(
                                    color: Color(0xFFDC3545),
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      if (_errorMessage != null) const SizedBox(height: 16),

                      // Botón de desinstalación
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _isLoading ? null : _handleUninstall,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red.shade700,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            elevation: 0,
                          ),
                          child: _isLoading
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      Colors.white,
                                    ),
                                  ),
                                )
                              : const Text(
                                  'Desinstalar',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                        ),
                      ),
                    ] else ...[
                      // Mensaje de desinstalación en progreso
                      const CircularProgressIndicator(),
                      const SizedBox(height: 24),
                      const Text(
                        'Desinstalando la aplicación...',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

