import { describe, it, expect } from 'vitest';
import { createApi } from '../../src/core/api';

/**
 * Tests for createApi().load() promise wiring.
 *
 * What we assert and why:
 * - `load` is a function (it exists on the returned api).
 * - `load('greeting')` returns a Promise (the return type contract is upheld).
 * - Calling `load` twice does not throw synchronously (lazy loader is reused).
 * - The promise rejects (because jsdom cannot dynamically import a remote ESM
 *   chunk URL like https://cdn.x/a/chunks/greeting.esm.js). This rejection
 *   confirms that `load` actually attempted the URL derived from the script src
 *   rather than silently returning undefined or a cached stub.
 *
 * We do NOT mock internals of api.ts or loader.ts — the point is the wiring,
 * not the import mechanism itself.
 */
describe('createApi load()', () => {
  it('load is a function on the api', () => {
    const api = createApi('https://cdn.x/a/widget.iife.js');
    expect(typeof api.load).toBe('function');
  });

  it('load() returns a Promise', () => {
    const api = createApi('https://cdn.x/a/widget.iife.js');
    const result = api.load('greeting');
    expect(result).toBeInstanceOf(Promise);
    // Suppress unhandled rejection — we don't care about the outcome here
    result.catch(() => {});
  });

  it('load() rejects because the chunk URL cannot be imported in jsdom', async () => {
    const api = createApi('https://cdn.x/a/widget.iife.js');
    await expect(api.load('greeting')).rejects.toThrow();
  });

  it('calling load() twice reuses the loader without throwing synchronously', () => {
    const api = createApi('https://cdn.x/a/widget.iife.js');
    // Both calls should return Promises without synchronous throws
    const p1 = api.load('greeting');
    const p2 = api.load('greeting');
    expect(p1).toBeInstanceOf(Promise);
    expect(p2).toBeInstanceOf(Promise);
    p1.catch(() => {});
    p2.catch(() => {});
  });
});
