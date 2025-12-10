import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/storage_service.dart';
import 'unlocked_screen.dart';
import 'config_screen.dart';

/// Pantalla de bloqueo que requiere autenticación
class LockScreen extends StatefulWidget {
  const LockScreen({super.key});

  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  final _formKey = GlobalKey<FormState>();
  final _cedulaController = TextEditingController();
  final _contrasenaController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;
  bool _isCheckingSession = true;
  bool _mostrarContrasena = false;

  @override
  void initState() {
    super.initState();
    _initializeScreen();
  }

  /// Inicializa la pantalla: verifica sesión y si la placa está configurada
  Future<void> _initializeScreen() async {
    try {
      // Verificar si la placa está configurada
      final placaConfigurada = await StorageService.isPlacaConfigurada();
      
      if (!placaConfigurada) {
        // Si no está configurada, ir a pantalla de configuración
        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const ConfigScreen()),
          );
        }
        return;
      }

      // Verificar si hay una sesión activa
      final hasSession = await AuthService.hasActiveSession();
      if (hasSession) {
        // Si hay sesión activa, ir directamente a la pantalla desbloqueada
        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const UnlockedScreen()),
          );
        }
      } else {
        setState(() {
          _isCheckingSession = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Error al inicializar: $e';
        _isCheckingSession = false;
      });
    }
  }

  /// Maneja el proceso de login
  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    // Obtener la placa guardada
    final placaGuardada = await StorageService.getDevicePlaca();
    if (placaGuardada == null || placaGuardada.isEmpty) {
      setState(() {
        _errorMessage = 'La placa del equipo no está configurada. Contacte al administrador.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final result = await AuthService.loginWithPlaca(
        cedula: _cedulaController.text.trim(),
        contrasena: _contrasenaController.text,
        placa: placaGuardada,
      );

      if (result['success'] == true) {
        // Login exitoso - navegar a pantalla desbloqueada
        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const UnlockedScreen()),
          );
        }
      } else {
        // Error en el login
        setState(() {
          _errorMessage = result['error'] ?? 'Error al iniciar sesión';
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

  @override
  void dispose() {
    _cedulaController.dispose();
    _contrasenaController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isCheckingSession) {
      return const Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF01AF00)),
          ),
        ),
      );
    }

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
                    // Logo SENA
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Image.asset(
                        'assets/images/logoSena.png',
                        width: 120,
                        height: 120,
                        errorBuilder: (context, error, stackTrace) {
                          return Icon(
                            Icons.lock_outline,
                            size: 64,
                            color: const Color(0xFF01AF00),
                          );
                        },
                      ),
                    ),
                    
                    // Título
                    Text(
                      'Gestión de Inventario',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF01AF00),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'SGI SENA',
                      style: TextStyle(
                        fontSize: 16,
                        color: const Color(0xFF777777),
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Campo de cédula
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFFDAD6D3)),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: TextFormField(
                        controller: _cedulaController,
                        decoration: InputDecoration(
                          hintText: 'Cédula',
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
                        onFieldSubmitted: (_) => _handleLogin(),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'La contraseña es obligatoria';
                          }
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Botón para editar placa (solo visible si hay placa configurada)
                    TextButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const ConfigScreen(isEditMode: true),
                          ),
                        );
                      },
                      child: const Text(
                        'Editar placa del equipo (Solo administradores)',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF01AF00),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),

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

                    // Botón de login
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _handleLogin,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF01AF00),
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
                                'Iniciar Sesión',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                      ),
                    ),
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
