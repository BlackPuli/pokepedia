export interface User {
  id: string;
  username: string;
}

export interface Pokemon {
  id: number;
  name: string;
  sprite: string | null;
  types: string[];
}

export interface Page {
  items: Pokemon[];
  total: number;
  page: number;
  limit: number;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, error);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

// Logs in, or creates the account if the username is new.
export const enter = (username: string, password: string) => request<User>('POST', '/login', { username, password });

export const PAGE_SIZE = 60;

export const searchPokemon = (search: string, page: number) =>
  request<Page>('GET', `/pokemon?${new URLSearchParams({ search, page: String(page), limit: String(PAGE_SIZE) })}`);

export const getFavorites = (userId: string) => request<Pokemon[]>('GET', `/users/${userId}/favorites`);

export const addFavorite = (userId: string, pokemonId: number) =>
  request<void>('PUT', `/users/${userId}/favorites/${pokemonId}`);

export const removeFavorite = (userId: string, pokemonId: number) =>
  request<void>('DELETE', `/users/${userId}/favorites/${pokemonId}`);
