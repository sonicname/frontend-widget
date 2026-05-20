import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchTodo } from '../../src/features/fetchTodo';

afterEach(() => vi.restoreAllMocks());

describe('fetchTodo', () => {
  it('returns parsed json for id and calls the right URL', async () => {
    const json = { id: 1, title: 'Test todo', completed: false };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => json });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchTodo(1);

    expect(result).toEqual(json);
    expect(fetchMock).toHaveBeenCalledWith('https://jsonplaceholder.typicode.com/todos/1');
  });

  it('defaults to id 1 when no argument given', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1, title: 'x', completed: false }) });
    vi.stubGlobal('fetch', fetchMock);
    await fetchTodo();
    expect(fetchMock).toHaveBeenCalledWith('https://jsonplaceholder.typicode.com/todos/1');
  });

  it('throws on a non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchTodo(1)).rejects.toThrow('HTTP 500');
  });
});
