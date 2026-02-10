/**
 * Tests para RedirectIfAuth: redirige a dashboard con token, muestra hijos sin token
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RedirectIfAuth from './RedirectIfAuth';

describe('RedirectIfAuth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('muestra los hijos cuando no hay token', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<RedirectIfAuth><div>Formulario login</div></RedirectIfAuth>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Formulario login')).toBeInTheDocument();
  });

  it('redirige a /dashboard cuando hay token', () => {
    localStorage.setItem('token', 'fake-token');
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<RedirectIfAuth><div>Formulario login</div></RedirectIfAuth>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Formulario login')).not.toBeInTheDocument();
  });
});
