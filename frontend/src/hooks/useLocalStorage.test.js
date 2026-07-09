/**
 * Tests para useLocalStorage y useAuthToken
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage, useAuthToken } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('devuelve initialValue cuando no hay valor en localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('key1', null));
    expect(result.current[0]).toBe(null);
  });

  it('lee valor existente de localStorage', () => {
    localStorage.setItem('key1', JSON.stringify({ x: 1 }));
    const { result } = renderHook(() => useLocalStorage('key1', null));
    expect(result.current[0]).toEqual({ x: 1 });
  });

  it('permite actualizar el valor con setValue', () => {
    const { result } = renderHook(() => useLocalStorage('key1', null));
    act(() => {
      result.current[1]({ y: 2 });
    });
    expect(result.current[0]).toEqual({ y: 2 });
  });
});

describe('useAuthToken', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('devuelve null cuando no hay token', () => {
    const { result } = renderHook(() => useAuthToken());
    expect(result.current[0]).toBe(null);
  });

  it('lee el token de localStorage', () => {
    localStorage.setItem('token', 'mi-token');
    const { result } = renderHook(() => useAuthToken());
    expect(result.current[0]).toBe('mi-token');
  });
});
