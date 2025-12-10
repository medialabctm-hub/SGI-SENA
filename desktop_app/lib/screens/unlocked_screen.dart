import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/storage_service.dart';

/// Pantalla principal cuando el sistema está desbloqueado
class UnlockedScreen extends StatefulWidget {
  const UnlockedScreen({super.key});

  @override
  State<UnlockedScreen> createState() => _UnlockedScreenState();
}

class _UnlockedScreenState extends State<UnlockedScreen> {
  Map<String, String?>? _userInfo;
  String? _devicePlaca;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadUserInfo();
  }

  /// Carga la información del usuario y del dispositivo
  Future<void> _loadUserInfo() async {
    try {
      final userInfo = await StorageService.getUserInfo();
      final placaGuardada = await StorageService.getDevicePlaca();
      
      setState(() {
        _userInfo = userInfo;
        _devicePlaca = placaGuardada;
        _isLoading = false;
      });

      // Esperar 2 segundos mostrando el mensaje de éxito y luego cerrar la aplicación
      await Future.delayed(const Duration(seconds: 2));
      
      if (mounted) {
        // Cerrar la aplicación completamente
        await SystemNavigator.pop();
        exit(0);
      }
    } catch (e) {
      setState(() {
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
          child: Container(
            width: 560,
            constraints: const BoxConstraints(maxWidth: 560),
            padding: const EdgeInsets.all(36.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Icono de éxito
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: const Color(0xFF01AF00).withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_circle,
                    size: 50,
                    color: Color(0xFF01AF00),
                  ),
                ),
                const SizedBox(height: 24),
                
                // Título
                Text(
                  'Sistema Desbloqueado',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF01AF00),
                  ),
                ),
                const SizedBox(height: 12),
                
                // Mensaje
                Text(
                  'El equipo ha sido verificado y autorizado.\nLa aplicación se cerrará automáticamente.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: const Color(0xFF777777),
                  ),
                ),
                const SizedBox(height: 32),
                
                // Información del usuario
                if (_userInfo != null && !_isLoading)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Column(
                      children: [
                        _buildInfoRow('Usuario', _userInfo!['name'] ?? 'N/A'),
                        _buildInfoRow('Cédula', _userInfo!['cedula'] ?? 'N/A'),
                        if (_devicePlaca != null)
                          _buildInfoRow('Placa', _devicePlaca!),
                      ],
                    ),
                  ),
                
                if (_isLoading)
                  const Padding(
                    padding: EdgeInsets.only(top: 24),
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF01AF00)),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              '$label:',
              style: TextStyle(
                fontWeight: FontWeight.w500,
                color: Colors.grey.shade600,
                fontSize: 14,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

