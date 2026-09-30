// Excerpt from the Stack & Wrap source (src/systems/AutomationSystem.ts), shown for portfolio purposes.
// Not runnable on its own: the rest of the game is not published.
// (c) 2026 Sterium AI. All rights reserved.

import type { ResourceId } from '../config/gameConfig';

export type AutomationStageId = 'base.box-to-wrap' | 'base.gift-to-counter' | 'bear.raw-to-bbq' | 'bear.bbq-to-sale' | 'dino.dog-bone-fetch';
export type AutomationVisualKind = 'worker' | 'trolley' | 'ant' | 'waiter' | 'dog';

/** Seconds between helper runs: `max(min, base - (level - 1) * reductionPerLevel)`. */
export type AutomationInterval = { base: number; reductionPerLevel: number; min: number };

/**
 * One purchasable helper. Labels and descriptions document the stage; the numeric fields
 * drive cost, timing, carry capacity and walking speed. Arrays are indexed by level (index 0 = not bought).
 */
export type AutomationStageDefinition = {
  id: AutomationStageId;
  chainId: 'gift-shop' | 'bear-barbecue' | 'dinosaur-fertilizer';
  label: string;
  description: string;
  resource: ResourceId;
  costBase: number;
  costMultiplier: number;
  maxLevel: number;
  visual: AutomationVisualKind;
  fromLabel: string;
  toLabel: string;
  interval: AutomationInterval;
  /** Walking speed per level; defaults to DEFAULT_AGENT_SPEED. */
  speedByLevel?: readonly number[];
  /** Items carried per trip per level; defaults to 1. */
  capacityByLevel?: readonly number[];
};

const DEFAULT_AGENT_SPEED = 2.0;

export type AutomationStageSave = { level: number; remaining: number };
export type AutomationSaveState = Partial<Record<AutomationStageId, AutomationStageSave>>;

/** Helper state machine: idle -> toPickup -> toDelivery -> idle, waiting `cooldown` seconds while idle. */
export type AutomationAgentMode = 'idle' | 'toPickup' | 'toDelivery';

export type AutomationAgentState = {
  id: AutomationStageId;
  mode: AutomationAgentMode;
  targetIndex?: number;
  cargo: number;
  cooldown: number;
};

export type AutomationStageRuntime = {
  id: AutomationStageId;
  level: number;
  agent: AutomationAgentState;
};

export const AUTOMATION_STAGE_DEFINITIONS: Record<AutomationStageId, AutomationStageDefinition> = {
  'base.box-to-wrap': {
    id: 'base.box-to-wrap',
    chainId: 'gift-shop',
    label: 'Worker',
    description: 'Carries boxes to the gift-wrapping bench.',
    resource: 'box',
    costBase: 110,
    costMultiplier: 1.7,
    maxLevel: 5,
    visual: 'worker',
    fromLabel: 'Boxes',
    toLabel: 'Gift Wrap',
    interval: { base: 3.6, reductionPerLevel: 0.75, min: 1.6 },
  },
  'base.gift-to-counter': {
    id: 'base.gift-to-counter',
    chainId: 'gift-shop',
    label: 'Trolley',
    description: 'Carries wrapped gifts to the sales counter.',
    resource: 'gift',
    costBase: 260,
    costMultiplier: 1.75,
    maxLevel: 4,
    visual: 'trolley',
    fromLabel: 'Output',
    toLabel: 'Sale',
    interval: { base: 2.8, reductionPerLevel: 0.45, min: 0.9 },
    speedByLevel: [0, 2.28, 2.56, 2.84, 3.12],
  },
  'bear.raw-to-bbq': {
    id: 'bear.raw-to-bbq',
    chainId: 'bear-barbecue',
    label: 'Ant',
    description: 'Carries raw bear meat to the grill.',
    resource: 'bear_meat',
    costBase: 180,
    costMultiplier: 1,
    maxLevel: 1,
    visual: 'ant',
    fromLabel: 'Raw meat',
    toLabel: 'Grill',
    interval: { base: 1.35, reductionPerLevel: 0.12, min: 0.65 },
    speedByLevel: [0, 2.35],
    capacityByLevel: [0, 1],
  },
  'bear.bbq-to-sale': {
    id: 'bear.bbq-to-sale',
    chainId: 'bear-barbecue',
    label: 'Waiter',
    description: 'Serves ready BBQ to buyers.',
    resource: 'cooked_bear_meat',
    costBase: 340,
    costMultiplier: 1.85,
    maxLevel: 5,
    visual: 'waiter',
    fromLabel: 'BBQ ready',
    toLabel: 'BBQ sale',
    interval: { base: 1.35, reductionPerLevel: 0.12, min: 0.65 },
    speedByLevel: [0, 2.1, 2.45, 2.85, 3.25, 3.7],
    capacityByLevel: [0, 1, 2, 3, 4, 6],
  },
  'dino.dog-bone-fetch': {
    id: 'dino.dog-bone-fetch',
    chainId: 'dinosaur-fertilizer',
    label: 'Dog',
    description: 'Fetches dropped bones for refining.',
    resource: 'dino_bones',
    costBase: 520,
    costMultiplier: 1.8,
    maxLevel: 4,
    visual: 'dog',
    fromLabel: 'Bones',
    toLabel: 'Refine',
    interval: { base: 1.15, reductionPerLevel: 0.14, min: 0.55 },
    speedByLevel: [0, 2.57, 2.89, 3.21, 3.53],
    capacityByLevel: [0, 1, 1, 2, 2],
  },
};

