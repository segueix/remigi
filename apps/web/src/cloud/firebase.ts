import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore/lite';
import { RANKING_SIZE, type DayEntry, type PlayerEntry } from './ranking';

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
}

let services: Promise<Services> | null = null;

function load(): Promise<Services> {
  services ??= (async () => {
    const [{ initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore/lite'),
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    return { app, auth: getAuth(app), db: getFirestore(app) };
  })();
  // Si falla (sense connexió), el pròxim intent ho torna a provar.
  services.catch(() => {
    services = null;
  });
  return services;
}

const toUser = (user: User | null): CloudUser | null =>
  user ? { uid: user.uid, firstName: (user.displayName ?? '').trim().split(/\s+/)[0] ?? '' } : null;

/** Avisa de cada canvi de sessió (i de la d'ara en començar). Torna com deixar d'escoltar. */
export function watchUser(callback: (user: CloudUser | null) => void): () => void {
  let stop: (() => void) | null = null;
  let cancelled = false;
  void Promise.all([load(), import('firebase/auth')])
    .then(([{ auth }, { onAuthStateChanged }]) => {
      if (cancelled) return;
      stop = onAuthStateChanged(auth, (user) => callback(toUser(user)));
    })
    .catch(() => callback(null));
  return () => {
    cancelled = true;
    stop?.();
  };
}

/**
 * Entra amb Google. Primer amb una finestra emergent; si el navegador no la
 * deixa obrir, redirigint la pàgina (i en tornar ja s'hi és).
 */
export async function signInWithGoogle(): Promise<void> {
  const { auth } = await load();
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
}

export async function signOutCloud(): Promise<void> {
  const { auth } = await load();
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}

/**
 * Desa el resultat del dia. Només es pot crear un cop (les regles no deixen
 * canviar-lo): si ja hi era, no passa res.
 */
export async function submitDayResult(uid: string, day: string, entry: DayEntry): Promise<void> {
  const { db } = await load();
  const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore/lite');
  const ref = doc(db, 'dia', day, 'resultats', uid);
  if ((await getDoc(ref)).exists()) return;
  await setDoc(ref, { ...entry, at: serverTimestamp() });
}

/** Desa l'àlies i la ratxa del jugador (per al rànquing de ratxes). */
export async function submitPlayer(uid: string, entry: PlayerEntry): Promise<void> {
  const { db } = await load();
  const { doc, setDoc, serverTimestamp } = await import('firebase/firestore/lite');
  await setDoc(doc(db, 'jugadors', uid), { ...entry, at: serverTimestamp() });
}

export interface RawRow {
  id: string;
  data: unknown;
}

/** Els millors resultats d'un dia (per `score`, de menys a més). */
export async function fetchDayRanking(day: string): Promise<RawRow[]> {
  const { db } = await load();
  const { collection, getDocs, limit, orderBy, query } = await import('firebase/firestore/lite');
  const snap = await getDocs(query(collection(db, 'dia', day, 'resultats'), orderBy('score'), limit(RANKING_SIZE)));
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

/**
 * Les ratxes més llargues. N'hi pot haver de mortes (qui fa dies que no juga):
 * se'n demanen més i `streakRanking` les treu.
 */
export async function fetchStreakRanking(): Promise<RawRow[]> {
  const { db } = await load();
  const { collection, getDocs, limit, orderBy, query } = await import('firebase/firestore/lite');
  const snap = await getDocs(query(collection(db, 'jugadors'), orderBy('streak', 'desc'), limit(RANKING_SIZE * 3)));
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

/**
 * La teva posició al rànquing d'un dia: quants han fet millor que tu (+1) i
 * quants hi ha en total. Null si encara no hi has pujat el resultat.
 */
export async function fetchDayPlace(day: string, uid: string): Promise<{ place: number; total: number } | null> {
  const { db } = await load();
  const { collection, doc, getCount, getDoc, query, where } = await import('firebase/firestore/lite');
  const mine = await getDoc(doc(db, 'dia', day, 'resultats', uid));
  const score = mine.exists() ? (mine.data() as { score?: unknown }).score : undefined;
  if (typeof score !== 'number') return null;
  const results = collection(db, 'dia', day, 'resultats');
  const [better, total] = await Promise.all([
    getCount(query(results, where('score', '<', score))),
    getCount(results),
  ]);
  return { place: better.data().count + 1, total: total.data().count };
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
