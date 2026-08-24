import assert from 'node:assert/strict';
import test from 'node:test';
import { createToastCloseController } from './toastLifecycle.js';

test('createToastCloseController programa un solo cierre aunque coincidan autocierre y botón', () => {
  const scheduled = [];
  let closingChanges = 0;
  let closeCalls = 0;
  const controller = createToastCloseController({
    onClose: () => { closeCalls += 1; },
    setIsClosing: () => { closingChanges += 1; },
    setTimeoutFn: callback => {
      scheduled.push(callback);
      return callback;
    },
  });

  controller.close();
  controller.close();

  assert.equal(closingChanges, 1);
  assert.equal(scheduled.length, 1);

  scheduled[0]();
  assert.equal(closeCalls, 1);
});

test('createToastCloseController cancela el cierre pendiente al desmontar', () => {
  let clearedTimer;
  const timer = () => {};
  const controller = createToastCloseController({
    setIsClosing: () => {},
    setTimeoutFn: () => timer,
    clearTimeoutFn: value => { clearedTimer = value; },
  });

  controller.close();
  controller.cleanup();

  assert.equal(clearedTimer, timer);
});
