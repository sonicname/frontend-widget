import { describe, it, expect, beforeEach } from 'vitest';
import { register, unregister, get, destroyAll, store } from '../../src/core/registry';
import type { WidgetInstance } from '../../src/core/types';

function fakeInstance(id: number): WidgetInstance {
  return { id, update() {}, destroy() {} };
}

describe('registry', () => {
  beforeEach(() => destroyAll());

  it('assigns incrementing ids and retrieves instances', () => {
    const a = fakeInstance(register());
    const b = fakeInstance(register());
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    store(a); store(b);
    expect(get(a.id)).toBe(a);
  });

  it('unregister removes the instance', () => {
    const id = register();
    store(fakeInstance(id));
    unregister(id);
    expect(get(id)).toBeUndefined();
  });

  it('destroyAll calls destroy on every instance and clears', () => {
    let calls = 0;
    const id = register();
    store({ id, update() {}, destroy() { calls++; } });
    destroyAll();
    expect(calls).toBe(1);
    expect(get(id)).toBeUndefined();
  });
});
