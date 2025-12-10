import 'dart:convert';
import 'package:http/http.dart' as http;
import 'storage_service.dart';

import '../config/app_config.dart';

/// Servicio de autenticación con la API
class AuthService {
  static String get baseUrl => AppConfig.apiBaseUrl;

  /// Login con validación de placa (para app de escritorio)
  /// 
  /// [cedula]: Cédula del usuario
  /// [contrasena]: Contraseña del usuario
  /// [placa]: Placa del equipo donde se está intentando iniciar sesión
  /// 
  /// Retorna un Map con el resultado del login o lanza una excepción
  static Future<Map<String, dynamic>> loginWithPlaca({
    required String cedula,
    required String contrasena,
    required String placa,
  }) async {
    try {
      final url = Uri.parse('$baseUrl/api/auth/login-placa');
      
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'cedula': cedula,
          'contrasena': contrasena,
          'placa': placa,
        }),
      );

      final responseData = jsonDecode(response.body);

      if (response.statusCode == 200) {
        // Login exitoso
        final token = responseData['token'] as String;
        final user = responseData['user'] as Map<String, dynamic>;
        
        // Guardar token y datos del usuario
        await StorageService.saveToken(token);
        await StorageService.saveUserInfo(
          userId: user['id_usuario']?.toString() ?? user['id']?.toString() ?? '',
          cedula: user['cedula']?.toString() ?? cedula,
          name: user['nombre_usuario']?.toString() ?? user['nombre']?.toString() ?? '',
        );
        await StorageService.setUnlocked(true);
        
        return {
          'success': true,
          'token': token,
          'user': user,
        };
      } else {
        // Error en el login
        final errorMessage = responseData['error'] ?? 
                           responseData['message'] ?? 
                           'Error al iniciar sesión';
        
        return {
          'success': false,
          'error': errorMessage,
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error': 'Error de conexión: ${e.toString()}',
      };
    }
  }

  /// Verifica si hay una sesión activa
  static Future<bool> hasActiveSession() async {
    final token = await StorageService.getToken();
    final isUnlocked = await StorageService.isUnlocked();
    return token != null && token.isNotEmpty && isUnlocked;
  }

  /// Login normal (sin placa) - Para verificar si el usuario es administrador
  /// 
  /// [cedula]: Cédula del usuario
  /// [contrasena]: Contraseña del usuario
  /// 
  /// Retorna un Map con el resultado del login y el rol del usuario
  static Future<Map<String, dynamic>> loginNormal({
    required String cedula,
    required String contrasena,
  }) async {
    try {
      final url = Uri.parse('$baseUrl/api/auth/login');
      
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'cedula': cedula,
          'contrasena': contrasena,
        }),
      );

      final responseData = jsonDecode(response.body);

      if (response.statusCode == 200) {
        final user = responseData['user'] as Map<String, dynamic>;
        final rol = user['nombre_rol']?.toString() ?? user['rol']?.toString() ?? '';
        final isAdmin = rol.toLowerCase() == 'administrador';
        
        return {
          'success': true,
          'user': user,
          'rol': rol,
          'isAdmin': isAdmin,
        };
      } else {
        final errorMessage = responseData['error'] ?? 
                           responseData['message'] ?? 
                           'Error al iniciar sesión';
        
        return {
          'success': false,
          'error': errorMessage,
        };
      }
    } catch (e) {
      return {
        'success': false,
        'error': 'Error de conexión: ${e.toString()}',
      };
    }
  }

  /// Cierra la sesión
  static Future<void> logout() async {
    await StorageService.clearSession();
  }
}

