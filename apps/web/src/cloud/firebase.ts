import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore/lite';
import { cached, clearRankingCache } from './cache';
import { RANKING_SIZE, dayRanking, legacyDayEntry, type DayEntry, type PlayerEntry, type RankRow } from './ranking';
import { LIVE_LIMIT, parseSnapshot, snapshotRanking } from './snapshot';

/**
 * La connexió amb Firebase (projecte `remigi-c37ac`): el compte de Google i
 * els rànquings. Aquesta configuració no és secreta (va dins de la web de tota
 * manera); el que protegeix les dades són les regles de Firestore
 * (`firestore.rules`) i els dominis autoritzats d'Authentication.
 *
 * El SDK es carrega a demanda (`import()`): qui no obre mai la partida del dia
 * ni ha entrat mai amb Google no baixa res de Firebase.
 */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCtUkMrMJ8Ku3nQ7R5v3RP9Fb-Bo_TP7nA',
  authDomain: 'remigi-c37ac.firebaseapp.com',
  projectId: 'remigi-c37ac',
  storageBucket: 'remigi-c37ac.firebasestorage.app',
  messagingSenderId: '146496744955',
  appId: '1:146496744955:web:c04fd6d4ed3bfe85852f5e',
};

export interface CloudUser {
  uid: string;
  /**
   * El nom de pila del compte de Google: només per proposar-lo com a nom de
   * Remigi en entrar. No es desa enlloc tal qual.
   */
  firstName: string;
}

interface Services {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  /** Les funcions d'Auth, ja carregades: entrar ha de poder anar sense esperar res. */
  authApi: typeof import('firebase/auth');
}

let services: Promise<Services> | null = null;
/** Els serveis, un cop carregats (per poder obrir la finestra de Google dins del toc). */
let ready: Services | null = null;

function load(): Promise<Services> {
  services ??= (async () => {
    const [{ initializeApp }, authApi, { getFirestore }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore/lite'),
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    ready = { app, auth: authApi.getAuth(app), db: getFirestore(app), authApi };
    return ready;
  })();
  // Si falla (sense connexió), el pròxim intent ho torna a provar.
  services.catch(() => {
    services = null;
  });
  return services;
}

/**
 * Carrega Firebase per endavant (a l'inici, mentre es veu «Entra»). Safari a
 * l'iPhone només deixa obrir la finestra de Google dins del mateix toc: si en
 * tocar encara s'ha de baixar Firebase, la finestra arriba tard i la bloqueja.
 */
export function preloadFirebase(): void {
  void load().catch(() => {});
}

const toUser = (user: User | null): CloudUser | null =>
  user ? { uid: user.uid, firstName: (user.displayName ?? '').trim().split(/\s+/)[0] ?? '' } : null;

/** Avisa de cada canvi de sessió (i de la d'ara en començar). Torna com deixar d'escoltar. */
export function watchUser(callback: (user: CloudUser | null) => void): () => void {
  let stop: (() => void) | null = null;
  let cancelled = false;
  void load()
    .then(({ auth, authApi }) => {
      if (cancelled) return;
      stop = authApi.onAuthStateChanged(auth, (user) => callback(toUser(user)));
    })
    .catch(() => callback(null));
  return () => {
    cancelled = true;
    stop?.();
  };
}

/** Marca que s'ha anat a Google per redirecció, per saber-ho en tornar. */
const REDIRECT_KEY = 'remigi:google:redireccio';

function markRedirect(on: boolean): void {
  try {
    if (on) localStorage.setItem(REDIRECT_KEY, String(Date.now()));
    else localStorage.removeItem(REDIRECT_KEY);
  } catch {
    // Sense emmagatzematge, no es podrà avisar si la redirecció falla.
  }
}

/** Errors de la finestra emergent que es poden salvar amb una redirecció. */
const REDIRECT_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
  'auth/internal-error',
]);

/**
 * Entra amb Google. Primer amb una finestra emergent, oberta **dins del mateix
 * toc** si Firebase ja és carregat (Safari a l'iPhone no deixa obrir-la més
 * tard); si el navegador no la deixa obrir, redirigint la pàgina.
 */
