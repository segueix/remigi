/* Tipus de `radioambient.js` (còpia d'El Tauler): només el que fa servir Remigi. */

export type JingleStyle = 'fanfarria' | 'galop' | 'rumba' | 'funk' | 'himne';

/** Una peça composta: la mateixa llavor i el mateix estil donen la mateixa peça. */
export interface JingleSpec {
  style: JingleStyle;
  seed: number;
  loop: boolean;
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
  JINGLE_SECONDS: number;
  MELODY_SECONDS: number;
  pickJingle(random?: () => number, previous?: string | null): JingleStyle;
  composeJingle(style: string, seed: number, opts?: { loop?: boolean }): JingleSpec;
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
