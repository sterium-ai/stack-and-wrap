// Excerpt from the Stack & Wrap source (src/systems/TransferSystem.ts), shown for portfolio purposes.
// Not runnable on its own: the rest of the game is not published.
// (c) 2026 Sterium AI. All rights reserved.

import * as THREE from 'three';
import { GAME_CONFIG, type ResourceId } from '../config/gameConfig';
import { ResourceVisualPool, type ResourceVisualInstance } from '../render/ResourceVisualPool';

/**
 * A request to move `amount` items from one point to another. Items launch one at a time,
 * `interval` seconds apart. `onLaunch` and `onArrive` fire once per item and are where the
 * caller updates its logical counters, so every hand-off is counted exactly once.
 */
export type TransferRequest = {
  from: () => THREE.Vector3;
  to: () => THREE.Vector3;
  resource?: ResourceId;
  amount?: number;
  interval?: number;
  duration?: number;
  arcHeight?: number;
  onLaunch?: () => void;
  onArrive?: () => void;
};

type PendingTransfer = TransferRequest & { remaining: number; delay: number; interval: number };

type ActiveTransfer = {
  object: ResourceVisualInstance;
  start: THREE.Vector3;
  end: THREE.Vector3;
  elapsed: number;
  duration: number;
  arcHeight: number;
  onArrive?: () => void;
};

/**
 * Animates items between world positions: cubic ease-out with a sine arc and a spin.
 * Meshes come from the shared ResourceVisualPool and are returned on arrival.
 */
export class TransferSystem {
  private readonly pending: PendingTransfer[] = [];
  private readonly active: ActiveTransfer[] = [];
  private readonly reusable = new THREE.Vector3();

  constructor(private readonly pool: ResourceVisualPool) {}

  transferItems(request: TransferRequest): void {
    const amount = Math.max(0, Math.floor(request.amount ?? 1));
    if (amount <= 0) return;
    this.pending.push({ ...request, remaining: amount, delay: 0, interval: request.interval ?? 0.06 });
  }

  update(dt: number): void {
    this.updatePending(dt);
    this.updateActive(dt);
  }

  private updatePending(dt: number): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const request = this.pending[i];
      request.delay -= dt;
      while (request.remaining > 0 && request.delay <= 0) {
        this.launch(request);
        request.remaining -= 1;
        request.delay += request.interval;
      }
      if (request.remaining <= 0) this.pending.splice(i, 1);
    }
  }

  private launch(request: TransferRequest): void {
    request.onLaunch?.();
    const object = this.pool.get(request.resource ?? 'box');
    object.position.copy(request.from());
    object.scale.setScalar(0.92);
    this.active.push({
      object,
      start: object.position.clone(),
      end: request.to(),
      elapsed: 0,
      duration: request.duration ?? GAME_CONFIG.transfer.duration,
      arcHeight: request.arcHeight ?? GAME_CONFIG.transfer.arcHeight,
      onArrive: request.onArrive,
    });
  }

  private updateActive(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const t = this.active[i];
      t.elapsed += dt;
      const p = Math.min(1, t.elapsed / t.duration);
      const e = 1 - Math.pow(1 - p, 3);
      this.reusable.lerpVectors(t.start, t.end, e);
      this.reusable.y += Math.sin(p * Math.PI) * t.arcHeight;
      t.object.position.copy(this.reusable);
      t.object.rotation.x += dt * 8;
      t.object.rotation.y += dt * 6;
      const s = 0.78 + Math.sin(p * Math.PI) * 0.28;
      t.object.scale.setScalar(s);
      if (p >= 1) {
        t.onArrive?.();
        this.pool.release(t.object);
        this.active.splice(i, 1);
      }
    }
  }

  get activeCount(): number { return this.active.length; }
  get pendingCount(): number { return this.pending.reduce((total, request) => total + request.remaining, 0); }
}
