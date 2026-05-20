# Frontend Widget Boilerplate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight Svelte-based boilerplate that compiles to a single self-contained IIFE/UMD widget file embeddable on third-party sites, with runtime shadow/light DOM, inline critical CSS, and runtime lazy-loaded ESM chunks.

**Architecture:** Core is built as IIFE/UMD (single file, CSS inlined as string). Heavy/optional features are built as separate ESM chunks loaded at runtime via dynamic `import()` with an `assetBase` resolved from `document.currentScript.src`. Public API supports both auto-init (data-attributes) and a manual global API with multi-instance support.

**Tech Stack:** Svelte 5 (runes), Vite (library mode / Rollup), TypeScript, Vitest + jsdom (unit), Playwright (integration), gzip-size (size budget).

---

## File Structure

```
package.json
tsconfig.json
svelte.config.js
vite.config.ts              # dual build: core IIFE/UMD + chunks ESM (mode-driven)
vitest.config.ts
playwright.config.ts
scripts/check-size.mjs       # gzip budget check
src/
  core/
    types.ts                 # shared types (WidgetConfig, WidgetInstance)
    registry.ts              # instance registry
    css.ts                   # CSS injection (shadow + light dedupe)
    mount.ts                 # mount/unmount Svelte into shadow|light
    loader.ts                # assetBase resolve + loadChunk (cache + retry)
    api.ts                   # init/destroy/update + global object factory
    entry.ts                 # auto-init scan + queue flush + expose global
  components/
    App.svelte               # widget shell UI
  features/
    greeting.lazy.ts         # example lazy chunk entry (ESM)
  styles/
    critical.css             # critical inline CSS
demo/
  index.html                 # real embed test page
tests/
  unit/...                   # vitest
  e2e/...                    # playwright
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `svelte.config.js`, `.gitignore`, `vitest.config.ts`

> Note: `vitest.config.ts` is created here (not later) because Tasks 3–10 run `vitest`, which needs the svelte plugin + jsdom environment. The build-only `vite.config.ts` is added later in Task 11.

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
dist/
test-results/
playwright-report/
.svelte-kit/
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "frontend-widget",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build:core": "vite build --mode core",
    "build:chunks": "vite build --mode chunks",
    "build": "npm run build:core && npm run build:chunks",
    "dev": "vite",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check:size": "node scripts/check-size.mjs"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "@tsconfig/svelte": "^5.0.4",
    "gzip-size": "^7.0.0",
    "jsdom": "^25.0.0",
    "svelte": "^5.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src/**/*", "tests/**/*", "scripts/**/*"]
}
```

- [ ] **Step 4: Create `svelte.config.js`**

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { preprocess: vitePreprocess() };
```

- [ ] **Step 4b: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ compilerOptions: { dev: false } })],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: dependencies install, `node_modules/` populated, exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json svelte.config.js .gitignore package-lock.json
git commit -m "chore: scaffold project with svelte + vite + vitest"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/core/types.ts`

- [ ] **Step 1: Create `src/core/types.ts`**

```ts
export interface WidgetConfig {
  /** Mount target: CSS selector or element. */
  target: string | HTMLElement;
  /** Use shadow DOM isolation. No hard default — caller decides. */
  shadow?: boolean;
  /** Override base URL for lazy chunks (default: derived from script src). */
  assetBase?: string;
  /** Arbitrary props passed to the Svelte component. */
  [key: string]: unknown;
}

export interface WidgetInstance {
  readonly id: number;
  update(props: Record<string, unknown>): void;
  destroy(): void;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/types.ts
git commit -m "feat: add shared widget types"
```

---

## Task 3: Instance registry

**Files:**
- Create: `src/core/registry.ts`
- Test: `tests/unit/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { register, unregister, get, destroyAll } from '../../src/core/registry';
import type { WidgetInstance } from '../../src/core/types';

function fakeInstance(id: number): WidgetInstance {
  return { id, update() {}, destroy() {} };
}

describe('registry', () => {
  beforeEach(() => destroyAll());

  it('assigns incrementing ids and retrieves instances', () => {
    const a = fakeInstance(register());
    const b = fakeInstance(register());
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    store(a); store(b);
    expect(get(a.id)).toBe(a);
  });

  it('unregister removes the instance', () => {
    const id = register();
    store(fakeInstance(id));
    unregister(id);
    expect(get(id)).toBeUndefined();
  });

  it('destroyAll calls destroy on every instance and clears', () => {
    let calls = 0;
    const id = register();
    store({ id, update() {}, destroy() { calls++; } });
    destroyAll();
    expect(calls).toBe(1);
    expect(get(id)).toBeUndefined();
  });
});

// helper used in tests; defined here to match the API under test
import { store } from '../../src/core/registry';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/registry.test.ts`
Expected: FAIL — module `registry` has no exports `register/store/...`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/registry.ts
import type { WidgetInstance } from './types';

