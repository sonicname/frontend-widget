<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { fetchTodo } from './fetchTodo';

  const q = createQuery(() => ({ queryKey: ['todo', 1], queryFn: () => fetchTodo(1) }));
</script>

<div class="fw-query">
  {#if q.isPending}
    <span>Loading…</span>
  {:else if q.isError}
    <span>Error: {q.error.message}</span>
    <button class="fw-btn" onclick={() => q.refetch()}>Retry</button>
  {:else}
    <strong>Todo #{q.data.id}</strong>
    <p>{q.data.title}</p>
  {/if}
</div>
