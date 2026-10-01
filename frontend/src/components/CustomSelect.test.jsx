import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CustomSelect from './CustomSelect';

describe('CustomSelect in scrollable dialogs', () => {
  it('returns focus to the combobox after choosing a portal option', async () => {
    render(<CustomSelect name="documento" value="CC" options={['CC', 'TI']} />);
    const select = screen.getByRole('combobox');
    fireEvent.click(select);
    fireEvent.click(await screen.findByRole('option', { name: 'TI' }));
    expect(select).toHaveFocus();
    expect(select).toHaveAttribute('aria-expanded', 'false');
  });
  it('does not scroll the page when highlighting a portal option', async () => {
    const previous = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    const scroll = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    try {
      render(<CustomSelect name="documento" value="CC" options={['CC', 'TI']} />);
      fireEvent.click(screen.getByRole('combobox'));
      await screen.findByRole('option', { name: 'CC' });
      fireEvent.mouseEnter(screen.getByRole('option', { name: 'TI' }));
      await waitFor(() => expect(scroll).not.toHaveBeenCalled());
    } finally {
      if (previous) Object.defineProperty(Element.prototype, 'scrollIntoView', previous);
      else delete Element.prototype.scrollIntoView;
    }
  });
});