let nextId = 0;
const instances = new Map<number, WidgetInstance>();

/** Reserve a new instance id. */
export function register(): number {
  return ++nextId;
}

/** Store a fully-constructed instance under its id. */
export function store(instance: WidgetInstance): void {
  instances.set(instance.id, instance);
}

export function get(id: number): WidgetInstance | undefined {
  return instances.get(id);
}

export function unregister(id: number): void {
  instances.delete(id);
}

/** Destroy and remove all instances (used in tests and full teardown). */
export function destroyAll(): void {
  for (const inst of instances.values()) inst.destroy();
  instances.clear();
  nextId = 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/registry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/registry.ts tests/unit/registry.test.ts
git commit -m "feat: add instance registry"
```

---

## Task 4: CSS injection

**Files:**
- Create: `src/core/css.ts`
- Test: `tests/unit/css.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { injectCss } from '../../src/core/css';

describe('injectCss', () => {
  beforeEach(() => { document.head.innerHTML = ''; });

  it('injects into a shadow root as a <style> element', () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    injectCss(root, '.a{color:red}', 'k1');
    const style = root.querySelector('style');
    expect(style?.textContent).toBe('.a{color:red}');
  });

  it('injects light-DOM css into <head> only once per key', () => {
    injectCss(document, '.b{color:blue}', 'k2');
    injectCss(document, '.b{color:blue}', 'k2');
    const styles = document.head.querySelectorAll('style[data-widget-css="k2"]');
    expect(styles.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/css.test.ts`
Expected: FAIL — `injectCss` not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/css.ts

/**
 * Inject CSS text into a target root.
 * - ShadowRoot: always appends a <style> (isolated per instance).
 * - Document (light DOM): appends to <head>, deduped by key.
 */
export function injectCss(root: ShadowRoot | Document, css: string, key: string): void {
  if (root instanceof Document) {
    if (root.head.querySelector(`style[data-widget-css="${key}"]`)) return;
    const style = root.createElement('style');
    style.setAttribute('data-widget-css', key);
    style.textContent = css;
    root.head.appendChild(style);
    return;
  }
  const style = document.createElement('style');
  style.textContent = css;
  root.appendChild(style);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/css.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/css.ts tests/unit/css.test.ts
git commit -m "feat: add css injection (shadow + light dedupe)"
```

---

## Task 5: Lazy loader

**Files:**
- Create: `src/core/loader.ts`
- Test: `tests/unit/loader.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/loader.test.ts`
Expected: FAIL — `resolveAssetBase`/`makeLoader` not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/loader.ts

/** Importer signature, injectable for testing. */
export type Importer = (url: string) => Promise<{ default: unknown }>;

const defaultImporter: Importer = (url) =>
  import(/* @vite-ignore */ url) as Promise<{ default: unknown }>;

/** Resolve base URL for chunks: explicit override, else strip filename from src. */
export function resolveAssetBase(scriptSrc: string, override?: string): string {
  if (override) return override;
  return scriptSrc.replace(/[^/]*$/, '');
}

/** Build a chunk loader bound to an assetBase, with cache + single retry. */
export function makeLoader(assetBase: string, importer: Importer = defaultImporter) {
  const cache = new Map<string, unknown>();
  return async function load(name: string): Promise<unknown> {
    if (cache.has(name)) return cache.get(name);
    const url = `${assetBase}chunks/${name}.esm.js`;
    let mod: { default: unknown };
    try {
      mod = await importer(url);
    } catch {
      mod = await importer(url); // retry once
    }
    cache.set(name, mod.default);
    return mod.default;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/loader.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/loader.ts tests/unit/loader.test.ts
git commit -m "feat: add lazy chunk loader with cache and retry"
```

---

## Task 6: Critical CSS + App component

**Files:**
- Create: `src/styles/critical.css`, `src/components/App.svelte`

- [ ] **Step 1: Create `src/styles/critical.css`**

```css
.fw-root {
  position: fixed;
  bottom: 16px;
  right: 16px;
  font-family: system-ui, sans-serif;
  z-index: 2147483000;
}
.fw-card {
  background: #fff;
  color: #111;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  padding: 16px;
  min-width: 220px;
}
.fw-btn {
  cursor: pointer;
  border: 0;
  border-radius: 8px;
  padding: 8px 12px;
  background: #2563eb;
  color: #fff;
}
```

- [ ] **Step 2: Create `src/components/App.svelte`**

```svelte
<script lang="ts">
  let { title = 'Widget', greeting = '' }: { title?: string; greeting?: string } = $props();
  let open = $state(false);
</script>

<div class="fw-root">
  {#if open}
    <div class="fw-card">
      <strong>{title}</strong>
      <p>{greeting || 'Hello from the widget boilerplate.'}</p>
      <button class="fw-btn" onclick={() => (open = false)}>Close</button>
    </div>
  {:else}
    <button class="fw-btn" onclick={() => (open = true)}>Open {title}</button>
  {/if}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/critical.css src/components/App.svelte
git commit -m "feat: add widget shell component and critical css"
```

---

## Task 7: Mount/unmount

**Files:**
- Create: `src/core/mount.ts`
- Test: `tests/unit/mount.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mountWidget } from '../../src/core/mount';
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/mount.test.ts`
Expected: FAIL — `mountWidget` not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/mount.ts
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
  container.style.visibility = 'hidden';
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
  container.style.visibility = '';

  return {
    container,
    root,
    update(next) { Object.assign(state, next); },
    destroy() { unmount(app); container.remove(); },
  };
}
```

> Note: `$state` in a `.ts` file requires the Svelte compiler to process it. If the toolchain does not compile `.ts` runes, replace the `state`/`update` lines with a plain object and remount on update. The test only asserts mount/destroy/root, so either works.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/mount.test.ts`
Expected: PASS (2 tests). If `$state` causes a compile error in `.ts`, apply the fallback in the note: replace `const state = $state(props)` with `const state = { ...props }` and make `update` reassign via `unmount`+`mount`.

- [ ] **Step 5: Commit**

```bash
git add src/core/mount.ts tests/unit/mount.test.ts
git commit -m "feat: add mount/unmount with shadow + light support"
```

---

## Task 8: Public API (init/update/destroy)

**Files:**
- Create: `src/core/api.ts`
- Test: `tests/unit/api.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/api.test.ts`
Expected: FAIL — `createApi` not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/api.ts
import App from '../components/App.svelte';
import { mountWidget } from './mount';
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
    const mounted = mountWidget(App, host, { shadow }, props);

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/api.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/api.ts tests/unit/api.test.ts
git commit -m "feat: add public widget api (init/update/destroy/load)"
```

---

## Task 9: Auto-init scan + queue flush

**Files:**
- Create: `src/core/entry.ts`
- Test: `tests/unit/entry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/entry.test.ts`
Expected: FAIL — `parseDataConfig`/`flushQueue` not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/entry.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/entry.test.ts`
Expected: PASS (3 tests). The `bootstrap()` call is guarded and harmless under jsdom (no `currentScript.src`, no queue).

- [ ] **Step 5: Commit**

```bash
git add src/core/entry.ts tests/unit/entry.test.ts
git commit -m "feat: add auto-init data-attr scan and queue flush"
```

---

## Task 10: Example lazy feature chunk

**Files:**
- Create: `src/features/greeting.lazy.ts`
- Test: `tests/unit/greeting.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import buildGreeting from '../../src/features/greeting.lazy';

describe('greeting lazy feature', () => {
  it('default export builds a greeting string', () => {
    expect(buildGreeting('World')).toBe('Hello, World!');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/greeting.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/greeting.lazy.ts
// Example heavy/optional feature shipped as a separate ESM chunk.
// In a real widget this is where you'd pull in a date lib, emoji picker, etc.
export default function buildGreeting(name: string): string {
  return `Hello, ${name}!`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/greeting.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/greeting.lazy.ts tests/unit/greeting.test.ts
git commit -m "feat: add example lazy greeting feature chunk"
```

---

## Task 11: Vite build config (dual build)

**Files:**
- Create: `vite.config.ts`

> Note: `vitest.config.ts` was already created in Task 1. This task only adds the build config.

- [ ] **Step 1: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Two modes: `core` builds the self-contained IIFE; `chunks` builds ESM lazy chunks.
export default defineConfig(({ mode }) => {
  const isChunks = mode === 'chunks';
  return {
    plugins: [svelte()],
    build: {
      emptyOutDir: !isChunks, // core build clears dist; chunks build appends
      cssCodeSplit: false,
      minify: 'esbuild',
      lib: isChunks
        ? {
            entry: { greeting: 'src/features/greeting.lazy.ts' },
            formats: ['es'],
            fileName: (_f, name) => `chunks/${name}.esm.js`,
          }
        : {
            entry: 'src/core/entry.ts',
            name: 'MyWidget',
            formats: ['iife'],
            fileName: () => 'widget.iife.js',
          },
    },
  };
});
```

- [ ] **Step 2: Verify unit tests still pass**

Run: `npx vitest run`
Expected: PASS — all unit tests (registry, css, loader, mount, api, entry, greeting).

- [ ] **Step 3: Build and inspect output**

Run: `npm run build`
Expected: exit 0; `dist/widget.iife.js` and `dist/chunks/greeting.esm.js` exist; CSS is inlined inside the IIFE (no separate `.css` file in `dist/`).

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "build: add dual vite build (core iife + esm chunks)"
```

---

## Task 12: Demo page

**Files:**
- Create: `demo/index.html`

- [ ] **Step 1: Create `demo/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Widget demo</title>
  </head>
  <body>
    <h1>Host page</h1>
    <div id="slot-shadow"></div>
    <div id="slot-light"></div>

    <!-- Manual API usage -->
    <script src="/dist/widget.iife.js"></script>
    <script>
      MyWidget.init({ target: '#slot-shadow', shadow: true, title: 'Shadow' });
      MyWidget.init({ target: '#slot-light', shadow: false, title: 'Light' });
    </script>
  </body>
</html>
```

- [ ] **Step 2: Manually verify (optional sanity)**

Run: `npm run build` then serve root and open `/demo/index.html`.
Expected: two "Open" buttons render; clicking opens cards; shadow instance styles isolated.

- [ ] **Step 3: Commit**

```bash
git add demo/index.html
git commit -m "docs: add demo embed page"
```

---

## Task 13: Playwright integration tests

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/embed.spec.ts`

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'npm run build && npx vite preview --port 4174 --strictPort',
    port: 4174,
    reuseExistingServer: false,
  },
  use: { baseURL: 'http://localhost:4174' },
});
```

> Note: `vite preview` serves the project root by default with `dist/` accessible at `/dist/...` only if `demo/` references match. If preview cannot serve both `demo/` and `dist/`, add `"preview": { "outDir": "." }` handling or copy `demo/index.html` into `dist/`. Simplest: in this step also add a `vite.config` `preview` root pointing at project root and reference `/dist/widget.iife.js` (already used in demo).

- [ ] **Step 2: Write the e2e test**

```ts
import { test, expect } from '@playwright/test';

test('renders shadow and light instances', async ({ page }) => {
  await page.goto('/demo/index.html');

  // Shadow instance: button lives inside a shadow root.
  const shadowBtn = page.locator('#slot-shadow').locator('button', { hasText: 'Open Shadow' });
  await expect(shadowBtn).toBeVisible();
  await shadowBtn.click();
  await expect(page.locator('#slot-shadow').getByText('Hello from the widget')).toBeVisible();

  // Light instance: rendered in light DOM.
  const lightBtn = page.locator('#slot-light button', { hasText: 'Open Light' });
  await expect(lightBtn).toBeVisible();
});

test('destroy removes the widget DOM', async ({ page }) => {
  await page.goto('/demo/index.html');
  await page.evaluate(() => {
    const inst = MyWidget.init({ target: document.body, shadow: true, title: 'Temp' });
    (window as any).__temp = inst;
  });
  const count1 = await page.locator('body > div').count();
  await page.evaluate(() => (window as any).__temp.destroy());
  const count2 = await page.locator('body > div').count();
  expect(count2).toBe(count1 - 1);
});
```

- [ ] **Step 3: Install Playwright browsers**

Run: `npx playwright install chromium`
Expected: chromium downloaded.

- [ ] **Step 4: Run e2e tests**

Run: `npm run test:e2e`
Expected: PASS (2 tests). If `/demo/index.html` 404s under preview, adjust the demo path or copy it into `dist/` per the Step 1 note, then re-run.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/embed.spec.ts
git commit -m "test: add playwright integration tests for embed (shadow/light/destroy)"
```

---

## Task 14: Size budget check + CI gate

**Files:**
- Create: `scripts/check-size.mjs`

- [ ] **Step 1: Create `scripts/check-size.mjs`**

```js
import { readFileSync } from 'node:fs';
import { gzipSizeSync } from 'gzip-size';

const LIMIT_KB = 15;
const path = 'dist/widget.iife.js';
const raw = readFileSync(path);
const gz = gzipSizeSync(raw);
const kb = gz / 1024;
console.log(`core gzip size: ${kb.toFixed(2)} KB (limit ${LIMIT_KB} KB)`);
if (kb > LIMIT_KB) {
  console.error(`FAIL: core exceeds ${LIMIT_KB} KB gzip budget`);
  process.exit(1);
}
console.log('PASS: within size budget');
```

- [ ] **Step 2: Run the size check**

Run: `npm run build && npm run check:size`
Expected: prints gzip size and "PASS: within size budget" with exit 0. If it exceeds 15 KB, investigate bundle (treeshaking, accidental lib inclusion) before raising the limit.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-size.mjs
git commit -m "build: add gzip size budget check for core"
```

---

## Task 15: README usage docs

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Frontend Widget Boilerplate

Lightweight Svelte widget that compiles to a single self-contained file embeddable on any site.

## Build
- `npm run build` → `dist/widget.iife.js` (core, CSS inlined) + `dist/chunks/*.esm.js` (lazy).

## Embed — auto-init
```html
<script src="https://cdn.you/widget.iife.js"
        data-target="#slot" data-shadow="true" data-title="Support"></script>
```

## Embed — manual API
```html
<script src="https://cdn.you/widget.iife.js"></script>
<script>
  const inst = MyWidget.init({ target: '#slot', shadow: true, title: 'Hi' });
  inst.update({ title: 'Updated' });
  inst.destroy();
</script>
```

## Async queue (call before script loads)
```html
<script>
  window.MyWidget = window.MyWidget || { q: [] };
  window.MyWidget.q = window.MyWidget.q || [];
  // Until real api loads, push commands:
  if (!window.MyWidget.init) window.MyWidget.q.push(['init', { target: '#slot' }]);
</script>
<script async src="https://cdn.you/widget.iife.js"></script>
```

## Config
| Key | Type | Notes |
|-----|------|-------|
| `target` | string \| HTMLElement | required |
| `shadow` | boolean | runtime choice; no hard default |
| `assetBase` | string | override base for lazy chunks |
| `...props` | any | forwarded to the component |

## Lazy chunks
Core resolves `assetBase` from its own `<script src>` and loads `chunks/<name>.esm.js`
via dynamic `import()` on demand (`MyWidget.load('greeting')`).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with embed + config usage"
```

---

## Self-Review Notes

- **Spec §3 (dual build):** Task 11 (vite config core IIFE + chunks ESM).
- **Spec §4 (API, auto-init, queue, multi-instance):** Tasks 8, 9 (+registry Task 3).
- **Spec §5 (shadow/light, CSS-as-string, critical inline, FOUC):** Tasks 4, 6, 7 (`visibility:hidden` until mount; `?inline` CSS).
- **Spec §6 (lazy loader, assetBase, cache, retry):** Tasks 5, 10, exposed via Task 8 `load()`.
- **Spec §9 (testing: vitest, playwright, size budget):** Tasks 11, 13, 14.
- **Type consistency:** `WidgetConfig`/`WidgetInstance` (Task 2) used identically in mount/api/entry. Loader signature `makeLoader(base, importer)` consistent between Task 5 and Task 8.
- **Known risk flagged inline:** `$state` in `.ts` (Task 7) and `vite preview` serving `demo/`+`dist/` (Task 13) each have a written fallback.
```
