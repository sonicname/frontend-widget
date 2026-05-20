# Lazy-Loaded TanStack Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `@tanstack/svelte-query` as a self-contained lazy ESM chunk loaded on a button click, demonstrating how to lazy-load a heavy library with a context provider without growing the core bundle.

**Architecture:** The query chunk owns everything (QueryClient + QueryClientProvider + component + the library). It default-exports a `mountQueryPanel(target) => teardown` function. The core passes the existing `load` function into `App.svelte` as a prop; clicking "Load data" lazy-imports the chunk and mounts the panel into a container in the card. `@tanstack/svelte-query` is bundled only into `chunks/query.esm.js`, never the core.

**Tech Stack:** Svelte 5 (runes), `@tanstack/svelte-query` ^6, Vite (lib mode, multi-chunk), Vitest + jsdom, Playwright.

**Builds on:** the existing frontend-widget boilerplate (core IIFE + lazy ESM chunks, `makeLoader`/`resolveAssetBase`, `mountWidget`, `createApi`).

---

## File Structure

```
package.json                      # add @tanstack/svelte-query to dependencies
src/
  core/
    api.ts                        # MODIFY: pass `load` into mounted component props
  components/
    App.svelte                    # MODIFY: add `load` prop, "Load data" button, panel host + teardown
  features/
    fetchTodo.ts                  # NEW: testable fetch function
    QueryPanel.svelte             # NEW: QueryClient + provider + createQuery UI
    query.lazy.ts                 # NEW: chunk entry, mountQueryPanel(target) => teardown
vite.config.ts                    # MODIFY: add `query` chunk entry
demo/index.html                   # (unchanged — button comes from App)
tests/
  unit/fetchTodo.test.ts          # NEW
  unit/app-load.test.ts           # NEW (App "Load data" wiring)
  e2e/query.spec.ts               # NEW
scripts/check-size.mjs            # (unchanged — still asserts core < 15KB)
```

---

## Task 1: Install @tanstack/svelte-query

**Files:**
- Modify: `package.json` (dependencies)

- [ ] **Step 1: Install as a runtime dependency**

Run: `npm install @tanstack/svelte-query@^6`
Expected: installs (resolves to 6.x, peer `svelte ^5.25.0` satisfied by installed svelte 5.55.x), exit 0. If the peer warns about svelte version, confirm installed svelte is ≥ 5.25; if it is, the warning (if any) is non-blocking.

- [ ] **Step 2: Verify it landed in `dependencies` (not devDependencies)**

Run: `node -e "const p=require('./package.json'); console.log('dep:', p.dependencies && p.dependencies['@tanstack/svelte-query']); console.log('dev:', p.devDependencies && p.devDependencies['@tanstack/svelte-query'])"`
Expected: prints a version under `dep:` and `undefined` under `dev:`. If it landed in devDependencies, move it: `npm install @tanstack/svelte-query@^6 --save-prod` (npm `install` defaults to `dependencies`, so this should already be correct).

- [ ] **Step 3: Confirm unit suite still green**

Run: `npx vitest run`
Expected: 28 tests pass (no behavior changed yet).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @tanstack/svelte-query dependency"
```

---

## Task 2: fetchTodo function

**Files:**
- Create: `src/features/fetchTodo.ts`
- Test: `tests/unit/fetchTodo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchTodo } from '../../src/features/fetchTodo';

afterEach(() => vi.restoreAllMocks());

