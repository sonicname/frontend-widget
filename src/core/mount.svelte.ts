import { mount, unmount, type Component } from 'svelte';
import { injectCss } from './css';
import criticalCss from '../styles/critical.css?inline';

export interface MountResult {
  container: HTMLElement;
  root: ShadowRoot | Document;
  destroy(): void;
  update(props: Record<string, unknown>): void;
}

/** Mount a Svelte component into a shadow root or light DOM under `host`. */
export function mountWidget(
  Comp: Component,
  host: HTMLElement,
  opts: { shadow?: boolean },
  props: Record<string, unknown>,
): MountResult {
  const container = document.createElement('div');
  host.appendChild(container);

  let root: ShadowRoot | Document;
  let mountTarget: HTMLElement | ShadowRoot;
  if (opts.shadow) {
    root = container.attachShadow({ mode: 'open' });
    mountTarget = root;
    injectCss(root, criticalCss, 'critical');
  } else {
    root = document;
    mountTarget = container;
    injectCss(document, criticalCss, 'critical');
  }

  const state = $state(props);
  const app = mount(Comp, { target: mountTarget as Element, props: state });

  return {
    container,
    root,
    update(next) { Object.assign(state, next); },
    destroy() { unmount(app); container.remove(); },
  };
}
