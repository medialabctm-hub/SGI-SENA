/**
 * Tests para el hook useForm
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useForm } from './useForm';

describe('useForm', () => {
  it('inicializa con los valores pasados', () => {
    const { result } = renderHook(() => useForm({ nombre: '', email: '' }));
    expect(result.current.form).toEqual({ nombre: '', email: '' });
    expect(result.current.errores).toEqual({});
  });

  it('actualiza el formulario con handleChange', () => {
    const { result } = renderHook(() => useForm({ nombre: '' }));
    act(() => {
      result.current.handleChange({
        target: { name: 'nombre', value: 'Juan', type: 'text' },
      });
    });
    expect(result.current.form.nombre).toBe('Juan');
  });

  it('resetForm restaura valores iniciales', () => {
    const { result } = renderHook(() => useForm({ nombre: 'Inicial' }));
    act(() => {
      result.current.handleChange({
        target: { name: 'nombre', value: 'Cambiado', type: 'text' },
      });
    });
    expect(result.current.form.nombre).toBe('Cambiado');
    act(() => {
      result.current.resetForm();
    });
    expect(result.current.form.nombre).toBe('Inicial');
  });

  it('setFieldValue actualiza un campo', () => {
    const { result } = renderHook(() => useForm({ a: 1, b: 2 }));
    act(() => {
      result.current.setFieldValue('a', 10);
    });
    expect(result.current.form.a).toBe(10);
    expect(result.current.form.b).toBe(2);
  });
});