describe('fetchTodo', () => {
  it('returns parsed json for id and calls the right URL', async () => {
    const json = { id: 1, title: 'Test todo', completed: false };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => json });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchTodo(1);

    expect(result).toEqual(json);
    expect(fetchMock).toHaveBeenCalledWith('https://jsonplaceholder.typicode.com/todos/1');
  });

  it('defaults to id 1 when no argument given', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1, title: 'x', completed: false }) });
    vi.stubGlobal('fetch', fetchMock);
    await fetchTodo();
    expect(fetchMock).toHaveBeenCalledWith('https://jsonplaceholder.typicode.com/todos/1');
  });

  it('throws on a non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchTodo(1)).rejects.toThrow('HTTP 500');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/fetchTodo.test.ts`
Expected: FAIL — module `fetchTodo` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/fetchTodo.ts
export interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

/** Fetch a single todo from the public demo API. Throws on non-ok responses. */
export async function fetchTodo(id = 1): Promise<Todo> {
  const res = await fetch(`https://jsonplaceholder.typicode.com/todos/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/fetchTodo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/fetchTodo.ts tests/unit/fetchTodo.test.ts
git commit -m "feat: add fetchTodo helper for query demo"
```

---

## Task 3: QueryPanel + TodoView components

**Files:**
- Create: `src/features/QueryPanel.svelte` (provider wrapper)
- Create: `src/features/TodoView.svelte` (child that calls `createQuery`)

> No unit test in this task — the reactive async rendering is verified by e2e (Task 7). This task creates the two components; they compile-validate via the chunk build in Task 5. (Per the spec's "fallback" note, we keep these out of jsdom unit tests to avoid flaky async-reactivity assertions; `fetchTodo` + App wiring already cover the logic.)
>
> Why two components: `createQuery` reads the `QueryClient` from Svelte context, which must be available when it runs. The canonical, robust pattern is a parent that sets up `<QueryClientProvider>` and a CHILD component (rendered inside the provider) that calls `createQuery` in its `<script>`. This avoids calling `createQuery`/`getContext` from a template `{@const}` in the same component that creates the provider (which is fragile).

- [ ] **Step 1: Create `src/features/QueryPanel.svelte`** (owns the QueryClient + provider)

```svelte
<script lang="ts">
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import TodoView from './TodoView.svelte';

  const client = new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  });
</script>

<QueryClientProvider {client}>
  <TodoView />
</QueryClientProvider>
```

- [ ] **Step 2: Create `src/features/TodoView.svelte`** (child; calls `createQuery` under the provider)

```svelte
<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { fetchTodo } from './fetchTodo';

  const q = createQuery(() => ({ queryKey: ['todo', 1], queryFn: () => fetchTodo(1) }));
</script>

<div class="fw-query">
  {#if $q.isPending}
    <span>Loading…</span>
  {:else if $q.isError}
    <span>Error: {$q.error.message}</span>
    <button class="fw-btn" onclick={() => $q.refetch()}>Retry</button>
  {:else}
    <strong>Todo #{$q.data.id}</strong>
    <p>{$q.data.title}</p>
  {/if}
</div>
```

> Note on the `createQuery` API surface: in `@tanstack/svelte-query` v6, `createQuery` returns a store accessed with the `$` prefix (`$q.isPending`, `$q.data`, `$q.error`, `$q.refetch()`). If the installed v6 minor differs (e.g. a runes accessor without `$`, or `isLoading` instead of `isPending`), VERIFY against `node_modules/@tanstack/svelte-query` exported types and use what compiles — do NOT guess. The Task 5 build is the compile gate; if the form is wrong the build fails there and must be fixed.

- [ ] **Step 3: Commit**

```bash
git add src/features/QueryPanel.svelte src/features/TodoView.svelte
git commit -m "feat: add QueryPanel + TodoView (self-contained QueryClient + query)"
```

---

## Task 4: query.lazy chunk entry

**Files:**
- Create: `src/features/query.lazy.ts`

- [ ] **Step 1: Create `src/features/query.lazy.ts`**

```ts
import { mount, unmount } from 'svelte';
import QueryPanel from './QueryPanel.svelte';

/**
 * Mount the QueryPanel into `target` and return a teardown function.
 * This is the chunk's default export; the core loads it via dynamic import.
 */
export default function mountQueryPanel(target: HTMLElement): () => void {
  const app = mount(QueryPanel, { target });
  return () => unmount(app);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/query.lazy.ts
git commit -m "feat: add query.lazy chunk entry (mountQueryPanel)"
```

---

## Task 5: Add the query chunk to the build

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add the `query` entry to the chunks build**

Open `vite.config.ts`. In the `isChunks` branch of the `lib.entry` object, change:

```ts
        ? {
            entry: { greeting: 'src/features/greeting.lazy.ts' },
            formats: ['es'],
            fileName: (_f, name) => `chunks/${name}.esm.js`,
          }
```

to:

```ts
        ? {
            entry: {
              greeting: 'src/features/greeting.lazy.ts',
              query: 'src/features/query.lazy.ts',
            },
            formats: ['es'],
            fileName: (_f, name) => `chunks/${name}.esm.js`,
          }
```

- [ ] **Step 2: Build and inspect output**

Run: `npm run build`
Expected: exit 0. Then list `dist/chunks/` (Glob `dist/chunks/*.esm.js` or `Get-ChildItem dist/chunks`). Confirm BOTH `dist/chunks/greeting.esm.js` and `dist/chunks/query.esm.js` exist. The `query.esm.js` chunk will be substantially larger than greeting (it bundles svelte-query). This compiles QueryPanel.svelte — if the `createQuery` template form from Task 3 is wrong, the build fails here; fix the template to match the installed API and rebuild.

- [ ] **Step 3: Confirm svelte-query is NOT in the core**

Run (PowerShell): `Select-String -Path dist/widget.iife.js -Pattern 'QueryClient' -SimpleMatch -Quiet`
Expected: `False` (svelte-query symbols must NOT appear in the core IIFE). If `True`, svelte-query leaked into core — STOP and report (the chunk boundary is broken).

- [ ] **Step 4: Confirm core is still within budget**

Run: `npm run check:size`
Expected: prints core gzip size and "PASS: within size budget" (core must still be < 15 KB — it should be unchanged since the query code is only in the chunk and App's `load` wiring is tiny). If it FAILS, svelte-query likely leaked into core — investigate, do not raise the limit.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts
git commit -m "build: add query lazy chunk to dual build"
```

---

## Task 6: Wire `load` into App + the "Load data" button

**Files:**
- Modify: `src/core/api.ts`
- Modify: `src/components/App.svelte`
- Test: `tests/unit/app-load.test.ts`

- [ ] **Step 1: Write the failing test at `tests/unit/app-load.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import App from '../../src/components/App.svelte';

describe('App "Load data" lazy wiring', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="slot"></div>'; });

  it('loads the query chunk and mounts it into the panel host on click', async () => {
    const target = document.getElementById('slot')!;

    // Fake chunk: a mount function that records its target and appends a marker.
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

    // Open the card so the "Load data" button is visible.
    (target.querySelector('button.fw-btn') as HTMLButtonElement).click();
    flushSync();

    // Click "Load data".
    const loadBtn = Array.from(target.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Load data'),
    ) as HTMLButtonElement;
    expect(loadBtn).toBeTruthy();
    loadBtn.click();

    // load() is async — wait a microtask for the dynamic import + mount.
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/app-load.test.ts`
Expected: FAIL — App has no `load` prop / no "Load data" button yet.

- [ ] **Step 3: Update `src/components/App.svelte`**

Replace the entire file with:

```svelte
<script lang="ts">
  let {
    title = 'Widget',
    greeting = '',
    load,
  }: {
    title?: string;
    greeting?: string;
    load?: (name: string) => Promise<unknown>;
  } = $props();

  let open = $state(false);
  let panelHost = $state<HTMLElement | undefined>();
  let loadingPanel = $state(false);
  let teardown: (() => void) | undefined;

  async function loadPanel() {
    if (!load || teardown || loadingPanel) return; // mount once
    loadingPanel = true;
    try {
      const mountPanel = (await load('query')) as (t: HTMLElement) => () => void;
      if (panelHost) teardown = mountPanel(panelHost);
    } finally {
      loadingPanel = false;
    }
  }

  function closeCard() {
    teardown?.();
    teardown = undefined;
    open = false;
  }
</script>

<div class="fw-root">
  {#if open}
    <div class="fw-card">
      <strong>{title}</strong>
      <p>{greeting || 'Hello from the widget boilerplate.'}</p>
      <button class="fw-btn" onclick={loadPanel} disabled={loadingPanel}>
        {loadingPanel ? 'Loading…' : 'Load data'}
      </button>
      <div bind:this={panelHost}></div>
      <button class="fw-btn" onclick={closeCard}>Close</button>
    </div>
  {:else}
    <button class="fw-btn" onclick={() => (open = true)}>Open {title}</button>
  {/if}
</div>
```

- [ ] **Step 4: Update `src/core/api.ts` to pass `load` into the component**

In `src/core/api.ts`, find the `init` function. The `load` function is defined later in `createApi`. Move/define `load` so it is available inside `init`, and pass it into `mountWidget`'s props. Concretely, change the mount call from:

```ts
    const { target, shadow, assetBase, ...props } = config;
    const id = register();
    const mounted = mountWidget(App, host, { shadow }, props);
```

to:

```ts
    const { target, shadow, assetBase, ...props } = config;
    const id = register();
    const mounted = mountWidget(App, host, { shadow }, { ...props, load });
```

This requires `load` to be in scope inside `init`. Since `createApi` defines `function load(...)` (a hoisted function declaration) in the same closure, it is already in scope inside `init` — no reordering needed. Verify `load` is a `function` declaration (hoisted), not a `const` assigned after `init`. If it is a `const` declared after `init`, convert it to a hoisted `function load(name: string): Promise<unknown> { ... }` declaration so `init` can reference it.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/app-load.test.ts`
Expected: PASS (2 tests). Then run the FULL suite to catch regressions in existing mount/api tests (App now has an extra optional prop and a new button; the existing `mount.test.ts`/`api.test.ts` assert `.fw-root`/`firstElementChild`, which still hold):

Run: `npx vitest run`
Expected: all tests pass (was 28 + 3 from Task 2 + 2 here = 33). If an existing test broke because the rendered button text/structure changed, read it and fix the test only if the change is legitimate (e.g. a test asserting exact button count). Do NOT weaken behavior assertions.

- [ ] **Step 6: Rebuild and re-check size + chunk boundary**

Run: `npm run build && npm run check:size`
Expected: build exits 0; core still < 15 KB ("PASS"). Confirm `dist/chunks/query.esm.js` still exists.

- [ ] **Step 7: Commit**

```bash
git add src/components/App.svelte src/core/api.ts tests/unit/app-load.test.ts
git commit -m "feat: wire lazy query panel into App via injected load"
```

---

## Task 7: E2E test for lazy query loading

**Files:**
- Create: `tests/e2e/query.spec.ts`

> The existing `demo/index.html` already mounts widgets via `MyWidget.init`. Since the core auto-passes `load` into App, the "Load data" button appears once a card is open — no demo change needed.

- [ ] **Step 1: Write the e2e test at `tests/e2e/query.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('lazy-loads the query chunk and renders fetched data', async ({ page }) => {
  // Deterministic API response so the test is not network-dependent.
  await page.route('**/jsonplaceholder.typicode.com/todos/**', (route) =>
    route.fulfill({ json: { id: 1, title: 'E2E demo todo', completed: false } }),
  );

  // Track that the query chunk is fetched lazily (proves it is NOT in core).
  const chunkRequested = page.waitForRequest('**/chunks/query.esm.js');

  await page.goto('/demo/index.html');

  // Open the shadow-DOM card. (Two fixed-position widgets overlap; click via the
  // in-shadow node directly, matching the approach in embed.spec.ts.)
  await page.evaluate(() => {
    const host = document.querySelector('#slot-shadow')!.firstElementChild as HTMLElement;
    (host.shadowRoot!.querySelector('button.fw-btn') as HTMLButtonElement).click();
  });

  // Click "Load data" inside the shadow card.
  await page.evaluate(() => {
    const host = document.querySelector('#slot-shadow')!.firstElementChild as HTMLElement;
    const btn = Array.from(host.shadowRoot!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Load data'),
    ) as HTMLButtonElement;
    btn.click();
  });

  // The chunk must have been requested lazily.
  await chunkRequested;

  // The fetched data should render inside the shadow card.
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const host = document.querySelector('#slot-shadow')!.firstElementChild as HTMLElement;
        return host.shadowRoot!.textContent || '';
      }),
    )
    .toContain('E2E demo todo');
});
```

> Note: QueryPanel is mounted into the App's light/shadow container; because the shadow card mounts the panel inside the same shadow root, the assertion reads `shadowRoot.textContent`. If the panel is mounted into a light-DOM instance instead, adjust the selector. Use the shadow instance (`#slot-shadow`) as written.

- [ ] **Step 2: Run the e2e suite**

Run: `npm run test:e2e`
Expected: PASS — both the existing embed tests and this new query test. The webServer builds first (producing `dist/chunks/query.esm.js`) then serves the project root. If the chunk request never fires, confirm the "Load data" click path and that the build emitted the query chunk. If the data assertion times out, confirm the `page.route` glob matches the request URL.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/query.spec.ts
git commit -m "test: e2e lazy-load query chunk and render fetched data"
```

---

## Task 8: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a "Lazy library example (TanStack Query)" subsection under the existing "Lazy chunks" section**

Append after the "Lazy chunks" section in `README.md`:

```markdown
### Lazy library example: TanStack Query

`src/features/query.lazy.ts` + `QueryPanel.svelte` demonstrate lazy-loading a heavy
library that needs a context provider. The chunk owns its own `QueryClient` and
`QueryClientProvider`, so `@tanstack/svelte-query` is bundled only into
`dist/chunks/query.esm.js` — never the core. The widget loads it on demand when the
user clicks "Load data": `App` receives a `load` function from `init`, calls
`load('query')`, and mounts the returned panel into the card. Swap `fetchTodo` and
`QueryPanel` for your real data and UI.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document lazy TanStack Query example"
```

---

## Self-Review Notes

- **Spec §3 (dependency in `dependencies`, v6):** Task 1 (with explicit dep-vs-dev check).
- **Spec §4 (data flow: api passes `load`, App button → load('query') → mount into panelHost):** Task 6.
- **Spec §5 (fetchTodo, QueryPanel, query.lazy, vite entry):** Tasks 2, 3, 4, 5.
- **Spec §6 (edge cases):** mount-once guard + teardown-on-close in Task 6's App (`if (teardown || loadingPanel) return`, `closeCard` calls teardown); destroy-time teardown is covered because `closeCard` runs on Close and `unmount` removes the subtree (Svelte unmount tears down children).
- **Spec §7 (testing: fetchTodo unit, App wiring unit, e2e with route mock + chunk-request assertion, size budget):** Tasks 2, 6, 7, 5.
- **Spec §1/§2 (svelte-query not in core, core < 15KB):** Task 5 Step 3 (grep core for `QueryClient`) + Step 4 (`check:size`), re-checked in Task 6 Step 6.
- **Type/API consistency:** `load: (name: string) => Promise<unknown>` is the same signature in `api.ts` (`load(name): Promise<unknown>`) and the App prop. `mountQueryPanel(target) => () => void` is the chunk default export consumed by App as `(t) => () => void`. The `createQuery` `$`-store access in Task 3 has an explicit verify-against-installed-types instruction since the v6 minor API surface must be confirmed, not guessed.
- **Known risk flagged inline:** the `createQuery` accessor form (`$q` store vs runes) — Task 3 note + Task 5 build catches a wrong form at compile time.
```
