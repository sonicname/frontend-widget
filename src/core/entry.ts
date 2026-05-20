import { createApi, type WidgetApi } from './api';
import type { WidgetConfig } from './types';

/** Parse data-* attributes on a script tag into a WidgetConfig, or null. */
export function parseDataConfig(el: Element): WidgetConfig | null {
  const target = el.getAttribute('data-target');
  if (!target) return null;
  const config: Record<string, unknown> = { target };
  for (const attr of Array.from(el.attributes)) {
    if (!attr.name.startsWith('data-') || attr.name === 'data-target') continue;
    const key = attr.name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    config[key] = attr.value === 'true' ? true : attr.value === 'false' ? false : attr.value;
  }
  return config as WidgetConfig;
}

/** Replay a pre-load command queue: each entry is [method, ...args]. */
export function flushQueue(api: WidgetApi, queue: unknown[][]): void {
  for (const [method, ...args] of queue) {
    if (method === 'init') api.init(args[0] as WidgetConfig);
  }
}

/** Bootstrap: resolve script, build api, flush queue, run auto-init. */
function bootstrap(): void {
  const current = document.currentScript as HTMLScriptElement | null;
  const src = current?.src ?? '';
  const api = createApi(src);

  const w = window as unknown as Record<string, unknown>;
  const existing = w['MyWidget'];
  if (existing && Array.isArray((existing as { q?: unknown[][] }).q)) {
    flushQueue(api, (existing as { q: unknown[][] }).q);
  }
  w['MyWidget'] = api;

  if (current) {
    const cfg = parseDataConfig(current);
    if (cfg) api.init(cfg);
  }
}

if (typeof document !== 'undefined') bootstrap();
