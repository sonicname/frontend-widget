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
