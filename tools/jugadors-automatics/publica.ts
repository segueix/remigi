/**
 * La feina de servidor de la partida del dia, que llança la tasca programada
 * `.github/workflows/jugadors-automatics.yml` diversos cops al dia:
 *
 * - `--auto` (el que fan totes les execucions programades): tot el que falti,
 *   segons l'hora de Barcelona i el que ja hi ha a Firestore. Les execucions
 *   programades de GitHub poden arribar hores tard o no arribar; així
 *   qualsevol execució que arribi posa al dia el que no s'ha fet, i si n'hi
 *   ha de sobra no repeteixen res:
 *   1. els jugadors automàtics que ahir havien de jugar i no van publicar;
 *   2. la classificació final d'ahir, si encara no està tancada (des de les
 *      6 h, o si el pas 1 hi ha afegit algú);
 *   3. els jugadors automàtics d'avui als quals ja ha arribat l'hora;
 *   4. la fotografia d'avui, si ja ha passat una hora de fotografia (9, 15 o
 *      22 h) i la que hi ha és d'abans;
 *   5. els rànquings de la setmana i del mes fins ahir (`setmana/{AAAA-Www}`,
 *      `mes/{AAAA-MM}`), un cop la classificació d'ahir és la final i si
 *      encara no compten fins ahir.
 *
 * I a mà, per parts:
 *
 * - `--jugadors`: els jugadors automàtics (jugadors.json) publiquen el
 *   resultat del dia, si ja ha arribat la seva hora. Amb `--ultima`, tots els
 *   que falten (és l'última execució del dia per a ells).
 * - `--classificacio`: la fotografia de la classificació d'avui
 *   (`classificacio/{dia}`).
 * - `--tanca-ahir`: la fotografia final d'ahir.
 * - `--periodes`: els rànquings de la setmana i del mes fins ahir (els refà
 *   encara que ja hi siguin).
 *
 *   npx tsx publica.ts --jugadors --classificacio --tanca-ahir --periodes
 *   npx tsx publica.ts --prova …   no escriu res: només diu què faria
 *   npx tsx publica.ts --ara …     els jugadors no esperen la seva hora
 *   npx tsx publica.ts --dia=2026-11-22 …
 *
 * Per escriure cal la variable FIREBASE_SERVICE_ACCOUNT amb el JSON de la clau
 * de servei del projecte remigi-c37ac (secret de GitHub). Vegeu
 * docs/JUGADORS-AUTOMATICS.md.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  barcelonaMinute,
  botDay,
  botPending,
  botPublication,
  playDaily,
  type BotConfig,
} from '../../apps/web/src/bots/automatic';
import { parsePlayerEntry, type PlayerEntry } from '../../apps/web/src/cloud/ranking';
import { PERIOD_KINDS, buildPeriod, periodDays, periodKey, type DayStanding } from '../../apps/web/src/cloud/period';
import { dayRanking } from '../../apps/web/src/cloud/ranking';
import { CLOSE_YESTERDAY_FROM_MINUTE, buildSnapshot, parseSnapshot, snapshotDue } from '../../apps/web/src/cloud/snapshot';
import { dayKey, isDayKey, previousDay } from '../../apps/web/src/dia/daily';

const here = dirname(fileURLToPath(import.meta.url));
const bots = JSON.parse(readFileSync(join(here, 'jugadors.json'), 'utf8')) as BotConfig[];

const args = process.argv.slice(2);
const dryRun = args.includes('--prova');
const now = args.includes('--ara') || args.includes('--ultima');
const auto = args.includes('--auto');
const doBots = args.includes('--jugadors');
const doSnapshot = args.includes('--classificacio');
const doCloseYesterday = args.includes('--tanca-ahir');
const doPeriods = args.includes('--periodes');
const dayArg = args.find((a) => a.startsWith('--dia='))?.slice('--dia='.length);
const day = dayArg && isDayKey(dayArg) ? dayArg : dayKey();
const minute = barcelonaMinute();
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

type Db = import('firebase-admin/firestore').Firestore;
let db: Db | null = null;

async function firestore(): Promise<Db> {
  if (db) return db;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT (la clau de servei de Firebase, en JSON).');
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  initializeApp({ credential: cert(JSON.parse(raw)) });
  db = getFirestore();
  return db;
}

async function publishBots(): Promise<void> {
  for (const bot of bots) {
    const plan = botDay(bot, day);
    const tag = `${bot.alias} (${bot.key})`;
    if (!plan.plays) {
      console.log(`- ${tag}: avui no juga.`);
      continue;
    }
    if (!now && minute < plan.publishAt) {
      console.log(`- ${tag}: publicarà a partir de les ${hhmm(plan.publishAt)}.`);
      continue;
    }

    let previous = null;
    if (!dryRun) {
      const store = await firestore();
      const resultRef = store.doc(`dia/${day}/resultats/${bot.uid}`);
      if ((await resultRef.get()).exists) {
        console.log(`- ${tag}: ja ha publicat avui.`);
        continue;
      }
      previous = parsePlayerEntry((await store.doc(`jugadors/${bot.uid}`).get()).data() ?? null);
    }

    const { rating } = botDay(bot, day, previous);
    const result = playDaily(day, rating, bot.uid);
    const { entry, player } = botPublication(bot, result, previous);
    const summary = result.won
      ? `guanya en ${result.moves} jugades (rivals +${result.rivals})`
      : `perd amb ${result.points} punts a la mà`;
    console.log(`- ${tag}: força ${rating}, ${summary}, ratxa ${player.streak}.`);

    if (!dryRun) {
      const store = await firestore();
      const { FieldValue } = await import('firebase-admin/firestore');
      await store.doc(`dia/${day}/resultats/${bot.uid}`).set({ ...entry, at: FieldValue.serverTimestamp() });
      await store.doc(`jugadors/${bot.uid}`).set({ ...player, at: FieldValue.serverTimestamp() });
      console.log(`  publicat.`);
    }
  }
}

/**
 * La fotografia de la classificació d'un dia: llegeix tots els resultats (una
 * lectura per jugador) i els desa en un sol document, que és el que llegeix
 * qui obre la classificació quan hi ha molts jugadors.
 */
