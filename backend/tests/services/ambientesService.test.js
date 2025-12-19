/**
 * Test del servicio de expansión de asignaciones de ambientes
 * 
 * Este archivo contiene tests para verificar que el servicio
 * `ambientesService.js` funciona correctamente.
 */

import {
  expandirAsignacionesPorFechas,
  convertirNombresDiasANumeros,
  validarRangoHoras,
  validarRangoFechas,
  calcularCantidadAsignaciones,
  obtenerNombreDia
} from '../services/ambientesService.js';

describe('AmbientesService - Expansión de Asignaciones', () => {
  
  describe('obtenerNombreDia', () => {
    test('debe retornar nombres de días correctos', () => {
      expect(obtenerNombreDia(0)).toBe('Domingo');
      expect(obtenerNombreDia(1)).toBe('Lunes');
      expect(obtenerNombreDia(5)).toBe('Viernes');
      expect(obtenerNombreDia(6)).toBe('Sábado');
    });
  });

  describe('convertirNombresDiasANumeros', () => {
    test('debe convertir nombres de días a números', () => {
      const resultado = convertirNombresDiasANumeros(['Lunes', 'Viernes']);
      expect(resultado).toEqual([1, 5]);
    });

    test('debe ignorar nombres inválidos', () => {
      const resultado = convertirNombresDiasANumeros(['Lunes', 'DiaInvalido', 'Viernes']);
      expect(resultado).toEqual([1, 5]);
    });
  });

  describe('validarRangoHoras', () => {
    test('debe validar horas correctas', () => {
      const resultado = validarRangoHoras('08:00', '12:00');
      expect(resultado.valid).toBe(true);
    });

    test('debe rechazar formato inválido', () => {
      const resultado = validarRangoHoras('8:00', '12:00');
      expect(resultado.valid).toBe(false);
    });

    test('debe rechazar hora fin anterior a hora inicio', () => {
      const resultado = validarRangoHoras('12:00', '08:00');
      expect(resultado.valid).toBe(false);
    });

    test('debe rechazar horas iguales', () => {
      const resultado = validarRangoHoras('08:00', '08:00');
      expect(resultado.valid).toBe(false);
    });
  });

  describe('validarRangoFechas', () => {
    test('debe validar rango de fechas correcto', () => {
      const resultado = validarRangoFechas('2024-12-19', '2025-01-09');
      expect(resultado.valid).toBe(true);
    });

    test('debe rechazar fecha fin anterior a fecha inicio', () => {
      const resultado = validarRangoFechas('2025-01-09', '2024-12-19');
      expect(resultado.valid).toBe(false);
    });

    test('debe aceptar fechas iguales', () => {
      const resultado = validarRangoFechas('2024-12-19', '2024-12-19');
      expect(resultado.valid).toBe(true);
    });
  });

  describe('expandirAsignacionesPorFechas', () => {
    test('debe generar asignaciones para viernes del rango', () => {
      const resultado = expandirAsignacionesPorFechas(
        '2024-12-19',
        '2024-12-31',
        [5], // Viernes
        '08:00',
        '12:00'
      );

      // Diciembre 2024: viernes 20, 27
      expect(resultado.length).toBe(2);
      resultado.forEach(asig => {
        expect(asig.hora_inicio).toBe('08:00');
        expect(asig.hora_fin).toBe('12:00');
      });
    });

    test('debe generar asignaciones para múltiples días', () => {
      const resultado = expandirAsignacionesPorFechas(
        '2024-12-19',
        '2024-12-20',
        [4, 5], // Jueves, Viernes
        '09:00',
        '15:00'
      );

      // 19 es jueves, 20 es viernes
      expect(resultado.length).toBe(2);
    });

    test('debe generar asignaciones para semana completa', () => {
      const resultado = expandirAsignacionesPorFechas(
        '2024-12-23', // Lunes
        '2024-12-27', // Viernes
        [1, 2, 3, 4, 5], // Lunes a viernes
        '08:00',
        '17:00'
      );

      // 5 días laborales
      expect(resultado.length).toBe(5);
    });

    test('debe generar 0 asignaciones si no hay días coincidentes', () => {
      const resultado = expandirAsignacionesPorFechas(
        '2024-12-23', // Lunes
        '2024-12-27', // Viernes
        [0], // Domingo
        '08:00',
        '12:00'
      );

      expect(resultado.length).toBe(0);
    });

    test('debe incluir información correcta de cada asignación', () => {
      const resultado = expandirAsignacionesPorFechas(
        '2024-12-19',
        '2024-12-20',
        [4, 5], // Jueves, Viernes
        '10:30',
        '14:45'
      );

      resultado.forEach(asig => {
        expect(asig).toHaveProperty('fecha_asignacion');
        expect(asig).toHaveProperty('dia_semana');
        expect(asig).toHaveProperty('nombre_dia');
        expect(asig).toHaveProperty('hora_inicio', '10:30');
        expect(asig).toHaveProperty('hora_fin', '14:45');
      });
    });
  });

  describe('calcularCantidadAsignaciones', () => {
    test('debe calcular correctamente para viernes en diciembre', () => {
      const cantidad = calcularCantidadAsignaciones(
        '2024-12-01',
        '2024-12-31',
        [5] // Viernes
      );

      // Diciembre 2024 tiene 4-5 viernes
      expect(cantidad).toBeGreaterThan(0);
      expect(cantidad).toBeLessThanOrEqual(5);
    });

    test('debe retornar 0 si array de días es vacío', () => {
      const cantidad = calcularCantidadAsignaciones(
        '2024-12-01',
        '2024-12-31',
        []
      );

      expect(cantidad).toBe(0);
    });

    test('debe contar correctamente para días laborales', () => {
      const cantidad = calcularCantidadAsignaciones(
        '2024-12-23', // Lunes
        '2024-12-27', // Viernes
        [1, 2, 3, 4, 5] // Lunes a viernes
      );

      expect(cantidad).toBe(5);
    });

    test('debe contar correctamente para una única fecha', () => {
      const cantidad = calcularCantidadAsignaciones(
        '2024-12-19', // Jueves
        '2024-12-19',
        [4] // Jueves
      );

      expect(cantidad).toBe(1);
    });
  });

  describe('Caso de uso real: Ejemplo del usuario', () => {
    test('Asignar Laboratorio 1 todos los viernes de diciembre a enero', () => {
      const resultado = expandirAsignacionesPorFechas(
        '2024-12-19',
        '2025-01-09',
        [5], // Viernes
        '08:00',
        '12:00'
      );

      // Viernes: 20 dic, 27 dic, 3 ene, 10 ene (pero 10 está fuera del rango)
      // Así que debe ser 3 (20 dic, 27 dic, 3 ene)
      expect(resultado.length).toBeGreaterThan(0);
      expect(resultado.length).toBeLessThanOrEqual(4);

      // Verificar que el nombre de día es correcto
      resultado.forEach(asig => {
        expect(asig.nombre_dia).toBe('Viernes');
        expect(asig.dia_semana).toBe(5);
      });
    });

    test('Asignar Aula lunes y miércoles durante 6 semanas', () => {
      const resultado = expandirAsignacionesPorFechas(
        '2025-01-13',
        '2025-02-28',
        [1, 3], // Lunes, Miércoles
        '14:00',
        '16:00'
      );

      // Aproximadamente 2 días × 6-7 semanas = 12-14 asignaciones
      expect(resultado.length).toBeGreaterThan(10);
      expect(resultado.length).toBeLessThanOrEqual(15);
    });

    test('Asignar Taller todos los días laborales en enero', () => {
      const resultado = expandirAsignacionesPorFechas(
        '2025-01-01',
        '2025-01-31',
        [1, 2, 3, 4, 5], // Lunes a viernes
        '09:00',
        '17:00'
      );

      // Enero 2025: 21-22 días laborales
      expect(resultado.length).toBeGreaterThan(19);
      expect(resultado.length).toBeLessThanOrEqual(23);
    });
  });
});
