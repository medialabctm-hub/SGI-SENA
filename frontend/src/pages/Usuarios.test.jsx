import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Usuarios from './Usuarios';

vi.mock('../components/Header', () => ({ default: () => null }));
vi.mock('../components/Sidebar', () => ({ default: () => null }));
vi.mock('../components/Toast', () => ({ default: () => null }));
vi.mock('../components/DestructiveConfirmModal', () => ({
  default: () => null,
}));
vi.mock('../components/ImportarUsuarios', () => ({ default: () => null }));
vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => ({ subscribe: null }),
}));
vi.mock('./LoadingDemo', () => ({ LoadingScreen: () => null }));

const user = {
  id_usuario: 17,
  nombre_usuario: 'Ada Lovelace',
  cedula: '12345',
  tipo_documento: 'CC',
  correo: 'ada@example.com',
  telefono: '3001234567',
  nombre_rol: 'Aprendiz',
};

function responseFor(url) {
  if (url === '/api/auth/users') return [user];
  if (url === '/api/permissions/roles') return { roles: [{ rol: 'Aprendiz' }] };
  if (url === '/api/auth/user/17') return { user };
  throw new Error(`Unexpected request: ${url}`);
}

describe('Usuarios edit dialog', () => {
  beforeEach(() => {
    localStorage.setItem(
      'user',
      JSON.stringify({ nombre_rol: 'Administrador' })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async url => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(responseFor(url)),
      }))
    );
  });

  afterEach(() => {
    localStorage.removeItem('user');
    vi.unstubAllGlobals();
  });

  it('opens an accessible dialog and restores focus to its edit trigger after Escape', async () => {
    render(<Usuarios />);

    const editButton = await screen.findByRole('button', { name: 'Editar' });
    editButton.focus();
    fireEvent.click(editButton);

    const dialog = await screen.findByRole('dialog', {
      name: 'Editar usuario',
    });
    const closeButton = screen.getByRole('button', { name: 'Cerrar diálogo' });

    await waitFor(() => expect(closeButton).toHaveFocus());
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.closest('.dashboard-layout')).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(editButton).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps Tab navigation within the edit dialog in both directions', async () => {
    render(<Usuarios />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Editar usuario',
    });
    const closeButton = screen.getByRole('button', { name: 'Cerrar diálogo' });
    const saveButton = screen.getByRole('button', { name: 'Guardar' });

    saveButton.focus();
    fireEvent.keyDown(saveButton, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });
    expect(saveButton).toHaveFocus();
    expect(dialog).toBeInTheDocument();
  });

  it('closes an expanded document selector on the first Escape and the dialog on the next', async () => {
    render(<Usuarios />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));

    const selector = (await screen.findAllByRole('combobox'))[0];
    selector.focus();
    fireEvent.keyDown(selector, { key: 'Enter' });
    expect(selector).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(selector, { key: 'Escape' });
    await waitFor(() =>
      expect(selector).toHaveAttribute('aria-expanded', 'false')
    );
    await waitFor(() => expect(selector).toHaveFocus());
    expect(
      screen.getByRole('dialog', { name: 'Editar usuario' })
    ).toBeInTheDocument();

    fireEvent.keyDown(selector, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('associates the user name label with its editable field', async () => {
    render(<Usuarios />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));

    expect(await screen.findByLabelText('Nombre completo')).toHaveValue(
      'Ada Lovelace'
    );
    expect(
      screen.getByRole('combobox', { name: 'Tipo de Documento' })
    ).toBeInTheDocument();
  });
});
