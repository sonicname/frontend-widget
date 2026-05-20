<script lang="ts">
  let { title = 'Widget', greeting = '' }: { title?: string; greeting?: string } = $props();
  let open = $state(false);
</script>

<div class="fw-root">
  {#if open}
    <div class="fw-card">
      <strong>{title}</strong>
      <p>{greeting || 'Hello from the widget boilerplate.'}</p>
      <button class="fw-btn" onclick={() => (open = false)}>Close</button>
    </div>
  {:else}
    <button class="fw-btn" onclick={() => (open = true)}>Open {title}</button>
  {/if}
</div>
