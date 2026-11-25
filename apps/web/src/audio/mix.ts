/*
 * The master and per-channel volumes: a Tone-free store, so the mixer UI can live in the entry
 * chunk without pulling Tone.js in with it (rule 12: only the lazy `engine.ts` chunk loads Tone).
 * `band.ts` and `engine.ts` subscribe and apply the values to their Tone nodes once audio has loaded.
 */

const MASTER_VOL_KEY = "reharm.masterVolume";
const CHANNEL_VOL_KEY = "reharm.channelVolumes";
const masterVolSubs = new Set<() => void>();
const channelVolSubs = new Set<() => void>();

export type ChannelId = "playerPiano" | "bgPiano" | "bass" | "drums";
export type ChannelVolumes = Readonly<Record<ChannelId, number>>;

const clampDb = (db: number) => (Number.isFinite(db) ? Math.max(-24, Math.min(12, Math.round(db * 2) / 2)) : 0);
/** Your keys and the Ghost Master sit +6 dB over the band by default, so what you play reads clearly. */
export const DEFAULT_CHANNEL_VOLUMES: ChannelVolumes = { playerPiano: 6, bgPiano: 0, bass: 0, drums: 0 };
const SILENT_DEFAULTS = DEFAULT_CHANNEL_VOLUMES;

let masterVolumeDb = (() => {
  try {
    const raw = localStorage.getItem(MASTER_VOL_KEY);
    return raw !== null ? clampDb(Number(raw)) : 0;
  } catch {
    return 0;
  }
})();

let channelVolumes: ChannelVolumes = (() => {
  try {
    const raw = localStorage.getItem(CHANNEL_VOL_KEY);
    if (!raw) return SILENT_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Record<ChannelId, number>>;
    return {
      playerPiano: clampDb(parsed.playerPiano ?? DEFAULT_CHANNEL_VOLUMES.playerPiano),
      bgPiano: clampDb(parsed.bgPiano ?? 0),
      bass: clampDb(parsed.bass ?? 0),
      drums: clampDb(parsed.drums ?? 0),
    };
  } catch {
    return SILENT_DEFAULTS;
  }
})();

export function getMasterVolume(): number {
  return masterVolumeDb;
}

export function setMasterVolume(db: number): void {
  masterVolumeDb = clampDb(db);
  try {
    localStorage.setItem(MASTER_VOL_KEY, String(masterVolumeDb));
  } catch {
    /* private mode */
  }
  masterVolSubs.forEach((fn) => fn());
}

export function subscribeMasterVolume(fn: () => void): () => void {
  masterVolSubs.add(fn);
  return () => void masterVolSubs.delete(fn);
}

export function getChannelVolumes(): ChannelVolumes {
  return channelVolumes;
}

function saveChannels(): void {
  try {
    localStorage.setItem(CHANNEL_VOL_KEY, JSON.stringify(channelVolumes));
  } catch {
    /* private mode */
  }
  channelVolSubs.forEach((fn) => fn());
}

export function setChannelVolume(channel: ChannelId, db: number): void {
  const next = clampDb(db);
  if (channelVolumes[channel] === next) return;
  channelVolumes = { ...channelVolumes, [channel]: next };
  saveChannels();
}

export function resetChannelVolumes(): void {
  channelVolumes = SILENT_DEFAULTS;
  saveChannels();
}

export function subscribeChannelVolumes(fn: () => void): () => void {
  channelVolSubs.add(fn);
  return () => void channelVolSubs.delete(fn);
}

export const getPlayerPianoVolume = () => channelVolumes.playerPiano;
export const setPlayerPianoVolume = (db: number) => setChannelVolume("playerPiano", db);

export const getBgPianoVolume = () => channelVolumes.bgPiano;
export const setBgPianoVolume = (db: number) => setChannelVolume("bgPiano", db);

export const getPianoVolume = () => channelVolumes.bgPiano;
export const setPianoVolume = (db: number) => setChannelVolume("bgPiano", db);

export const getBassVolume = () => channelVolumes.bass;
export const setBassVolume = (db: number) => setChannelVolume("bass", db);

export const getDrumsVolume = () => channelVolumes.drums;
export const setDrumsVolume = (db: number) => setChannelVolume("drums", db);
