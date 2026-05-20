import { describe, it, expect, beforeEach } from 'vitest';
import { createApi } from '../../src/core/api';
import { destroyAll } from '../../src/core/registry';

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
});
