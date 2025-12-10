import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/storage_service.dart';
import 'lock_screen.dart';

/// Pantalla de configuración inicial para administradores
/// Permite configurar o editar la placa del equipo
class ConfigScreen extends StatefulWidget {
  final bool isEditMode;
  
  const ConfigScreen({super.key, this.isEditMode = false});

  @override
  State<ConfigScreen> createState() => _ConfigScreenState();
}

class _ConfigScreenState extends State<ConfigScreen> {
  final _formKey = GlobalKey<FormState>();
  final _cedulaController = TextEditingController();
  final _contrasenaController = TextEditingController();
  final _placaController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;
  bool _mostrarContrasena = false;

  @override
  void initState() {
    super.initState();
    if (widget.isEditMode) {
      _loadCurrentPlaca();
    }
  }

  /// Carga la placa actual si está en modo edición
  Future<void> _loadCurrentPlaca() async {
    final placaActual = await StorageService.getDevicePlaca();
    if (placaActual != null && mounted) {
      _placaController.text = placaActual;
    }
  }

  @override
  void dispose() {
    _cedulaController.dispose();
    _contrasenaController.dispose();
    _placaController.dispose();
    super.dispose();
  }

  /// Verifica si el usuario es administrador y guarda la placa
  Future<void> _handleConfig() async {
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
            _errorMessage = 'Solo los administradores pueden configurar la placa del equipo';
            _isLoading = false;
          });
          return;
        }

        // Guardar la placa configurada
        await StorageService.saveDevicePlaca(_placaController.text.trim());
        await StorageService.setPlacaConfigurada(true);

        // Navegar a la pantalla de login
        if (mounted) {
          if (widget.isEditMode) {
            Navigator.of(context).pop();
            // Mostrar mensaje de éxito
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Placa actualizada correctamente'),
                backgroundColor: Color(0xFF01AF00),
              ),
            );
          } else {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const LockScreen()),
            );
          }
        }
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
                    // Logo SENA
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Image.asset(
                        'assets/images/logoSena.png',
                        width: 120,
                        height: 120,
                        errorBuilder: (context, error, stackTrace) {
                          return Icon(
                            Icons.admin_panel_settings,
                            size: 64,
                            color: const Color(0xFF01AF00),
                          );
                        },
                      ),
                    ),
                    
                    // Título
                    Text(
                      widget.isEditMode ? 'Editar Placa del Equipo' : 'Configuración Inicial',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF01AF00),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'SGI SENA Desktop',
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
                        color: const Color(0xFF01AF00).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: const Color(0xFF01AF00).withOpacity(0.3),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.info_outline,
                            size: 20,
                            color: const Color(0xFF01AF00),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Solo administradores pueden configurar la placa del equipo. Esta configuración se guardará en este equipo.',
                              style: TextStyle(
                                fontSize: 13,
                                color: const Color(0xFF01AF00),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

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
                        textInputAction: TextInputAction.next,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'La contraseña es obligatoria';
                          }
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Campo de placa
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: const Color(0xFFDAD6D3)),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: TextFormField(
                        controller: _placaController,
                        decoration: InputDecoration(
                          hintText: 'Placa del Equipo',
                          prefixIcon: const Icon(Icons.computer),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 14,
                          ),
                        ),
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _handleConfig(),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'La placa del equipo es obligatoria';
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

                    // Botón de configuración
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _handleConfig,
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
                            : Text(
                                widget.isEditMode ? 'Actualizar' : 'Configurar',
                                style: const TextStyle(
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

