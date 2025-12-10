import 'package:shared_preferences/shared_preferences.dart';

/// Servicio para manejar el almacenamiento local
class StorageService {
  static const String _keyToken = 'auth_token';
  static const String _keyUserId = 'user_id';
  static const String _keyUserCedula = 'user_cedula';
  static const String _keyUserName = 'user_name';
  static const String _keyIsUnlocked = 'is_unlocked';
  static const String _keyDevicePlaca = 'device_placa';
  static const String _keyPlacaConfigurada = 'placa_configurada';

  /// Guarda el token de autenticación
  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyToken, token);
  }

  /// Obtiene el token de autenticación
  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyToken);
  }

  /// Guarda información del usuario
  static Future<void> saveUserInfo({
    required String userId,
    required String cedula,
    required String name,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyUserId, userId);
    await prefs.setString(_keyUserCedula, cedula);
    await prefs.setString(_keyUserName, name);
  }

  /// Obtiene información del usuario
  static Future<Map<String, String?>> getUserInfo() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'userId': prefs.getString(_keyUserId),
      'cedula': prefs.getString(_keyUserCedula),
      'name': prefs.getString(_keyUserName),
    };
  }

  /// Marca la sesión como desbloqueada
  static Future<void> setUnlocked(bool unlocked) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyIsUnlocked, unlocked);
  }

  /// Verifica si la sesión está desbloqueada
  static Future<bool> isUnlocked() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyIsUnlocked) ?? false;
  }

  /// Guarda la placa del dispositivo
  static Future<void> saveDevicePlaca(String placa) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyDevicePlaca, placa);
  }

  /// Obtiene la placa guardada del dispositivo
  static Future<String?> getDevicePlaca() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyDevicePlaca);
  }

  /// Marca la placa como configurada
  static Future<void> setPlacaConfigurada(bool configurada) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyPlacaConfigurada, configurada);
  }

  /// Verifica si la placa está configurada
  static Future<bool> isPlacaConfigurada() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyPlacaConfigurada) ?? false;
  }

  /// Limpia toda la información de sesión (pero mantiene la placa configurada)
  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyToken);
    await prefs.remove(_keyUserId);
    await prefs.remove(_keyUserCedula);
    await prefs.remove(_keyUserName);
    await prefs.setBool(_keyIsUnlocked, false);
  }
}

