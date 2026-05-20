import { describe, it, expect, beforeEach } from 'vitest';
import { flushQueue } from '../../src/core/entry';
import { createApi } from '../../src/core/api';
import { destroyAll } from '../../src/core/registry';

/**
 * Tests the flushQueue → api.init integration path against a real api instance.
 *
 * The existing entry.test.ts tested flushQueue with a hand-rolled fake api —
 * that verified iteration logic only. These tests verify the full wiring:
 * that queued 'init' commands replay against a real createApi() instance and
 * produce actual mounted DOM, and that the real api survives multiple queued
 * init calls without error.
 *
 * We do NOT rely on document.currentScript (jsdom never sets it for test
 * modules), so bootstrap() itself is not called here — only flushQueue is
 * exercised directly.
 */
describe('flushQueue against real api', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="slot"></div>';
    destroyAll();
  });

  it('replays a queued init command and mounts the widget into the target', () => {
    const api = createApi('https://cdn.x/a/widget.iife.js');
    const queue: unknown[][] = [['init', { target: '#slot', title: 'Queued' }]];

    flushQueue(api, queue);

    const slot = document.querySelector('#slot') as HTMLElement;
    expect(slot.firstElementChild).not.toBeNull();
  });

  it('replays multiple queued init commands into separate slots', () => {
    document.body.innerHTML = '<div id="a"></div><div id="b"></div>';
    destroyAll();

    const api = createApi('https://cdn.x/a/widget.iife.js');
    const queue: unknown[][] = [
      ['init', { target: '#a', title: 'First' }],
      ['init', { target: '#b', title: 'Second' }],
    ];

    flushQueue(api, queue);

    expect((document.querySelector('#a') as HTMLElement).firstElementChild).not.toBeNull();
    expect((document.querySelector('#b') as HTMLElement).firstElementChild).not.toBeNull();
  });

  it('unknown queue commands are silently ignored', () => {
    const api = createApi('https://cdn.x/a/widget.iife.js');
    const queue: unknown[][] = [['unknownCommand', { target: '#slot' }]];

    expect(() => flushQueue(api, queue)).not.toThrow();

    // No widget was mounted
    const slot = document.querySelector('#slot') as HTMLElement;
    expect(slot.firstElementChild).toBeNull();
  });
});
