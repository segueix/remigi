import { describe, expect, it } from 'vitest';
import { detectBrowser, inAppMessage } from './browser';

const SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 Instagram 356.0.0.40.94';
const WEBVIEW_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const CHROME_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1';
const ANDROID_WV =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0 Mobile Safari/537.36';

describe('on Google deixa entrar', () => {
  it('Safari i Chrome de l’iPhone, sí', () => {
    expect(detectBrowser(SAFARI, false)).toEqual({ inApp: null, ios: true, standalone: false });
    expect(detectBrowser(CHROME_IOS, false).inApp).toBeNull();
  });

  it('l’app instal·lada a la pantalla d’inici no és cap navegador integrat', () => {
    expect(detectBrowser(WEBVIEW_IOS, true).inApp).toBeNull();
  });

  it('dins d’Instagram o d’una WebView, no: i el missatge diu on obrir-ho', () => {
    const insta = detectBrowser(INSTAGRAM, false);
    expect(insta.inApp).toBe('Instagram');
    expect(inAppMessage(insta)).toContain('Safari');
    expect(detectBrowser(WEBVIEW_IOS, false).inApp).toBe('aquesta app');
    const android = detectBrowser(ANDROID_WV, false);
    expect(android.inApp).toBe('aquesta app');
    expect(inAppMessage(android)).toContain('Chrome');
  });
});
