import 'dart:convert';
import 'package:http/http.dart' as http;

/// Servicio de autenticación con la API para el desinstalador
class AuthService {
  static const String baseUrl = 'https://sgi-sena.up.railway.app';

  /// Login normal (sin placa) - Para verificar si el usuario es administrador
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
}

