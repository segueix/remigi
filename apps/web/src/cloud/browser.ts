/**
 * El navegador des d'on s'obre l'app, per saber si Google hi deixarà entrar.
 *
 * Google no deixa iniciar sessió dins del navegador integrat d'algunes apps
 * (Instagram, Facebook, Messenger, TikTok, LinkedIn…): és el «403:
 * disallowed_useragent». Passa sobretot quan algú obre l'enllaç compartit des
 * d'aquestes apps. Llavors cal obrir-lo a Safari o a Chrome.
 */

export interface BrowserInfo {
  /** Nom de l'app amb navegador integrat on Google no deixa entrar, o null. */
  inApp: string | null;
  /** iPhone o iPad. */
  ios: boolean;
  /** Oberta com a app instal·lada (icona a la pantalla d'inici). */
  standalone: boolean;
}

const IN_APP: [RegExp, string][] = [
  [/Instagram/i, 'Instagram'],
  [/FBAN|FBAV|FB_IAB|FBIOS/i, 'Facebook'],
  [/Messenger/i, 'Messenger'],
  [/musical_ly|BytedanceWebview|TikTok/i, 'TikTok'],
  [/LinkedInApp/i, 'LinkedIn'],
  [/Snapchat/i, 'Snapchat'],
  [/Line\//i, 'LINE'],
  [/Twitter/i, 'X'],
];

export function detectBrowser(ua: string, standalone: boolean): BrowserInfo {
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const named = IN_APP.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
  // Un navegador integrat genèric: a l'iPhone, sense «Safari» ni cap navegador
  // conegut (però no l'app instal·lada, que tampoc no porta «Safari»); a
  // Android, la WebView («; wv)»).
  const genericIos = ios && !standalone && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const genericAndroid = /Android/.test(ua) && /; wv\)/.test(ua);
  const inApp = named ?? (genericIos || genericAndroid ? 'aquesta app' : null);
  return { inApp, ios, standalone };
}

export function currentBrowser(): BrowserInfo {
  if (typeof navigator === 'undefined') return { inApp: null, ios: false, standalone: false };
  let standalone = false;
  try {
    standalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    standalone = false;
  }
  return detectBrowser(navigator.userAgent, standalone);
}

/** El missatge per a qui és dins d'una app on Google no deixa entrar. */
export function inAppMessage(info: BrowserInfo): string {
  const where = info.ios ? 'Safari' : 'Chrome';
  return (
    `Google no deixa entrar des del navegador de ${info.inApp}. ` +
    `Obre l’enllaç a ${where} (al menú ⋯ o ⋮, «Obre al navegador») i entra des d’allà.`
  );
}

/** El missatge quan la redirecció torna sense sessió. */
export function redirectFailedMessage(info: BrowserInfo): string {
  if (info.ios && info.standalone) {
    return (
      'L’iPhone no ha deixat completar l’entrada amb Google des de l’app instal·lada. ' +
      'Torna-ho a provar; si continua passant, obre eltauler.cat/remigi a Safari i entra des d’allà.'
    );
  }
  return (
    'No s’ha pogut completar l’entrada amb Google en tornar. Torna-ho a provar, i comprova que el ' +
    'navegador no estigui en mode privat ni bloquegi les galetes.'
  );
}