async function snapshot(target: string, final: boolean): Promise<void> {
  if (dryRun) {
    console.log(`- Classificació ${target}${final ? ' (final)' : ''}: es faria la fotografia.`);
    return;
  }
  const store = await firestore();
  const docs = await store.collection(`dia/${target}/resultats`).get();
  const built = buildSnapshot(
    docs.docs.map((d) => ({ id: d.id, data: d.data() })),
    final,
  );
  const { FieldValue } = await import('firebase-admin/firestore');
  await store.doc(`classificacio/${target}`).set({ ...built, at: FieldValue.serverTimestamp() });
  console.log(`- Classificació ${target}${final ? ' (final)' : ''}: ${built.count} jugadors.`);
}

/**
 * La classificació final d'un dia ja passat: la fotografia (1 lectura) o, si
 * no n'hi ha cap de final, els resultats (una lectura per jugador).
 */
async function dayStanding(target: string): Promise<DayStanding> {
  const store = await firestore();
  const snap = parseSnapshot((await store.doc(`classificacio/${target}`).get()).data() ?? null, null);
  if (snap?.final) return { day: target, rows: snap.rows };
  const docs = await store.collection(`dia/${target}/resultats`).get();
  const rows = dayRanking(docs.docs.map((d) => ({ id: d.id, data: d.data() })), null).map(({ id, entry }) => ({ id, entry }));
  return { day: target, rows };
}

/**
 * Els rànquings de la setmana i del mes que contenen `until`, comptant fins a
 * `until` (inclòs). Sense `force`, només si encara no compten fins aquell dia.
 */
async function periods(until: string, force: boolean): Promise<void> {
  const standings = new Map<string, DayStanding>();
  for (const kind of PERIOD_KINDS) {
    const path = `${kind}/${periodKey(kind, until)}`;
    if (dryRun) {
      console.log(`- Rànquing ${path}: es refaria fins al ${until} si no hi arriba.`);
      continue;
    }
    const store = await firestore();
    if (!force && (await store.doc(path).get()).data()?.until === until) {
      console.log(`- Rànquing ${path}: ja compta fins al ${until}.`);
      continue;
    }
    const days = periodDays(kind, until).filter((d) => d <= until);
    for (const d of days) if (!standings.has(d)) standings.set(d, await dayStanding(d));
    const built = buildPeriod(kind, until, days.map((d) => standings.get(d)!));
    const { FieldValue } = await import('firebase-admin/firestore');
    await store.doc(path).set({ ...built, at: FieldValue.serverTimestamp() });
    console.log(`- Rànquing ${path}${built.final ? ' (final)' : ''}: ${days.length} dies, ${built.count} jugadors.`);
  }
}

/** Ms des de 1970 d'un camp `at` de Firestore (Timestamp), o null. */
function millisOf(value: unknown): number | null {
  const at = value as { toMillis?: () => number } | undefined;
  return at && typeof at.toMillis === 'function' ? at.toMillis() : null;
}

