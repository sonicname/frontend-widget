# Frontend Widget Boilerplate — Design

**Date:** 2026-05-20
**Status:** Approved (pending spec review)

## 1. Mục tiêu

Boilerplate để build ra một file widget JavaScript nhúng lên website bên thứ ba.
Ưu tiên: nhẹ, load nhanh, tối thiểu KB không cần thiết. Đây là **boilerplate tổng
quát** (chưa cố định use case cụ thể), tái sử dụng cho nhiều loại widget.

### Yêu cầu cốt lõi
1. Hỗ trợ render cả **shadow root** lẫn **light DOM** (cấu hình runtime, không có default cứng).
2. Bundle core dạng **IIFE/UMD** (host chỉ cần 1 thẻ `<script>`).
3. **Lazy loading** các thư viện/feature nặng.
4. **Inline critical CSS** vào bundle.

## 2. Ràng buộc kỹ thuật nền tảng

IIFE/UMD **không** hỗ trợ code-splitting native trong Rollup/Vite — chỉ ESM mới
tách chunk tự động. Do đó không thể vừa "1 file IIFE/UMD" vừa để Rollup tự tách
lazy chunk trong cùng một build pass.

**Hòa giải (quyết định):** Core build dạng **IIFE/UMD (1 file tự chứa)**; các phần
lazy build **riêng dạng ESM**; core gọi `import(url)` động lúc runtime để nạp chúng.
Dynamic `import()` chạy được trong classic `<script>` trên trình duyệt hiện đại →
thỏa cả #2 lẫn #3.

## 3. Kiến trúc tổng thể & Build

**Stack:** Svelte 5 (compile-to-vanilla, runes) + Vite library mode (Rollup bên dưới).

**Hai build target song song:**
1. **Core** — `widget.iife.js` (hoặc `.umd.js`): toàn bộ shell widget + CSS inline
   dưới dạng string. 1 file duy nhất.
2. **Lazy chunks** — `chunks/*.esm.js`: feature/lib nặng, build ESM riêng, core nạp
   bằng `import()` runtime.

**Resolve base URL cho chunk:** lúc load, core đọc `document.currentScript.src`
(fallback: config option `assetBase`) → suy ra base path → ghép URL chunk. Cần thiết
vì script chạy trên domain bên thứ ba.

**Bundle size:** mục tiêu core gzip < ~15KB. Minify bằng esbuild, terser pass cho
`drop_console`, treeshake aggressive.

## 4. Public API & Lifecycle

Hỗ trợ **cả hai**: auto-init + global API thủ công.

### Auto-init
Khi script load, quét data-attributes trên chính thẻ `<script>` (hoặc các phần tử
`[data-mywidget]`). Nếu có → tự `init()`.

```html
<script src="https://cdn.you/widget.iife.js"
        data-key="abc" data-target="#slot" data-shadow="true"></script>
```

### Global API thủ công
```js
const instance = MyWidget.init({
  target: '#slot' | HTMLElement,   // bắt buộc
  shadow: true | false,            // runtime config (#1) — không có default cứng
  assetBase: 'https://cdn.you/',   // override base cho lazy chunks
  ...props                          // props truyền vào Svelte component
});
instance.update(props);            // cập nhật props
instance.destroy();                // gỡ DOM + cleanup listeners
MyWidget.version;                  // string
```

### Queue stub (tùy chọn)
Hỗ trợ pattern `MyWidget('init', {...})` gọi-trước-khi-load (kiểu GA). Snippet stub
đưa vào README; core "flush" queue khi sẵn sàng. Để sẵn hook, không bắt buộc dùng.

### Multi-instance
Mỗi `init()` trả về instance độc lập (mount riêng, shadow root riêng). Quản lý qua
registry nội bộ để `destroy` đúng.

## 5. Rendering, Shadow DOM & CSS injection

### Mount flow (mỗi instance)
1. Tạo host container bên trong `target`.
2. Nếu `shadow: true` → `attachShadow({ mode: 'open' })`, mount Svelte vào shadow root.
   Nếu `false` → mount thẳng vào container (light DOM).
3. Inject CSS string (đã inline trong bundle) đúng nơi:
   - Shadow: `<style>` trong shadow root → cách ly hoàn toàn.
   - Light DOM: dùng class-scoping của Svelte; CSS inject 1 lần vào `<head>`
     (dedupe theo flag) để tránh đè/leak.

### CSS-as-string
Cấu hình Vite để CSS **không** xuất ra file mà import vào JS dưới dạng string. Đây là
điều cho phép cả "inline critical CSS" lẫn inject vào shadow root.

### Inline critical CSS (#4) — 2 tầng
- **Critical** (layout shell, tránh CLS/FOUC): nằm trong core, inject ngay khi mount.
- **Non-critical** (styles của feature lazy): đi kèm chunk ESM tương ứng, inject khi
  chunk load.

### FOUC
Mount đồng bộ critical CSS trước khi component hiển thị; container `visibility:hidden`
đến khi style sẵn sàng (1 tick).

## 6. Lazy loading

Helper `loadChunk(name)` trong core:
```js
async function loadChunk(name) {
  const url = new URL(`chunks/${name}.esm.js`, assetBase).href;
  const mod = await import(/* @vite-ignore */ url);
  return mod.default;
}
```
- `assetBase` suy từ `document.currentScript.src` lúc load, hoặc override qua config.
- Cache (Map) để không load 2 lần; error handling + retry 1 lần.
- Ví dụ minh họa: 1 feature nặng (vd panel có lib format ngày) tách thành chunk, chỉ
  load khi cần.

## 7. Cấu trúc thư mục

```
src/
  core/
    entry.ts      auto-init, queue, registry, API công khai
    mount.ts      shadow/light + CSS inject
    loader.ts     loadChunk, assetBase resolve
  components/
    App.svelte    + UI components
  features/
    *.lazy.ts     mỗi cái = 1 chunk entry ESM
  styles/
    critical.css, theme
vite.config.ts     2 build: core IIFE/UMD + chunks ESM
demo/
  index.html       trang test nhúng thật
```

## 8. Build

`vite build` chạy 2 lần qua config (hoặc 2 lib entry) → core IIFE + chunks ESM.
Script `build` gộp cả hai.

## 9. Testing

- **Vitest** (jsdom) cho unit: loader, registry, API, mount logic.
- **Playwright** cho integration: nhúng `widget.iife.js` thật vào `demo/index.html`;
  test cả shadow & light DOM, lazy chunk load, multi-instance + destroy.
- **Size budget:** script kiểm tra gzip size của core, fail CI nếu vượt ngưỡng (vd 15KB).

## 10. Out of scope (YAGNI)

- Không cố định use case (chat/form/banner) — chỉ shell + pattern.
- Không dựng hạ tầng CDN thực; chỉ output file + cấu hình `assetBase`.
- Không build polyfill cho trình duyệt cũ không hỗ trợ dynamic `import()`.
