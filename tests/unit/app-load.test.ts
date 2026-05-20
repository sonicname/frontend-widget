import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import App from '../../src/components/App.svelte';

describe('App "Load data" lazy wiring', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="slot"></div>'; });

  it('loads the query chunk and mounts it into the panel host on click', async () => {
    const target = document.getElementById('slot')!;

    const mountCalls: HTMLElement[] = [];
    const fakeMountFn = (host: HTMLElement) => {
      mountCalls.push(host);
      const el = document.createElement('div');
      el.className = 'fake-panel';
      host.appendChild(el);
      return () => el.remove();
    };
    const load = vi.fn().mockResolvedValue(fakeMountFn);

    const app = mount(App, { target, props: { title: 'Hi', load } });

    (target.querySelector('button.fw-btn') as HTMLButtonElement).click();
    flushSync();

    const loadBtn = Array.from(target.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Load data'),
    ) as HTMLButtonElement;
    expect(loadBtn).toBeTruthy();
    loadBtn.click();

    await Promise.resolve();
    await Promise.resolve();
    flushSync();

    expect(load).toHaveBeenCalledWith('query');
    expect(mountCalls.length).toBe(1);
    expect(target.querySelector('.fake-panel')).not.toBeNull();

    unmount(app);
  });

  it('does not render the Load data button until the card is open', () => {
    const target = document.getElementById('slot')!;
    const load = vi.fn();
    const app = mount(App, { target, props: { title: 'Hi', load } });
    const loadBtn = Array.from(target.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Load data'),
    );
    expect(loadBtn).toBeUndefined();
    unmount(app);
  });

  it('calls teardown when the component is unmounted (no Close click)', async () => {
    const target = document.getElementById('slot')!;
    const teardownSpy = vi.fn();
    const fakeMountFn = (host: HTMLElement) => {
      const el = document.createElement('div');
      host.appendChild(el);
      return teardownSpy;
    };
    const load = vi.fn().mockResolvedValue(fakeMountFn);

    const app = mount(App, { target, props: { title: 'Hi', load } });
    (target.querySelector('button.fw-btn') as HTMLButtonElement).click();
    flushSync();
    const loadBtn = Array.from(target.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Load data'),
    ) as HTMLButtonElement;
    loadBtn.click();
    await Promise.resolve();
    await Promise.resolve();
    flushSync();

    expect(teardownSpy).not.toHaveBeenCalled();
    unmount(app);            // destroy the widget WITHOUT clicking Close
    flushSync();
    expect(teardownSpy).toHaveBeenCalledTimes(1);
  });

  it('does not re-mount on a second Load data click (mount once)', async () => {
    const target = document.getElementById('slot')!;
    const load = vi.fn().mockResolvedValue((host: HTMLElement) => {
      const el = document.createElement('div');
      el.className = 'panel';
      host.appendChild(el);
      return () => el.remove();
    });
    const app = mount(App, { target, props: { title: 'Hi', load } });
    (target.querySelector('button.fw-btn') as HTMLButtonElement).click();
    flushSync();
    const loadBtn = () => Array.from(target.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Load data'),
    ) as HTMLButtonElement;
    loadBtn().click();
    await Promise.resolve(); await Promise.resolve(); flushSync();
    loadBtn().click();
    await Promise.resolve(); await Promise.resolve(); flushSync();

    expect(load).toHaveBeenCalledTimes(1);
    expect(target.querySelectorAll('.panel').length).toBe(1);
    unmount(app);
  });

  it('tears down on Close and allows re-mounting after reopen', async () => {
    const target = document.getElementById('slot')!;
    const teardownSpy = vi.fn();
    const load = vi.fn().mockResolvedValue((host: HTMLElement) => {
      const el = document.createElement('div');
      host.appendChild(el);
      return teardownSpy;
    });
    const app = mount(App, { target, props: { title: 'Hi', load } });
    const openBtn = () => target.querySelector('button.fw-btn') as HTMLButtonElement;
    openBtn().click(); flushSync();
    const findBtn = (text: string) => Array.from(target.querySelectorAll('button')).find(
      (b) => b.textContent?.includes(text),
    ) as HTMLButtonElement;
    findBtn('Load data').click();
    await Promise.resolve(); await Promise.resolve(); flushSync();

    findBtn('Close').click(); flushSync();
    expect(teardownSpy).toHaveBeenCalledTimes(1);

    // reopen + load again
    openBtn().click(); flushSync();
    findBtn('Load data').click();
    await Promise.resolve(); await Promise.resolve(); flushSync();
    expect(load).toHaveBeenCalledTimes(2);

    unmount(app);
  });
});
