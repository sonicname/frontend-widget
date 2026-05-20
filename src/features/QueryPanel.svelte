<script lang="ts">
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import TodoView from './TodoView.svelte';

  const client = new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  });
</script>

<QueryClientProvider {client}>
  <TodoView />
</QueryClientProvider>
