/**
 * La feina de servidor de la partida del dia, que llança la tasca programada
 * `.github/workflows/jugadors-automatics.yml` 4 cops al dia:
 *
 * - `--jugadors`: els jugadors automàtics (jugadors.json) publiquen el
 *   resultat del dia, si ja ha arribat la seva hora. Amb `--ultima`, tots els
 *   que falten (és l'última execució del dia per a ells).
 * - `--classificacio`: la fotografia de la classificació d'avui
 *   (`classificacio/{dia}`).
 * - `--tanca-ahir`: la fotografia final d'ahir.
 *
 *   npx tsx publica.ts --jugadors --classificacio --tanca-ahir
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
  botPublication,
  playDaily,
  type BotConfig,
} from '../../apps/web/src/bots/automatic';
import { parsePlayerEntry } from '../../apps/web/src/cloud/ranking';
import { buildSnapshot } from '../../apps/web/src/cloud/snapshot';
import { dayKey, isDayKey, previousDay } from '../../apps/web/src/dia/daily';

const here = dirname(fileURLToPath(import.meta.url));
const bots = JSON.parse(readFileSync(join(here, 'jugadors.json'), 'utf8')) as BotConfig[];

const args = process.argv.slice(2);
const dryRun = args.includes('--prova');
const now = args.includes('--ara') || args.includes('--ultima');
const doBots = args.includes('--jugadors');
const doSnapshot = args.includes('--classificacio');
const doCloseYesterday = args.includes('--tanca-ahir');
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

    const result = playDaily(day, plan.rating, bot.uid);
    const { entry, player } = botPublication(bot, result, previous);
    const summary = result.won
      ? `guanya en ${result.moves} jugades (rivals +${result.rivals})`
      : `perd amb ${result.points} punts a la mà`;
    console.log(`- ${tag}: força ${plan.rating}, ${summary}, ratxa ${player.streak}.`);

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

async function main(): Promise<void> {
  console.log(`Partida del dia ${day} · ara són les ${hhmm(minute)} a Barcelona${dryRun ? ' · PROVA (no escriu res)' : ''}`);
  if (!doBots && !doSnapshot && !doCloseYesterday) {
    console.log('Res a fer: indica --jugadors, --classificacio o --tanca-ahir.');
    return;
  }
  if (doCloseYesterday) await snapshot(previousDay(day), true);
  if (doBots) await publishBots();
  if (doSnapshot) await snapshot(day, false);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
