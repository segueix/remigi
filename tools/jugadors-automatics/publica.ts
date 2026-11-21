/**
 * Publica el resultat del dia dels jugadors automàtics (jugadors.json) al
 * rànquing de la partida del dia. El llança la tasca programada
 * `.github/workflows/jugadors-automatics.yml` cada mitja hora entre les 8 h i
 * les 12 h de Barcelona; cada jugador publica quan arriba la seva hora del dia.
 *
 *   npx tsx publica.ts            publica qui li toqui ara
 *   npx tsx publica.ts --prova    no escriu res: només diu què faria
 *   npx tsx publica.ts --ara      no espera l'hora de cada jugador
 *   npx tsx publica.ts --dia=2026-11-22
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
import { dayKey, isDayKey } from '../../apps/web/src/dia/daily';

const here = dirname(fileURLToPath(import.meta.url));
const bots = JSON.parse(readFileSync(join(here, 'jugadors.json'), 'utf8')) as BotConfig[];

const args = process.argv.slice(2);
const dryRun = args.includes('--prova');
const now = args.includes('--ara');
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

async function main(): Promise<void> {
  console.log(`Partida del dia ${day} · ara són les ${hhmm(minute)} a Barcelona${dryRun ? ' · PROVA (no escriu res)' : ''}`);
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

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
