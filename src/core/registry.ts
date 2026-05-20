import type { WidgetInstance } from './types';

let nextId = 0;
const instances = new Map<number, WidgetInstance>();

/** Reserve a new instance id. */
export function register(): number {
  return ++nextId;
}

/** Store a fully-constructed instance under its id. */
export function store(instance: WidgetInstance): void {
  instances.set(instance.id, instance);
}

export function get(id: number): WidgetInstance | undefined {
  return instances.get(id);
}

export function unregister(id: number): void {
  instances.delete(id);
}

/** Destroy and remove all instances (used in tests and full teardown). */
export function destroyAll(): void {
  for (const inst of instances.values()) inst.destroy();
  instances.clear();
  nextId = 0;
}
