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
