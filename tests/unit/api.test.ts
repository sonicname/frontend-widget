import { describe, it, expect, beforeEach } from 'vitest';
import { createApi } from '../../src/core/api';
import { destroyAll, get } from '../../src/core/registry';

describe('createApi', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="slot"></div>';
    destroyAll();
  });


  it('init resolves a string target and returns an instance', () => {
    const api = createApi('https://cdn.x/a/widget.iife.js');
    const inst = api.init({ target: '#slot', shadow: true, title: 'Hi' });
    expect(inst.id).toBeGreaterThan(0);
    const host = document.querySelector('#slot') as HTMLElement;
    expect(host.firstElementChild).not.toBeNull();
  });

  it('destroy removes the mounted DOM', () => {
    const api = createApi('https://cdn.x/a/widget.iife.js');
    const inst = api.init({ target: '#slot' });
    inst.destroy();
    const host = document.querySelector('#slot') as HTMLElement;
    expect(host.firstElementChild).toBeNull();
  });

  it('throws when target cannot be resolved', () => {
    const api = createApi('https://cdn.x/a/widget.iife.js');
    expect(() => api.init({ target: '#missing' })).toThrow(/target/i);
  });

  it('destroy isolates instances — only the destroyed slot is cleared', () => {
    document.body.innerHTML = '<div id="a"></div><div id="b"></div>';
    destroyAll();

    const api = createApi('https://cdn.x/a/widget.iife.js');
    const instA = api.init({ target: '#a', title: 'A' });
    const instB = api.init({ target: '#b', title: 'B' });

    const slotA = document.querySelector('#a') as HTMLElement;
    const slotB = document.querySelector('#b') as HTMLElement;

    // Both mounted
    expect(slotA.firstElementChild).not.toBeNull();
    expect(slotB.firstElementChild).not.toBeNull();

    instA.destroy();

    // A's slot is empty; B's slot still has its child
    expect(slotA.firstElementChild).toBeNull();
    expect(slotB.firstElementChild).not.toBeNull();

    // Registry no longer has A, still has B
    expect(get(instA.id)).toBeUndefined();
    expect(get(instB.id)).toBeDefined();

    // B's instance is still functional
    expect(() => instB.update({ title: 'B2' })).not.toThrow();

    instB.destroy();
  });
});
