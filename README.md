# Frontend Widget Boilerplate

Lightweight Svelte widget that compiles to a single self-contained file embeddable on any site.

## Build

- `npm run build` → `dist/widget.iife.js` (core, CSS inlined) + `dist/chunks/*.esm.js` (lazy).
- Core is ~13 KB gzip; `npm run check:size` enforces a 15 KB budget.

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
  // Until the real api loads, push commands:
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

## Develop

- `npm test` — unit tests (Vitest + jsdom).
- `npm run test:e2e` — integration tests (Playwright; builds + serves `demo/`).
- `npm run dev` — Vite dev server.

## Project structure

```
src/
  core/        types, registry, css, loader, api, entry; mount.svelte.ts; iife.ts (build entry)
  components/  App.svelte
  features/    *.lazy.ts (each builds to a separate ESM chunk)
  styles/      critical.css
demo/          index.html (real embed page)
scripts/       check-size.mjs, serve.mjs
```
