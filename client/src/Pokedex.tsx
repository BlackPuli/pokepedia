import { useEffect, useRef, useState } from 'react';
import { ApiError, PAGE_SIZE, addFavorite, getFavorites, removeFavorite, searchPokemon } from './api.ts';
import type { Pokemon, User } from './api.ts';
import { PokemonGrid } from './PokemonGrid.tsx';

// Everything loaded so far for one search query.
interface Results {
  query: string;
  items: Pokemon[];
  total: number;
}

export function Pokedex({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<Pokemon[]>([]);
  const [tab, setTab] = useState<'all' | 'favorites'>('all');
  const [error, setError] = useState('');

  // Bumped on every new search so responses for an older query are dropped.
  const generation = useRef(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    getFavorites(user.id)
      .then(setFavorites)
      .catch((err) => {
        // Saved user no longer exists (e.g. the database was reset): back to login.
        if (err instanceof ApiError && err.status === 404) onLogout();
        else setError('Could not load your favorites.');
      });
  }, [user.id, onLogout]);

  async function loadPage(query: string, page: number, gen: number) {
    loadingRef.current = true;
    setLoading(true);
    try {
      const r = await searchPokemon(query, page);
      if (gen !== generation.current) return;
      setResults((prev) =>
        page === 1 || !prev ? { query, items: r.items, total: r.total } : { ...prev, items: [...prev.items, ...r.items] },
      );
      setError('');
    } catch {
      if (gen === generation.current) setError('Could not load Pokémon. Is the server running?');
    } finally {
      if (gen === generation.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }

  // Debounced: a new query restarts from page 1.
  useEffect(() => {
    const gen = ++generation.current;
    const timer = setTimeout(() => loadPage(search.trim(), 1, gen), 250);
    return () => clearTimeout(timer);
  }, [search]);

  function loadMore() {
    // Skip while a page is in flight, when everything is loaded, or while a new query is still debouncing.
    if (!results || loadingRef.current || error) return;
    if (results.items.length >= results.total || results.query !== search.trim()) return;
    loadPage(results.query, Math.floor(results.items.length / PAGE_SIZE) + 1, generation.current);
  }

  // Clearing the error lets loadMore run again; with nothing loaded yet, restart the search.
  function retry() {
    setError('');
    if (!results) loadPage(search.trim(), 1, generation.current);
  }

  const favoriteIds = new Set(favorites.map((f) => f.id));

  async function toggleFavorite(p: Pokemon) {
    const previous = favorites;
    const isFavorite = favoriteIds.has(p.id);
    // Optimistic update, rolled back if the request fails.
    setFavorites(isFavorite ? favorites.filter((f) => f.id !== p.id) : [...favorites, p].sort((a, b) => a.id - b.id));
    try {
      await (isFavorite ? removeFavorite : addFavorite)(user.id, p.id);
    } catch {
      setFavorites(previous);
      setError('Could not update favorites.');
    }
  }

  const query = search.trim().toLowerCase();
  const list = tab === 'all' ? results?.items : favorites.filter((f) => f.name.includes(query));

  return (
    <>
      <header className="topbar">
        <h1>Pokédex</h1>
        <span className="who">
          Signed in as <strong>{user.username}</strong>
        </span>
        <button className="ghost" onClick={onLogout}>
          Log out
        </button>
      </header>

      <main className="container">
        <div className="controls">
          <input
            type="search"
            placeholder="Search by name…"
            aria-label="Search Pokémon by name"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              window.scrollTo({ top: 0 });
            }}
          />
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'all'} onClick={() => setTab('all')}>
              All
            </button>
            <button role="tab" aria-selected={tab === 'favorites'} onClick={() => setTab('favorites')}>
              Favorites ({favorites.length})
            </button>
          </div>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}{' '}
            <button className="ghost" onClick={retry}>
              Retry
            </button>
          </p>
        )}

        {tab === 'all' && results && results.total > 0 && (
          <p className="count">
            {results.total.toLocaleString()} Pokémon{results.query && ` matching "${results.query}"`}
          </p>
        )}

        {!list ? (
          <p className="empty">Loading…</p>
        ) : list.length === 0 ? (
          <p className="empty">
            {tab === 'favorites' && !query
              ? 'No favorites yet. Tap the ☆ on any Pokémon to add it.'
              : `No Pokémon match "${search.trim()}".`}
          </p>
        ) : (
          <PokemonGrid
            // Remount per tab so each starts with its own scroll measurements.
            key={tab}
            items={list}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
            onEndReached={tab === 'all' ? loadMore : undefined}
          />
        )}

        {tab === 'all' && loading && results?.query === search.trim() && <p className="empty">Loading more…</p>}
      </main>
    </>
  );
}
