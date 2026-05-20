import App from '../components/App.svelte';
import { mountWidget } from './mount.svelte';
import { register, store, unregister } from './registry';
import { resolveAssetBase, makeLoader } from './loader';
import type { WidgetConfig, WidgetInstance } from './types';

export interface WidgetApi {
  init(config: WidgetConfig): WidgetInstance;
  version: string;
  /** Exposed for features that need to lazy-load chunks. */
  load(name: string): Promise<unknown>;
}

export function createApi(scriptSrc: string): WidgetApi {
  let loader: ReturnType<typeof makeLoader> | null = null;

  function init(config: WidgetConfig): WidgetInstance {
    const host =
      typeof config.target === 'string'
        ? document.querySelector<HTMLElement>(config.target)
        : config.target;
    if (!host) throw new Error(`Widget target not found: ${String(config.target)}`);

    const { target, shadow, assetBase, ...props } = config;
    const id = register();
    const mounted = mountWidget(App as unknown as import('svelte').Component, host, { shadow }, { ...props, load });

    const instance: WidgetInstance = {
      id,
      update: (next) => mounted.update(next),
      destroy: () => { mounted.destroy(); unregister(id); },
    };
    store(instance);
    return instance;
  }

  function load(name: string): Promise<unknown> {
    if (!loader) loader = makeLoader(resolveAssetBase(scriptSrc));
    return loader(name);
  }

  return { init, load, version: '0.1.0' };
}
