import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, useState } from 'react';
import type { Pokemon } from './api.ts';

// Keep in sync with .card height and .grid-row gap in styles.css.
const MIN_CARD_WIDTH = 160;
const GAP = 16;
const ROW_HEIGHT = 212 + GAP;

interface Props {
  items: Pokemon[];
  favoriteIds: Set<number>;
  onToggleFavorite: (p: Pokemon) => void;
  onEndReached?: () => void;
}

// Window-scrolled grid that only renders the rows on screen (plus a few above and below).
export function PokemonGrid({ items, favoriteIds, onToggleFavorite, onEndReached }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(listRef.current!);
    return () => observer.disconnect();
  }, []);

  const columns = Math.max(1, Math.floor((width + GAP) / (MIN_CARD_WIDTH + GAP)));
  const rowCount = Math.ceil(items.length / columns);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });
  const rows = virtualizer.getVirtualItems();

  // Ask for more when the last rendered row is within 3 rows of the end. Runs after every render,
  // so it keeps loading until the screen is full; the caller ignores calls while a page is in flight.
  const lastRow = rows.at(-1)?.index ?? -1;
  useEffect(() => {
    if (onEndReached && lastRow >= rowCount - 3) onEndReached();
  });

  return (
    <div ref={listRef} className="grid" role="list" aria-label="Pokémon" style={{ height: virtualizer.getTotalSize() }}>
      {rows.map((row) => (
        <div
          key={row.key}
          className="grid-row"
          style={{
            transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
            // minmax(0, …): long names truncate instead of widening their column.
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {items.slice(row.index * columns, (row.index + 1) * columns).map((p) => (
            <PokemonCard
              key={p.id}
              pokemon={p}
              isFavorite={favoriteIds.has(p.id)}
              onToggle={() => onToggleFavorite(p)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function PokemonCard({ pokemon: p, isFavorite, onToggle }: { pokemon: Pokemon; isFavorite: boolean; onToggle: () => void }) {
  return (
    <article className="panel card" role="listitem">
      <button
        className="fav"
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Remove ${p.name} from favorites` : `Add ${p.name} to favorites`}
        onClick={onToggle}
      >
        {isFavorite ? '★' : '☆'}
      </button>
      {p.sprite ? <img src={p.sprite} alt="" width={96} height={96} loading="lazy" /> : <div className="no-sprite" />}
      <span className="dex">#{String(p.id).padStart(3, '0')}</span>
      <h2>{p.name}</h2>
      <div className="types">
        {p.types.map((t) => (
          <span key={t} className="type" style={{ background: `var(--type-${t}, #777)` }}>
            {t}
          </span>
        ))}
      </div>
    </article>
  );
}
