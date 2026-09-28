import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../styles/components/modals.css';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isFocusableAndVisible(element, dialog) {
  for (
    let current = element;
    current && dialog.contains(current);
    current = current.parentElement
  ) {
    if (
      current.hidden ||
      current.inert ||
      current.getAttribute('aria-hidden') === 'true'
    ) {
      return false;
    }

    const { display, visibility } = window.getComputedStyle(current);
    if (
      display === 'none' ||
      visibility === 'hidden' ||
      visibility === 'collapse'
    ) {
      return false;
    }
  }

  return true;
}

export default function FormDialog({
  open,
  title,
  onClose,
  children,
  size = 'medium',
  className = '',
  closeOnOverlayClick = false,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  const handleKeyDownCapture = event => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (event.key === 'Escape') {
      const expandedCombobox = dialog.querySelector(
        '[role="combobox"][aria-expanded="true"]'
      );
      const listbox =
        expandedCombobox &&
        document.getElementById(expandedCombobox.getAttribute('aria-controls'));
      const eventIsInsideCombobox =
        expandedCombobox &&
        (expandedCombobox.contains(event.target) ||
          listbox?.contains(event.target));

      if (eventIsInsideCombobox) {
        Promise.resolve().then(() => {
          if (expandedCombobox.isConnected) expandedCombobox.focus();
        });
        return;
      }

      event.preventDefault();
      onCloseRef.current?.();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      dialog.querySelectorAll(FOCUSABLE_SELECTOR)
    ).filter(element => isFocusableAndVisible(element, dialog));
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        !dialog.contains(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        !dialog.contains(document.activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const dialog = dialogRef.current;
    const previousActiveElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const firstFocusable = Array.from(
      dialog.querySelectorAll(FOCUSABLE_SELECTOR)
    ).find(element => isFocusableAndVisible(element, dialog));
    (firstFocusable || dialog).focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (
        previousActiveElement instanceof HTMLElement &&
        previousActiveElement.isConnected
      ) {
        previousActiveElement.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  const sizeClass = ['small', 'medium', 'large'].includes(size)
    ? `form-modal-${size}`
    : '';

  return createPortal(
    <div
      className="modal-overlay form-dialog-overlay"
      onMouseDown={event => {
        if (closeOnOverlayClick && event.target === event.currentTarget)
          onClose?.();
      }}
    >
      <section
        ref={dialogRef}
        className={`modal-sheet form-modal ${sizeClass} form-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDownCapture={handleKeyDownCapture}
      >
        <header className="modal-header">
          <h3 id={titleId}>{title}</h3>
          <button
            className="btn"
            type="button"
            aria-label="Cerrar diálogo"
            onClick={onClose}
          >
            Cerrar
          </button>
        </header>
        <div className="form-dialog__body">{children}</div>
      </section>
    </div>,
    document.body
  );
}