export function automationStageCost(def: AutomationStageDefinition, currentLevel: number): number {
  return Math.floor(def.costBase * Math.pow(def.costMultiplier, currentLevel));
}

export function createDefaultAutomationState(): AutomationSaveState {
  const state: AutomationSaveState = {};
  for (const def of Object.values(AUTOMATION_STAGE_DEFINITIONS)) {
    state[def.id] = { level: 0, remaining: def.costBase };
  }
  return state;
}

export function normalizeAutomationState(parsed: unknown, legacyAutomationLevel = 0, legacyAutomationRemaining?: number): AutomationSaveState {
  const incoming = (parsed && typeof parsed === 'object') ? parsed as AutomationSaveState : {};
  const normalized = createDefaultAutomationState();
  for (const def of Object.values(AUTOMATION_STAGE_DEFINITIONS)) {
    const old = incoming[def.id];
    const level = Math.max(0, Math.min(def.maxLevel, Math.floor(old?.level ?? 0)));
    normalized[def.id] = {
      level,
      remaining: Math.max(0, Math.floor(old?.remaining ?? automationStageCost(def, level))),
    };
  }
  // Saves from before per-stage automation only stored one level, which belonged to the box worker.
  const boxStage = normalized['base.box-to-wrap'];
  if (boxStage && legacyAutomationLevel > boxStage.level) {
    const def = AUTOMATION_STAGE_DEFINITIONS['base.box-to-wrap'];
    const level = Math.min(def.maxLevel, Math.floor(legacyAutomationLevel));
    boxStage.level = level;
    boxStage.remaining = Math.max(0, Math.floor(legacyAutomationRemaining ?? automationStageCost(def, level)));
  }
  return normalized;
}

export function stageInterval(stageId: AutomationStageId, level: number): number {
  if (level <= 0) return Infinity;
  const { base, reductionPerLevel, min } = AUTOMATION_STAGE_DEFINITIONS[stageId].interval;
  return Math.max(min, base - (level - 1) * reductionPerLevel);
}

export function stageCapacity(stageId: AutomationStageId, level: number): number {
  if (level <= 0) return 0;
  return AUTOMATION_STAGE_DEFINITIONS[stageId].capacityByLevel?.[level] ?? 1;
}

export function stageMoveSpeed(stageId: AutomationStageId, level: number): number {
  if (level <= 0) return 0;
  return AUTOMATION_STAGE_DEFINITIONS[stageId].speedByLevel?.[level] ?? DEFAULT_AGENT_SPEED;
}

export function createAutomationRuntime(id: AutomationStageId): AutomationStageRuntime {
  return { id, level: 0, agent: { id, mode: 'idle', cargo: 0, cooldown: 0 } };
}

/** Owns per-stage purchase state (persisted) and helper runtime state (transient). */
export class AutomationSystem {
  private readonly runtimes = new Map<AutomationStageId, AutomationStageRuntime>();

  constructor(private readonly saveState: AutomationSaveState) {
    for (const id of Object.keys(AUTOMATION_STAGE_DEFINITIONS) as AutomationStageId[]) {
      this.runtimes.set(id, createAutomationRuntime(id));
    }
  }

  getStageSave(id: AutomationStageId): AutomationStageSave {
    let stage = this.saveState[id];
    if (!stage) {
      const def = AUTOMATION_STAGE_DEFINITIONS[id];
      stage = { level: 0, remaining: def.costBase };
      this.saveState[id] = stage;
    }
    return stage;
  }

  getRuntime(id: AutomationStageId): AutomationStageRuntime {
    const runtime = this.runtimes.get(id) ?? createAutomationRuntime(id);
    runtime.level = this.getStageSave(id).level;
    this.runtimes.set(id, runtime);
    return runtime;
  }

  isUnlocked(id: AutomationStageId): boolean {
    return this.getStageSave(id).level > 0;
  }

  trySpend(id: AutomationStageId, availableMoney: number, payAmount: number): { spent: number; leveledUp: boolean } {
    const def = AUTOMATION_STAGE_DEFINITIONS[id];
    const stage = this.getStageSave(id);
    if (stage.level >= def.maxLevel) return { spent: 0, leveledUp: false };
    const spent = Math.min(Math.max(0, Math.floor(availableMoney)), Math.max(0, Math.ceil(stage.remaining)), Math.max(1, Math.floor(payAmount)));
    if (spent <= 0) return { spent: 0, leveledUp: false };
    stage.remaining = Math.max(0, stage.remaining - spent);
    if (stage.remaining > 0) return { spent, leveledUp: false };
    stage.level = Math.min(def.maxLevel, stage.level + 1);
    stage.remaining = stage.level >= def.maxLevel ? 0 : automationStageCost(def, stage.level);
    this.getRuntime(id).level = stage.level;
    return { spent, leveledUp: true };
  }
}