export function signInWithGoogle(): Promise<void> {
  const popup = (s: Services) => {
    const provider = new s.authApi.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return s.authApi.signInWithPopup(s.auth, provider).then(
      () => undefined,
      async (error: unknown) => {
        const code = (error as { code?: string }).code ?? '';
        if (!REDIRECT_CODES.has(code)) throw error;
        markRedirect(true);
        await s.authApi.signInWithRedirect(s.auth, provider);
      },
    );
  };
  // Sense cap `await` abans de la finestra: ha de sortir dins del toc.
  if (ready) return popup(ready);
  return load().then(popup);
}

/**
 * En tornar d'una redirecció de Google: si s'hi havia anat i no hi ha sessió,
 * l'entrada no s'ha completat (a Safari passa quan el navegador no deixa
 * compartir dades amb la pàgina d'inici de sessió de Google). Torna «failed»
 * per avisar el jugador; «ok» o «none» si no cal dir res.
 */
export async function checkRedirect(): Promise<'ok' | 'failed' | 'none'> {
  let pending = false;
  try {
    pending = localStorage.getItem(REDIRECT_KEY) !== null;
  } catch {
    pending = false;
  }
  if (!pending) return 'none';
  markRedirect(false);
  const { auth, authApi } = await load();
  try {
    const result = await authApi.getRedirectResult(auth);
    return result?.user || auth.currentUser ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
}

export async function signOutCloud(): Promise<void> {
  const { auth, authApi } = await load();
  await authApi.signOut(auth);
}

/**
 * Desa el resultat del dia. Només es pot crear un cop: si ja hi era, les
 * regles no deixen sobreescriure'l (`permission-denied`), i això vol dir que
 * ja està fet. Així no cal llegir-lo abans (una lectura menys).
 */
export async function submitDayResult(uid: string, day: string, entry: DayEntry): Promise<void> {
  const { db } = await load();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore/lite');
  const ref = doc(db, 'dia', day, 'resultats', uid);
  const denied = (error: unknown) => (error as { code?: string }).code === 'permission-denied';
  try {
    await setDoc(ref, { ...entry, at: serverTimestamp() });
  } catch (error) {
    if (!denied(error)) throw error;
    /*
     * O ja hi era, o les regles publicades encara són les d'abans del
     * desempat (no accepten `rivals`): llavors, el format d'abans.
     */
    try {
      await setDoc(ref, { ...legacyDayEntry(entry), at: serverTimestamp() });
    } catch (again) {
      if (!denied(again)) throw again;
    }
  }
  clearRankingCache();
}

/** Desa l'àlies i la ratxa del jugador (per al rànquing de ratxes). */
export async function submitPlayer(uid: string, entry: PlayerEntry): Promise<void> {
  const { db } = await load();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore/lite');
  await setDoc(doc(db, 'jugadors', uid), { ...entry, at: serverTimestamp() });
  clearRankingCache();
}

export interface RawRow {
  id: string;
  data: unknown;
}

export interface DayView {
  rows: RankRow<DayEntry>[];
  /** D'on surt: en directe (pocs jugadors) o de la fotografia. */
  source: 'directe' | 'fotografia';
  /** Quan es va fer la fotografia (ms), si en surt. */
  updatedAt: number | null;
  /** És la classificació final del dia. */
  final: boolean;
  /** La teva fila hi és afegida després de la fotografia (posició provisional). */
  provisional: boolean;
}

/**
 * La classificació d'un dia, sencera. Primer, la fotografia (1 lectura):
 * amb molts jugadors (`LIVE_LIMIT` o més), és la que es mostra, amb la teva
 * fila al seu lloc si has jugat després. Amb pocs, la classificació es llegeix
 * en directe (com a molt `LIVE_LIMIT` lectures). Tot es desa 10 minuts.
 */
export function fetchDayView(day: string, uid: string | null, mine: DayEntry | null): Promise<DayView> {
  return cached(`vista:${day}:${uid ?? '-'}:${mine?.score ?? '-'}`, async () => {
    const { db } = await load();
    const { collection, doc, getDoc, getDocs, limit, orderBy, query } = await import('firebase/firestore/lite');
    // Si la fotografia no es pot llegir (regles sense publicar, per exemple), en directe.
    const data = await getDoc(doc(db, 'classificacio', day)).then(
      (snap) => (snap.exists() ? snap.data() : null),
      () => null,
    );
    const at = data && typeof (data as { at?: { toMillis?: () => number } }).at?.toMillis === 'function'
      ? (data as { at: { toMillis: () => number } }).at.toMillis()
      : null;
    const snapshot = parseSnapshot(data, at);
    if (snapshot && snapshot.rows.length >= LIVE_LIMIT) {
      const { rows, provisional } = snapshotRanking(snapshot, uid, mine);
      return { rows, source: 'fotografia', updatedAt: snapshot.updatedAt, final: snapshot.final, provisional };
    }
    const live = await getDocs(query(collection(db, 'dia', day, 'resultats'), orderBy('score'), limit(LIVE_LIMIT)));
    const rows = dayRanking(live.docs.map((d) => ({ id: d.id, data: d.data() })), uid);
    return { rows, source: 'directe', updatedAt: null, final: snapshot?.final ?? false, provisional: false };
  });
}

/**
 * El top de ratxes vives: només els que han jugat avui o ahir (les altres ja
 * s'han trencat), filtrat a Firestore perquè només es llegeixin les que es
 * veuen. Demana l'índex compost `jugadors` (lastDay ↑, streak ↓), vegeu
 * `firestore.indexes.json`; mentre no hi sigui, es llegeixen més files i es
 * filtren aquí.
 */
export function fetchStreakRanking(today: string, yesterday: string): Promise<RawRow[]> {
  return cached(`ratxes:${today}`, async () => {
    const { db } = await load();
    const { collection, getDocs, limit, orderBy, query, where } = await import('firebase/firestore/lite');
    const players = collection(db, 'jugadors');
    try {
      const snap = await getDocs(
        query(players, where('lastDay', 'in', [yesterday, today]), orderBy('streak', 'desc'), limit(RANKING_SIZE)),
      );
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    } catch (error) {
      if ((error as { code?: string }).code !== 'failed-precondition') throw error;
      // Sense l'índex encara: les ratxes més llargues, i `streakRanking` treu les mortes.
      const snap = await getDocs(query(players, orderBy('streak', 'desc'), limit(RANKING_SIZE * 3)));
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    }
  });
}

/** El desat privat del jugador (`perfils/{uid}`): nivell i lliga en curs. */
export async function fetchCloudSave(uid: string): Promise<unknown> {
  const { db } = await load();
  const { doc, getDoc } = await import('firebase/firestore/lite');
  const snap = await getDoc(doc(db, 'perfils', uid));
  return snap.exists() ? snap.data() : null;
}

export async function submitCloudSave(uid: string, data: Record<string, unknown>): Promise<void> {
  const { db } = await load();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore/lite');
  await setDoc(doc(db, 'perfils', uid), { ...data, at: serverTimestamp() });
}

/** La fitxa pública del jugador (àlies i ratxa del rànquing). */
export async function fetchPlayer(uid: string): Promise<unknown> {
  const { db } = await load();
  const { doc, getDoc } = await import('firebase/firestore/lite');
  const snap = await getDoc(doc(db, 'jugadors', uid));
  return snap.exists() ? snap.data() : null;
}

/** Si hi havia hagut sessió amb Google en aquest aparell (per carregar Firebase d'entrada). */
const SIGNED_KEY = 'remigi:google';

export function rememberSignedIn(signed: boolean): void {
  try {
    if (signed) localStorage.setItem(SIGNED_KEY, '1');
    else localStorage.removeItem(SIGNED_KEY);
  } catch {
    // Sense emmagatzematge, Firebase es carregarà en obrir la partida del dia.
  }
}

export function wasSignedIn(): boolean {
  try {
    return localStorage.getItem(SIGNED_KEY) === '1';
  } catch {
    return false;
  }
}
