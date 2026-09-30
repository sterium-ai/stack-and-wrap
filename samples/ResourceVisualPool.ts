// Excerpt from the Stack & Wrap source (src/render/ResourceVisualPool.ts), shown for portfolio purposes.
// Not runnable on its own: the rest of the game is not published.
// (c) 2026 Sterium AI. All rights reserved.

import * as THREE from 'three';
import type { ResourceId } from '../config/gameConfig';
import { RESOURCE_VISUAL_DEFINITIONS } from './ResourceVisualDefinitions';

export type ResourceVisualInstance = THREE.Object3D & { userData: { resourceId?: ResourceId; visualKey?: string } };

/**
 * Pre-built item meshes, bucketed by visual key and recycled instead of allocated during play,
 * so moving and stacking items does not allocate new objects in the frame loop.
 */
export class ResourceVisualPool {
  private readonly freeByVisual = new Map<string, ResourceVisualInstance[]>();
  private readonly used = new Set<ResourceVisualInstance>();

  constructor(private readonly scene: THREE.Scene, initialSize = 80) {
    for (let i = 0; i < initialSize; i++) this.release(this.createInstance('box'));
  }

  private createInstance(resource: ResourceId): ResourceVisualInstance {
    const definition = RESOURCE_VISUAL_DEFINITIONS[resource];
    const object = definition.create() as ResourceVisualInstance;
    object.userData.resourceId = resource;
    object.userData.visualKey = definition.visualKey;
    object.visible = false;
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.scene.add(object);
    return object;
  }

  get(resource: ResourceId = 'box'): ResourceVisualInstance {
    const definition = RESOURCE_VISUAL_DEFINITIONS[resource];
    const bucket = this.freeByVisual.get(definition.visualKey);
    const object = bucket?.pop() ?? this.createInstance(resource);
    object.userData.resourceId = resource;
    object.userData.visualKey = definition.visualKey;
    object.visible = true;
    object.position.set(0, 0, 0);
    object.scale.setScalar(1);
    object.rotation.set(0, 0, 0);
    this.scene.add(object);
    this.used.add(object);
    return object;
  }

  release(object: ResourceVisualInstance): void {
    this.used.delete(object);
    object.visible = false;
    object.position.set(0, -99, 0);
    object.scale.setScalar(1);
    object.rotation.set(0, 0, 0);
    this.scene.add(object);
    const key = object.userData.visualKey ?? 'unknown';
    const bucket = this.freeByVisual.get(key) ?? [];
    bucket.push(object);
    this.freeByVisual.set(key, bucket);
  }

  get usedCount(): number { return this.used.size; }
}
