import { clamp, formatDate } from './utils';

// ============ CONSTANTS ============
export const C = {
  playerRadius: 0.45,
  corridorX: [-5.0, 5.0] as [number, number],
  corridorY: [-3.2, 3.2] as [number, number],
  baseSpeed: 28,
  maxSpeed: 80,
  meteorRadiusMin: 0.6,
  meteorRadiusMax: 2.2,
  nearMissMultiplier: 2.2,
  grazeThickness: 0.6,
  startingShields: 2,
  distanceScorePerSec: 10,
  nearMissScore: 50,
  gapSkipScore: 150,
  grazeScoreTick: 5,
  pickupScore: 25,
  boostMax: 100,
  nearMissBoost: 8,
  gapSkipBoost: 25,
  grazeTickBoost: 2,
  pickupBoost: 5,
  boostDuration: 2.5,
  boostSpeedMult: 1.4,
  magnetBaseRadius: 3.0,
  spawnZ: -150,
  despawnZ: 15,
  invulnTime: 1.5,
  grazeTickInterval: 0.08,
  meteorPoolSize: 200,
  pickupPoolSize: 80,
  particlePoolSize: 200,
  floatingTextPoolSize: 20,
  maxComboMultiplier: 10,
  comboPerMultiplier: 8,
  safeGapWidth: 3.0,
  cameraOffset: { x: 0, y: 2.2, z: 8 },
  cameraLookOffset: { x: 0, y: 0.5, z: -10 },
  cameraSmoothing: 5.0,
  steeringResponse: 8.0,
  upgradeCosts: [100, 250, 500, 900, 1500],
  maxUpgradeLevel: 5,
} as const;

// ============ EVENT BUS ============
export type GameEvent =
  | 'nearMiss' | 'gapSkip' | 'graze' | 'pickupCollected'
  | 'shieldLost' | 'playerCrashed' | 'boostActivated' | 'boostEnded'
  | 'multiplierChanged' | 'scoreChanged' | 'runStarted' | 'runEnded'
  | 'missionCompleted' | 'newPersonalBest' | 'comboChanged'
  | 'stardustEarned' | 'floatingText' | 'screenShake' | 'slowMotion'
  | 'stateChanged' | 'registerGapTrigger';

type EventCallback = (...args: any[]) => void;

class EventBusImpl {
  private listeners: Map<GameEvent, Set<EventCallback>> = new Map();

  on(event: GameEvent, cb: EventCallback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
  }

  off(event: GameEvent, cb: EventCallback) {
    this.listeners.get(event)?.delete(cb);
  }

  emit(event: GameEvent, ...args: any[]) {
    this.listeners.get(event)?.forEach(cb => cb(...args));
  }

  clear() {
    this.listeners.clear();
  }
}

export const eventBus = new EventBusImpl();

// ============ SEEDED RANDOM ============
export class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (this.seed >>> 0) / 0xFFFFFFFF;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
  static fromString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }
}

// ============ SAVE SYSTEM ============
export interface SaveData {
  version: number;
  bestScore: number;
  lastScore: number;
  bestDistance: number;
  bestCombo: number;
  totalRuns: number;
  totalDistance: number;
  totalNearMisses: number;
  totalGapSkips: number;
  totalShards: number;
  stardust: number;
  selectedShipId: string;
  unlockedShips: string[];
  upgradeLevels: {
    shieldCapacity: number;
    magnet: number;
    boostEfficiency: number;
    handling: number;
    scoreCore: number;
    grazeStabilizer: number;
  };
  missions: Record<string, { progress: number; completed: boolean; claimed: boolean }>;
  dailyChallenge: { date: string; bestScore: number };
  settings: { muted: boolean; reducedEffects: boolean };
}

const SAVE_KEY = 'void-skimmer-save-v1';

function defaultSave(): SaveData {
  return {
    version: 1,
    bestScore: 0,
    lastScore: 0,
    bestDistance: 0,
    bestCombo: 0,
    totalRuns: 0,
    totalDistance: 0,
    totalNearMisses: 0,
    totalGapSkips: 0,
    totalShards: 0,
    stardust: 0,
    selectedShipId: 'starter',
    unlockedShips: ['starter'],
    upgradeLevels: { shieldCapacity: 0, magnet: 0, boostEfficiency: 0, handling: 0, scoreCore: 0, grazeStabilizer: 0 },
    missions: {},
    dailyChallenge: { date: '', bestScore: 0 },
    settings: { muted: false, reducedEffects: false },
  };
}

