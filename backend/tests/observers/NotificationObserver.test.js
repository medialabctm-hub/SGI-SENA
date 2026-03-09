/**
 * Tests para NotificationObserver (Observer Pattern)
 * Cubre Observer base, Subject y NotificationObserver
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  Observer,
  Subject,
  NotificationObserver,
} from '../../src/observers/NotificationObserver.js';

// -----------------------------------------------------------
// Observer base
// -----------------------------------------------------------
describe('Observer (clase base)', () => {
  it('debe lanzar error si se llama a update() directamente', () => {
    const obs = new Observer();
    expect(() => obs.update('event', {})).toThrow(
      'Método update debe ser implementado por las subclases'
    );
  });
});

// -----------------------------------------------------------
// Subject
// -----------------------------------------------------------
describe('Subject', () => {
  let subject;

  beforeEach(() => {
    subject = new Subject();
  });

  it('debe inicializarse con un array vacío de observers', () => {
    expect(subject.observers).toHaveLength(0);
  });

  it('debe suscribir un observer válido', () => {
    const obs = new Observer();
    subject.subscribe(obs);
    expect(subject.observers).toHaveLength(1);
  });

  it('debe lanzar error al suscribir algo que no es Observer', () => {
    expect(() => subject.subscribe({ update: jest.fn() })).toThrow(
      'El observador debe ser una instancia de Observer'
    );
    expect(() => subject.subscribe(null)).toThrow();
    expect(() => subject.subscribe('string')).toThrow();
  });

  it('debe desuscribir un observer existente', () => {
    const obs = new Observer();
    subject.subscribe(obs);
    subject.unsubscribe(obs);
    expect(subject.observers).toHaveLength(0);
  });

  it('no debe hacer nada si se desuscribe un observer no registrado', () => {
    const obs1 = new Observer();
    const obs2 = new Observer();
    subject.subscribe(obs1);
    subject.unsubscribe(obs2); // obs2 no fue suscrito
    expect(subject.observers).toHaveLength(1);
  });

  it('debe llamar update() en todos los observers al notificar', async () => {
    class TestObserver extends Observer {
      constructor() {
        super();
        this.calls = [];
      }
      update(event, data) {
        this.calls.push({ event, data });
      }
    }

    const obs1 = new TestObserver();
    const obs2 = new TestObserver();
    subject.subscribe(obs1);
    subject.subscribe(obs2);

    subject.notify('test.event', { value: 1 });

    // Dar tiempo para ejecución async en forEach
    await new Promise((r) => setTimeout(r, 10));

    expect(obs1.calls).toHaveLength(1);
    expect(obs1.calls[0]).toEqual({ event: 'test.event', data: { value: 1 } });
    expect(obs2.calls).toHaveLength(1);
  });

  it('debe continuar notificando si un observer lanza error', async () => {
    class ErrorObserver extends Observer {
      update() { throw new Error('observer error'); }
    }
    class GoodObserver extends Observer {
      constructor() { super(); this.called = false; }
      update() { this.called = true; }
    }

    const bad = new ErrorObserver();
    const good = new GoodObserver();
    subject.subscribe(bad);
    subject.subscribe(good);

    // No debe lanzar
    expect(() => subject.notify('test', {})).not.toThrow();

    await new Promise((r) => setTimeout(r, 10));
    expect(good.called).toBe(true);
  });
});

// -----------------------------------------------------------
// NotificationObserver
// -----------------------------------------------------------
describe('NotificationObserver', () => {
  let notificationService;
  let observer;

  beforeEach(() => {
    notificationService = {
      createForRole: jest.fn().mockResolvedValue({ inserted: 1 }),
      notifyNuevoEquipo: jest.fn().mockResolvedValue({ inserted: 1 }),
      createForUsers: jest.fn().mockResolvedValue({ inserted: 1 }),
    };
    observer = new NotificationObserver(notificationService);
  });

  it('debe manejar el evento user.registered', async () => {
    await observer.update('user.registered', { id: 1, nombre: 'Ana' });
    expect(notificationService.createForRole).toHaveBeenCalledWith(
      expect.objectContaining({ rolNombre: 'Administrador' })
    );
  });

  it('debe manejar el evento equipo.created', async () => {
    await observer.update('equipo.created', {
      codigo_equipo: 'EQ001',
      tipo: 'PC',
      modelo: 'Dell',
      ambiente: 'Lab 1',
      creadoPor: 1,
    });
    expect(notificationService.notifyNuevoEquipo).toHaveBeenCalledWith(
      expect.objectContaining({ equipoId: 'EQ001' })
    );
  });

  it('debe manejar el evento mantenimiento.due', async () => {
    await observer.update('mantenimiento.due', {
      userId: 5,
      equipo: 'PC-001',
      equipoId: 10,
    });
    expect(notificationService.createForUsers).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: [5] })
    );
  });

  it('no debe hacer nada con eventos desconocidos', async () => {
    await observer.update('unknown.event', {});
    expect(notificationService.createForRole).not.toHaveBeenCalled();
    expect(notificationService.notifyNuevoEquipo).not.toHaveBeenCalled();
    expect(notificationService.createForUsers).not.toHaveBeenCalled();
  });
});
