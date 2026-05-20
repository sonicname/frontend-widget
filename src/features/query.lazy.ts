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
