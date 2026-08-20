export function createToastCloseController({
  onClose,
  setIsClosing,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  transitionMs = 300,
}) {
  let closing = false;
  let closeTimer = null;

  return {
    close() {
      if (closing) return;
      closing = true;
      setIsClosing(true);
      closeTimer = setTimeoutFn(() => onClose?.(), transitionMs);
    },

    cleanup() {
      if (closeTimer !== null) clearTimeoutFn(closeTimer);
    },
  };
}
