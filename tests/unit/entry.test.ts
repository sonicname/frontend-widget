import { describe, it, expect } from 'vitest';
import { parseDataConfig, flushQueue } from '../../src/core/entry';

describe('parseDataConfig', () => {
  it('reads data-* attributes into a config object', () => {
    const s = document.createElement('script');
    s.setAttribute('data-target', '#slot');
    s.setAttribute('data-shadow', 'true');
    s.setAttribute('data-title', 'Hello');
    expect(parseDataConfig(s)).toEqual({ target: '#slot', shadow: true, title: 'Hello' });
  });

  it('returns null when no data-target present', () => {
    const s = document.createElement('script');
    expect(parseDataConfig(s)).toBeNull();
  });
});

describe('flushQueue', () => {
  it('replays queued init calls against the api', () => {
    const calls: unknown[] = [];
    const api = { init: (c: unknown) => { calls.push(c); return { id: 1 } as any; } };
    const queue = [['init', { target: '#a' }], ['init', { target: '#b' }]];
    flushQueue(api as any, queue);
    expect(calls).toEqual([{ target: '#a' }, { target: '#b' }]);
  });
});
