import { test, expect } from '@playwright/test';

test('lazy-loads the query chunk and renders fetched data', async ({ page }) => {
  // Deterministic API response so the test is not network-dependent.
  await page.route('**/jsonplaceholder.typicode.com/todos/**', (route) =>
    route.fulfill({ json: { id: 1, title: 'E2E demo todo', completed: false } }),
  );

  // Track that the query chunk is fetched lazily (proves it is NOT in core).
  const chunkRequested = page.waitForRequest('**/chunks/query.esm.js');

  await page.goto('/demo/index.html');

  // Open the shadow-DOM card (click the in-shadow button directly).
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
