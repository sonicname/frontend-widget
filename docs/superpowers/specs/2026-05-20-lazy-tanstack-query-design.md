# Lazy-Loaded TanStack Query — Design

**Date:** 2026-05-20
**Status:** Approved (pending spec review)
**Builds on:** [frontend-widget boilerplate](2026-05-20-frontend-widget-boilerplate-design.md)

## 1. Mục tiêu

Thêm `@tanstack/svelte-query` vào boilerplate như một **demo pattern lazy-load**: minh
họa cách nạp động một thư viện nặng có context provider (Query) thành một chunk ESM
riêng, không làm phình core. Trigger bằng nút bấm trong card; data lấy từ một API công
khai (JSONPlaceholder).

### Ràng buộc cốt lõi
- `@tanstack/svelte-query` **chỉ** nằm trong chunk, **không** vào core.
- Core gzip vẫn **< 15KB** sau thay đổi (kiểm bằng `check:size`).
- Chunk tự chứa hoàn toàn: QueryClient + QueryClientProvider + component + lib.

## 2. Quyết định kiến trúc

TanStack Query cần `QueryClientProvider` bọc component dùng query. Nếu provider ở core
thì lib bị kéo vào core → mất ý nghĩa lazy. Vì vậy **chunk sở hữu toàn bộ** Query setup
và expose một hàm mount; core chỉ truyền một hàm `load` vào component để kích hoạt nạp
chunk khi cần. (Phương án bị loại: core host provider, hoặc core quản QueryClient — cả
hai đều kéo svelte-query vào core.)

## 3. Phiên bản & dependency

- `@tanstack/svelte-query` `^6` (mới nhất 6.1.30, peer `svelte ^5.25.0`; project có
  svelte 5.55.8 — tương thích).
- Thêm vào **`dependencies`** (runtime của widget, dù chỉ trong chunk), không phải
  devDependencies.
- Vite chunks-build bundle lib vào `query.esm.js`.

## 4. Kiến trúc & data flow

```
App.svelte (core)
  ── nhận prop `load` (loader bound assetBase, do api.init truyền vào)
  ── nút "Load data" + <div bind:this={panelHost}>
  ── onclick: mountFn = await load('query'); teardown = mountFn(panelHost)

chunks/query.esm.js  (lazy, chứa @tanstack/svelte-query)
  src/features/query.lazy.ts  → default export mountQueryPanel(target) => teardown
  src/features/QueryPanel.svelte → QueryClient + QueryClientProvider + createQuery
  src/features/fetchTodo.ts → hàm fetch tách riêng để unit-test
```

### Thay đổi ở core (tối thiểu)
- `src/core/api.ts`: tạo `load` (đã có sẵn), truyền vào props khi mount:
  `mountWidget(App, host, { shadow }, { ...props, load })`.
- `src/components/App.svelte`: thêm prop `load?: (name: string) => Promise<unknown>`,
  nút "Load data", `<div bind:this={panelHost}>`, gọi teardown khi đóng card/destroy.

## 5. Chunk internals

### `src/features/fetchTodo.ts`
```ts
export interface Todo { id: number; title: string; completed: boolean; }
export async function fetchTodo(id = 1): Promise<Todo> {
  const res = await fetch(`https://jsonplaceholder.typicode.com/todos/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

### `src/features/QueryPanel.svelte`
- `const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })`.
- Bọc `<QueryClientProvider {client}>`.
- `const q = createQuery(() => ({ queryKey: ['todo', 1], queryFn: () => fetchTodo(1) }))`.
- Render 3 trạng thái: loading / error (nút retry gọi `q.refetch()` hoặc invalidate) / data (hiện `title`).

### `src/features/query.lazy.ts`
```ts
import { mount, unmount } from 'svelte';
import QueryPanel from './QueryPanel.svelte';
export default function mountQueryPanel(target: HTMLElement): () => void {
  const app = mount(QueryPanel, { target });
  return () => unmount(app);
}
```

### `vite.config.ts`
Thêm entry `query` vào nhánh `isChunks`:
```ts
entry: {
  greeting: 'src/features/greeting.lazy.ts',
  query: 'src/features/query.lazy.ts',
}
```

## 6. Edge cases

- **Bấm "Load data" nhiều lần:** loader có cache (Map) → không nạp lại chunk; App chỉ
  mount 1 lần (teardown panel cũ trước khi mount mới, hoặc chặn nếu đã mount).
- **Destroy instance khi panel đang mount:** App gọi teardown trong cleanup để unmount
  QueryPanel (tránh leak QueryClient/subscription).
- **Lỗi mạng:** trạng thái error + nút retry; Query lo refetch.

## 7. Testing

### Unit (vitest + jsdom)
- `fetchTodo` — mock `global.fetch`: trả data đúng; ném lỗi khi `res.ok` false.
- `App.svelte` — inject `load` giả (trả `mountFn` giả đếm số lần gọi + target nhận
  được); bấm "Load data" → assert `load('query')` được gọi và `mountFn` mount vào
  `panelHost`. App test độc lập khỏi Query thật.
- `QueryPanel` (tùy chọn) — mount với `fetch` mock, `flushSync` + chờ microtask, assert
  render data. Nếu reactivity bất đồng bộ khó assert ổn định trong jsdom → fallback: chỉ
  giữ `fetchTodo` + App wiring, để QueryPanel cho e2e. Ghi rõ path đã chọn.

### E2E (Playwright)
- Mở rộng `demo/index.html` (nút "Load data" đến từ App).
- `page.route('**/jsonplaceholder.typicode.com/**', route => route.fulfill({ json: {...} }))`
  → click "Load data" → assert title hiện ra.
- Assert lazy: chờ request `**/chunks/query.esm.js` (chứng minh không nằm trong core).

### Size budget
- Assert core gzip vẫn < 15KB sau thay đổi.
- Chunk `query.esm.js` sẽ lớn (~kích thước lib) — kỳ vọng, không tính vào budget core.

## 8. Out of scope (YAGNI)

- Không thêm SSR/hydration cho Query.
- Không cấu hình QueryClient từ host (dùng default trong chunk).
- Không demo mutation — chỉ một query đọc để minh họa pattern.
