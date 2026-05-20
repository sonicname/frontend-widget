export interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

/** Fetch a single todo from the public demo API. Throws on non-ok responses. */
export async function fetchTodo(id = 1): Promise<Todo> {
  const res = await fetch(`https://jsonplaceholder.typicode.com/todos/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
