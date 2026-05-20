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
