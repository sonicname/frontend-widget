import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveAssetBase, makeLoader } from '../../src/core/loader';

describe('resolveAssetBase', () => {
  it('strips filename from a script src', () => {
    expect(resolveAssetBase('https://cdn.x/a/widget.iife.js')).toBe('https://cdn.x/a/');
  });
  it('honors an explicit override', () => {
    expect(resolveAssetBase('https://cdn.x/a/w.js', 'https://o/')).toBe('https://o/');
  });
});

describe('makeLoader', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('imports chunk by name and caches the module', async () => {
    const mod = { default: () => 'hi' };
    const importer = vi.fn().mockResolvedValue(mod);
    const load = makeLoader('https://cdn.x/a/', importer);
    const first = await load('greeting');
    const second = await load('greeting');
    expect(first).toBe(mod.default);
    expect(importer).toHaveBeenCalledTimes(1); // cached
    expect(importer).toHaveBeenCalledWith('https://cdn.x/a/chunks/greeting.esm.js');
    expect(second).toBe(mod.default);
  });

  it('retries once on failure then succeeds', async () => {
    const mod = { default: 42 };
    const importer = vi.fn()
      .mockRejectedValueOnce(new Error('net'))
      .mockResolvedValueOnce(mod);
    const load = makeLoader('https://cdn.x/a/', importer);
    expect(await load('x')).toBe(42);
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('throws after retry also fails', async () => {
    const importer = vi.fn().mockRejectedValue(new Error('net'));
    const load = makeLoader('https://cdn.x/a/', importer);
    await expect(load('x')).rejects.toThrow('net');
    expect(importer).toHaveBeenCalledTimes(2);
  });
});
