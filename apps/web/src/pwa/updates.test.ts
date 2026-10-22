import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerUpdates } from './updates';

function setup(controlled = true) {
  vi.useFakeTimers();
  const update = vi.fn().mockResolvedValue(undefined);
  const register = vi.fn().mockResolvedValue({ update });
  const sw = Object.assign(new EventTarget(), { controller: controlled ? {} : null, register });
  const reload = vi.fn();
  const win = Object.assign(new EventTarget(), { location: { reload }, setInterval });
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const nav = { serviceWorker: sw, onLine: true };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('navigator', nav);
  registerUpdates('/remigi/');
  return { update, register, sw, reload, win, doc, nav };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('actualització de l’app', () => {
  it('comprova la versió en obrir, tornar al joc, reconnectar i cada minut', async () => {
    const { update, register, win, doc } = setup();
    await vi.advanceTimersByTimeAsync(0);
    expect(register).toHaveBeenCalledWith('/remigi/sw.js', { updateViaCache: 'none' });
    expect(update).toHaveBeenCalledTimes(1);
    for (const event of ['online', 'focus', 'pageshow']) {
      win.dispatchEvent(new Event(event));
      await vi.advanceTimersByTimeAsync(0);
    }
    doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(update).toHaveBeenCalledTimes(6);
  });
  it('recarrega només una vegada en activar una publicació nova', () => {
    const { sw, reload } = setup();
    sw.dispatchEvent(new Event('controllerchange'));
    sw.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it('no recarrega en instal·lar-se per primera vegada', () => {
    const { sw, reload } = setup(false);
    sw.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
  });
  it('no consulta en segon pla ni sense connexió, i reintenta després d’un error', async () => {
    const { update, win, doc, nav } = setup();
    await vi.advanceTimersByTimeAsync(0);
    doc.visibilityState = 'hidden';
    await vi.advanceTimersByTimeAsync(60_000);
    doc.visibilityState = 'visible';
    nav.onLine = false;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(update).toHaveBeenCalledTimes(1);
    nav.onLine = true;
    update.mockRejectedValueOnce(new Error('xarxa'));
    win.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(update).toHaveBeenCalledTimes(3);
  });
});
