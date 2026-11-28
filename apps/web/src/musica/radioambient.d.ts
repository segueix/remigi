/* Tipus de `radioambient.js` (còpia d'El Tauler): només el que fa servir Remigi. */

/** `fanfarria`, `rumba` i `funk` estan retirats: no se'n componen de noves, però les desades sonen. */
export type JingleStyle = 'fanfarria' | 'galop' | 'rumba' | 'funk' | 'himne' | 'ska' | 'rocksteady' | 'dostons';

/** Una secció de la forma (versió 2): «I» és la introducció. */
export interface JingleSection {
  letter: string;
  prime: number;
  start: number;
  bars: number;
  shift: number;
  texture: 'intro' | 'ple' | 'pausa' | 'crescendo';
  lead: string;
}

/** Una peça composta: la mateixa llavor i el mateix estil donen la mateixa peça. */
export interface JingleSpec {
  style: JingleStyle;
  seed: number;
  loop: boolean;
  /** Durada en segons (dels bucles, 32 si no se n'ha triat cap altra). */
  seconds?: number;
  /** 2: composta amb el generador d'estructures; sense, la versió 1 (forma fixa). */
  v?: 2;
  /** Versió 2: la forma (`canco`, `rondo`…), el seu nom i les lletres («intro · A A′ B A»). */
  form?: string;
  formName?: string;
  formLabel?: string;
  sections?: JingleSection[];
  tonic: number;
  mode: string;
  beat: number;
  keyName: string;
  leadName: string;
  degrees: number[];
  melody: unknown[];
  patterns: unknown[];
}

export interface JinglePlayer {
  supported(): boolean;
  /** Comença a sonar (en bucle si la peça ho és); `true` si ha començat. */
  play(
    spec: JingleSpec,
    opts: { volume: number; startedAt?: () => number; onEnded?: () => void },
  ): Promise<boolean>;
  stop(fade?: boolean): void;
  pause(): void;
  resume(): void;
  playing(): JingleStyle | null;
  current(): JingleSpec | null;
  dispose(): void;
}

export interface Lame {
  Mp3Encoder: new (channels: number, rate: number, kbps: number) => unknown;
}

export interface RadioAmbient {
  JINGLES: readonly { id: JingleStyle; name: string; description: string }[];
  /** Estils dels quals ja no se'n componen de nous. */
  RETIRED_JINGLES: readonly JingleStyle[];
  JINGLE_SECONDS: number;
  MELODY_SECONDS: number;
  pickJingle(random?: () => number, previous?: string | null): JingleStyle;
  /** `seconds`: durada del bucle (per defecte, 32 s). Afegit a la còpia de Remigi. */
  /**
   * `seconds`: durada del bucle (per defecte, 32 s). `v: 2`: amb el generador
   * d'estructures (els estils d'ska, sempre). Afegits a la còpia de Remigi.
   */
  composeJingle(style: string, seed: number, opts?: { loop?: boolean; seconds?: number; v?: 2 }): JingleSpec;
  jingleFingerprint(spec: JingleSpec): string;
  jingleTitle(spec: JingleSpec): string;
  jingleSamples(spec: JingleSpec, sampleRate?: number, random?: () => number): Float32Array;
  createJinglePlayer(env?: Record<string, unknown>): JinglePlayer;
  isAllowed(): boolean;
  exportSamples(spec: JingleSpec, opts?: { cycles?: number; fadeSeconds?: number }): Promise<Float32Array | null>;
  encodeMp3(samples: Float32Array, lame: Lame, opts?: { kbps?: number; onProgress?(f: number): void }): Promise<Uint8Array[]>;
}

declare const api: RadioAmbient;
export default api;
