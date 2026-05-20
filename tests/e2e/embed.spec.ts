import { test, expect } from '@playwright/test';

test('renders shadow and light instances', async ({ page }) => {
  await page.goto('/demo/index.html');

  // Shadow instance: button lives inside a shadow root (Playwright pierces shadow DOM).
  const shadowBtn = page.locator('#slot-shadow').locator('button', { hasText: 'Open Shadow' });
  await expect(shadowBtn).toBeVisible();
  // Both widgets render at position:fixed bottom-right, so the light-DOM button
  // physically overlaps the shadow button at the same screen coordinates.
  // Playwright's force:true sends a synthetic event that does NOT propagate through
  // Svelte's shadow-DOM event handlers; instead we dispatch the click via evaluate()
  // so it fires on the actual DOM node inside the shadow root.
  await page.evaluate(() => {
    const container = document.querySelector('#slot-shadow > div') as HTMLElement;
    const btn = container?.shadowRoot?.querySelector('button') as HTMLElement | null;
    btn?.click();
  });
  await expect(page.locator('#slot-shadow').getByText('Hello from the widget')).toBeVisible();

  // Light instance: rendered in light DOM.
  const lightBtn = page.locator('#slot-light button', { hasText: 'Open Light' });
  await expect(lightBtn).toBeVisible();
});

test('destroy removes the widget DOM', async ({ page }) => {
  await page.goto('/demo/index.html');
  await page.evaluate(() => {
    const inst = (window as any).MyWidget.init({ target: document.body, shadow: true, title: 'Temp' });
    (window as any).__temp = inst;
  });
  const count1 = await page.locator('body > div').count();
  await page.evaluate(() => (window as any).__temp.destroy());
  const count2 = await page.locator('body > div').count();
  expect(count2).toBe(count1 - 1);
});