/** Publica el resultat d'un jugador automàtic d'un dia; torna la fitxa nova. */
async function publishBotDay(bot: BotConfig, target: string, previous: PlayerEntry | null): Promise<PlayerEntry | null> {
  const tag = `${bot.alias} (${bot.key}) · ${target}`;
  const plan = botDay(bot, target, previous);
  if (!dryRun) {
    const store = await firestore();
    if ((await store.doc(`dia/${target}/resultats/${bot.uid}`).get()).exists) {
      console.log(`- ${tag}: ja hi havia el resultat.`);
      return previous;
    }
  }
  const result = playDaily(target, plan.rating, bot.uid);
  const { entry, player } = botPublication(bot, result, previous);
  const summary = result.won
    ? `guanya en ${result.moves} jugades (rivals +${result.rivals})`
    : `perd amb ${result.points} punts a la mà`;
  console.log(`- ${tag}: força ${plan.rating}, ${summary}, ratxa ${player.streak}.`);
  if (dryRun) return player;
  const store = await firestore();
  const { FieldValue } = await import('firebase-admin/firestore');
  await store.doc(`dia/${target}/resultats/${bot.uid}`).set({ ...entry, at: FieldValue.serverTimestamp() });
  await store.doc(`jugadors/${bot.uid}`).set({ ...player, at: FieldValue.serverTimestamp() });
  console.log('  publicat.');
  return player;
}

/** Tot el que falti (vegeu la capçalera). */
async function runAuto(): Promise<void> {
  const yesterday = previousDay(day);
  let lateYesterday = false;

  // 1 i 3: jugadors automàtics, primer ahir (si va quedar pendent) i després avui.
  const todo: { bot: BotConfig; previous: PlayerEntry | null; pending: { yesterday: boolean; today: boolean } }[] = [];
  for (const bot of bots) {
    let previous: PlayerEntry | null = null;
    if (!dryRun) {
      const store = await firestore();
      previous = parsePlayerEntry((await store.doc(`jugadors/${bot.uid}`).get()).data() ?? null);
    }
    const pending = botPending(bot, day, minute, previous, now);
    const plan = botDay(bot, day);
    if (!pending.yesterday && !pending.today) {
      const why = !plan.plays
        ? 'avui no juga'
        : previous?.lastDay === day
          ? 'ja ha publicat avui'
          : `publicarà a partir de les ${hhmm(plan.publishAt)}`;
      console.log(`- ${bot.alias} (${bot.key}): ${why}.`);
    }
    todo.push({ bot, previous, pending });
  }
  for (const item of todo) {
    if (item.pending.yesterday) {
      item.previous = await publishBotDay(item.bot, yesterday, item.previous);
      lateYesterday = true;
    }
  }

  // 2: la classificació final d'ahir.
  let yesterdayClosed = false;
  if (dryRun) {
    if (lateYesterday || minute >= CLOSE_YESTERDAY_FROM_MINUTE) console.log(`- Classificació ${yesterday}: es tancaria si no ho està.`);
  } else {
    const store = await firestore();
    const closed = (await store.doc(`classificacio/${yesterday}`).get()).data()?.final === true;
    if (lateYesterday || (!closed && minute >= CLOSE_YESTERDAY_FROM_MINUTE)) {
      await snapshot(yesterday, true);
      yesterdayClosed = true;
    } else if (closed) {
      console.log(`- Classificació ${yesterday}: ja és la final.`);
      yesterdayClosed = true;
    }
  }

  // 5 (aquí, perquè només depèn d'ahir): la setmana i el mes fins ahir.
  // Si ahir s'hi ha afegit algun jugador automàtic tard, es refan.
  if (dryRun || yesterdayClosed) await periods(yesterday, lateYesterday);

  for (const item of todo) {
    if (item.pending.today) await publishBotDay(item.bot, day, item.previous);
  }

  // 4: la fotografia d'avui, si en toca una.
  const nowMs = Date.now();
  const dayStartMs = nowMs - minute * 60_000 - (nowMs % 60_000);
  if (dryRun) {
    console.log(`- Classificació ${day}: ${snapshotDue(null, nowMs, dayStartMs) ? 'es faria la fotografia si la que hi ha és d’abans de l’última hora' : 'encara no toca cap fotografia'}.`);
    return;
  }
  const store = await firestore();
  const lastAt = millisOf((await store.doc(`classificacio/${day}`).get()).data()?.at);
  if (snapshotDue(lastAt, nowMs, dayStartMs)) await snapshot(day, false);
  else console.log(`- Classificació ${day}: no toca cap fotografia nova.`);
}

async function main(): Promise<void> {
  console.log(`Partida del dia ${day} · ara són les ${hhmm(minute)} a Barcelona${dryRun ? ' · PROVA (no escriu res)' : ''}`);
  if (auto) {
    await runAuto();
    return;
  }
  if (!doBots && !doSnapshot && !doCloseYesterday && !doPeriods) {
    console.log('Res a fer: indica --auto, --jugadors, --classificacio, --tanca-ahir o --periodes.');
    return;
  }
  if (doCloseYesterday) await snapshot(previousDay(day), true);
  if (doPeriods) await periods(previousDay(day), true);
  if (doBots) await publishBots();
  if (doSnapshot) await snapshot(day, false);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