let memorySave: SaveData | null = null;
let storageAvailable = true;

try {
  localStorage.setItem('__test', '1');
  localStorage.removeItem('__test');
} catch {
  storageAvailable = false;
}

export function loadSave(): SaveData {
  try {
    if (!storageAvailable) {
      if (!memorySave) memorySave = defaultSave();
      return { ...memorySave };
    }
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw) as Partial<SaveData>;
    const def = defaultSave();
    return { ...def, ...data, upgradeLevels: { ...def.upgradeLevels, ...data.upgradeLevels }, settings: { ...def.settings, ...data.settings }, dailyChallenge: { ...def.dailyChallenge, ...data.dailyChallenge } };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData) {
  try {
    if (!storageAvailable) { memorySave = { ...data }; return; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

// ============ GAME STATE ============
export type GameStateType = 'MainMenu' | 'Running' | 'Paused' | 'GameOver' | 'Hangar' | 'Upgrades' | 'Missions' | 'DailyChallenge';

export const GameState = {
  current: 'MainMenu' as GameStateType,
  set(state: GameStateType) {
    this.current = state;
    eventBus.emit('stateChanged', state);
  }
};

// ============ SHIP DEFINITIONS ============
export interface ShipDef {
  id: string;
  name: string;
  cost: number;
  handling: number;
  bodyColor: string;
  accentColor: string;
  trailColor: string;
  scale: number;
}

export const SHIPS: ShipDef[] = [
  { id: 'starter', name: 'Starter Skimmer', cost: 0, handling: 1.0, bodyColor: '#4488ff', accentColor: '#88ccff', trailColor: '#4488ff', scale: 1.0 },
  { id: 'comet', name: 'Comet Wing', cost: 500, handling: 0.85, bodyColor: '#ff6644', accentColor: '#ffaa44', trailColor: '#ff6644', scale: 1.05 },
  { id: 'razor', name: 'Void Razor', cost: 1200, handling: 1.2, bodyColor: '#aa44ff', accentColor: '#ff44aa', trailColor: '#aa44ff', scale: 0.95 },
];

// ============ MISSION DEFINITIONS ============
export interface MissionDef {
  id: string;
  description: string;
  target: number;
  rewardStardust: number;
  type: 'surviveTime' | 'nearMisses' | 'gapSkips' | 'totalShards' | 'reachMultiplier' | 'totalRuns';
}

export const MISSIONS: MissionDef[] = [
  { id: 'survive30', description: 'Survive 30 seconds', target: 30, rewardStardust: 50, type: 'surviveTime' },
  { id: 'nearMiss10', description: '10 near-misses in one run', target: 10, rewardStardust: 75, type: 'nearMisses' },
  { id: 'gapSkip5', description: '5 gap skips in one run', target: 5, rewardStardust: 100, type: 'gapSkips' },
  { id: 'collect100', description: 'Collect 100 total shards', target: 100, rewardStardust: 60, type: 'totalShards' },
  { id: 'multiplier5', description: 'Reach x5 multiplier', target: 5, rewardStardust: 80, type: 'reachMultiplier' },
  { id: 'runs5', description: 'Complete 5 runs', target: 5, rewardStardust: 40, type: 'totalRuns' },
];

// ============ UPGRADE DEFINITIONS ============
export interface UpgradeDef {
  id: keyof SaveData['upgradeLevels'];
  name: string;
  description: (level: number) => string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'shieldCapacity', name: 'Shield Capacity', description: (l) => `Start with ${1 + l + 1} shields (max 3)` },
  { id: 'magnet', name: 'Magnet Range', description: (l) => `Attraction radius: ${(C.magnetBaseRadius + (l + 1) * 0.8).toFixed(1)}` },
  { id: 'boostEfficiency', name: 'Boost Duration', description: (l) => `Boost lasts ${2.5 + (l + 1) * 0.4}s` },
  { id: 'handling', name: 'Handling', description: (l) => `Steering response: ${(C.steeringResponse + (l + 1) * 1.2).toFixed(1)}` },
  { id: 'scoreCore', name: 'Score Core', description: (l) => `+${((l + 1) * 4)}% score bonus` },
  { id: 'grazeStabilizer', name: 'Graze Stabilizer', description: (l) => `+${((l + 1) * 15)}% graze reward` },
];

// ============ DAILY CHALLENGE ============
export function getDailySeed(): string {
  return 'VOID-SKIMMER-' + formatDate();
}
