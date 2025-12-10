import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';

/// Servicio para obtener información del dispositivo/equipo
class DeviceService {
  static final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();

  /// Obtiene la placa/serial del equipo
  /// En Windows: deviceId o computerName
  /// En Linux: Machine ID o hostname
  /// En macOS: computerName o hostname
  static Future<String> getDevicePlaca() async {
    try {
      if (Platform.isWindows) {
        final windowsInfo = await _deviceInfo.windowsInfo;
        // Usar deviceId si está disponible, sino computerName
        final deviceId = windowsInfo.deviceId;
        if (deviceId.isNotEmpty) {
          return deviceId;
        }
        return windowsInfo.computerName;
      } else if (Platform.isLinux) {
        final linuxInfo = await _deviceInfo.linuxInfo;
        try {
          final machineId = linuxInfo.machineId;
          if (machineId != null && machineId.isNotEmpty) {
            return machineId;
          }
        } catch (_) {
          // Ignorar error
        }
        return Platform.localHostname;
      } else if (Platform.isMacOS) {
        final macInfo = await _deviceInfo.macOsInfo;
        final computerName = macInfo.computerName;
        if (computerName.isNotEmpty) {
          return computerName;
        }
        return Platform.localHostname;
      }
      
      // Fallback: usar hostname
      return Platform.localHostname;
    } catch (e) {
      // Si falla, usar hostname como último recurso
      return Platform.localHostname;
    }
  }

  /// Obtiene información adicional del dispositivo
  static Future<Map<String, String>> getDeviceInfo() async {
    try {
      if (Platform.isWindows) {
        final windowsInfo = await _deviceInfo.windowsInfo;
        final deviceId = windowsInfo.deviceId;
        return {
          'placa': deviceId.isNotEmpty 
              ? deviceId 
              : windowsInfo.computerName,
          'computerName': windowsInfo.computerName,
          'osVersion': windowsInfo.displayVersion,
        };
      } else if (Platform.isLinux) {
        final linuxInfo = await _deviceInfo.linuxInfo;
        String placa = Platform.localHostname;
        try {
          final machineId = linuxInfo.machineId;
          if (machineId != null && machineId.isNotEmpty) {
            placa = machineId;
          }
        } catch (_) {
          // Usar hostname por defecto
        }
        return {
          'placa': placa,
          'hostname': Platform.localHostname,
          'osVersion': linuxInfo.prettyName,
        };
      } else if (Platform.isMacOS) {
        final macInfo = await _deviceInfo.macOsInfo;
        final computerName = macInfo.computerName;
        return {
          'placa': computerName.isNotEmpty
              ? computerName
              : Platform.localHostname,
          'hostname': Platform.localHostname,
          'osVersion': macInfo.osRelease,
        };
      }
      
      return {
        'placa': Platform.localHostname,
        'hostname': Platform.localHostname,
      };
    } catch (e) {
      return {
        'placa': Platform.localHostname,
        'hostname': Platform.localHostname,
      };
    }
  }
}

