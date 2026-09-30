// Excerpt from the Stack & Wrap source (src/render/StackRenderer.ts), shown for portfolio purposes.
// Not runnable on its own: the rest of the game is not published.
// (c) 2026 Sterium AI. All rights reserved.

import * as THREE from 'three';
import type { ResourceId } from '../config/gameConfig';
import { ResourceVisualPool, type ResourceVisualInstance } from './ResourceVisualPool';
import { RESOURCE_VISUAL_DEFINITIONS, type StackProfile } from './ResourceVisualDefinitions';

export type StackOptions = Partial<Pick<StackProfile, 'columns' | 'unitSize' | 'rowGap' | 'layerGap' | 'layout' | 'rotationStep'>> & {
  maxVisualItems?: number;
  compressedScale?: number;
};

/**
 * Draws a pile of one resource at an anchor. The logical amount is exact; at most
 * `maxVisualItems` meshes are shown, and beyond that the pile is scaled up instead
 * so that very large stacks stay cheap to render.
 */
export class StackRenderer {
  private readonly objects: ResourceVisualInstance[] = [];
  private resource: ResourceId = 'box';
  private profile: StackProfile;
  private readonly optionOverrides: StackOptions;
  private readonly worldTopTmp = new THREE.Vector3();
  private logicalAmount = 0;
  private readonly maxVisualItems: number;
  private readonly compressedScale: number;

  constructor(
    private readonly pool: ResourceVisualPool,
    private readonly origin: THREE.Object3D,
    options: StackOptions = {},
  ) {
    const { maxVisualItems: _maxVisualItems, compressedScale: _compressedScale, ...profileOptions } = options;
    this.optionOverrides = profileOptions;
    this.profile = { ...RESOURCE_VISUAL_DEFINITIONS[this.resource].stackProfile, ...profileOptions };
    this.maxVisualItems = Math.max(1, Math.floor(options.maxVisualItems ?? 24));
    this.compressedScale = Math.max(0, options.compressedScale ?? 0.16);
  }

  setResource(resource: ResourceId): void {
    if (this.resource === resource) return;
    this.resource = resource;
    this.profile = { ...RESOURCE_VISUAL_DEFINITIONS[resource].stackProfile, ...this.optionOverrides };
    const amount = this.logicalAmount;
    this.setAmount(0, false);
    this.setAmount(amount, false);
  }

  setAmount(amount: number, animated = true): void {
    this.logicalAmount = Math.max(0, Math.floor(amount));
    const visualTarget = Math.min(this.logicalAmount, this.maxVisualItems);
    while (this.objects.length > visualTarget) this.pool.release(this.objects.pop()!);
    while (this.objects.length < visualTarget) {
      const object = this.pool.get(this.resource);
      this.origin.add(object);
      this.objects.push(object);
      if (animated) object.scale.setScalar(0.15);
    }
    this.refreshPositions();
  }

  refreshPositions(): void {
    const overflow = Math.max(0, this.logicalAmount - this.objects.length);
    this.objects.forEach((object, i) => {
      object.position.copy(this.getStackPosition(i));
      object.rotation.set(0, this.rotationFor(i), 0);
      const layerBoost = this.objects.length > 0 ? i / this.objects.length : 0;
      const scale = 1 + Math.min(1.35, overflow * this.compressedScale) + layerBoost * Math.min(0.28, overflow * 0.025);
      object.scale.setScalar(scale);
    });
  }

  getWorldTopPosition(): THREE.Vector3 {
    if (this.objects.length === 0) return this.origin.getWorldPosition(this.worldTopTmp).clone().add(new THREE.Vector3(0, 0.45, 0));
    return this.objects[this.objects.length - 1].getWorldPosition(this.worldTopTmp).clone().add(new THREE.Vector3(0, 0.35, 0));
  }

  getStackPosition(index: number): THREE.Vector3 {
    const { columns, unitSize, rowGap, layerGap, layout } = this.profile;
    if (layout === 'vertical') return new THREE.Vector3(0, index * (unitSize.y + layerGap) + unitSize.y / 2, 0);
    if (layout === 'flat') {
      const col = index % columns;
      const layer = Math.floor(index / columns);
      return new THREE.Vector3((col - (columns - 1) / 2) * (unitSize.x + rowGap), layer * (unitSize.y + layerGap) + unitSize.y / 2, 0);
    }
    if (layout === 'alternating-horizontal') {
      const layer = Math.floor(index / columns);
      const col = index % columns;
      return new THREE.Vector3((col - (columns - 1) / 2) * (unitSize.x + rowGap), layer * (unitSize.y + layerGap) + unitSize.y / 2, (layer % 2) * 0.08);
    }
    const perLayer = columns * columns;
    const layer = Math.floor(index / perLayer);
    const inLayer = index % perLayer;
    const col = inLayer % columns;
    const row = Math.floor(inLayer / columns);
    return new THREE.Vector3(
      (col - (columns - 1) / 2) * (unitSize.x + rowGap),
      layer * (unitSize.y + layerGap) + unitSize.y / 2,
      (row - (columns - 1) / 2) * (unitSize.z + rowGap),
    );
  }

  private rotationFor(index: number): number {
    if (this.profile.layout === 'alternating-horizontal') return (index % 2) * Math.PI / 2;
    return ((index % 3) - 1) * (this.profile.rotationStep ?? 0.08);
  }

  get visualAmount(): number { return this.objects.length; }
  get amount(): number { return this.logicalAmount; }
}
