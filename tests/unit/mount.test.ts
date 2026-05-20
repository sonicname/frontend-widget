import { describe, it, expect, beforeEach } from 'vitest';
import { mountWidget } from '../../src/core/mount.svelte';
import App from '../../src/components/App.svelte';

describe('mountWidget', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="slot"></div>'; });

  it('mounts into a shadow root when shadow=true', () => {
    const host = document.querySelector('#slot') as HTMLElement;
    const { container, root, destroy } = mountWidget(App, host, { shadow: true }, {});
    expect(container.shadowRoot).not.toBeNull();
    expect(root).toBe(container.shadowRoot);
    expect(container.shadowRoot!.querySelector('.fw-root')).not.toBeNull();
    destroy();
    expect(host.contains(container)).toBe(false);
  });

  it('mounts into light DOM when shadow=false', () => {
    const host = document.querySelector('#slot') as HTMLElement;
    const { container, root } = mountWidget(App, host, { shadow: false }, {});
    expect(container.shadowRoot).toBeNull();
    expect(root).toBe(document);
    expect(container.querySelector('.fw-root')).not.toBeNull();
  });
});
