import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppIcon } from '../../components/AppIcons';
import { LoadError } from '../../components/LoadError';
import { PageHeader } from '../../components/PageHeader';
import { useLoad } from '../../lib/query/client';
import { listProducers, type ProducerSummary } from '../producers/api';
import { listTastings, type TastingSummary } from '../tastings/api';
import { listWines, type JournalWine } from '../wines/api';
import '../../styles/search.css';

const DEBOUNCE_MS = 250;
/** One letter matches half the notebook; wait for two before asking. */
const MIN_LENGTH = 2;
const WINE_LIMIT = 6;
const LIST_LIMIT = 5;

/** Lower case, no accents, no punctuation: "Roumier" finds "G. Roumier" and "Môrey" finds "Morey". */
const searchKey = (value: string | null | undefined) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Every word typed has to appear somewhere in the text, in any order. */
const matches = (needle: string, haystack: string) => {
  const text = searchKey(haystack);
  return needle.split(' ').every((word) => text.includes(word));
};

const dateLabel = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/**
 * One box that looks through wines, producers and tastings at once.
 *
 * Each of those already had its own search, on its own screen, so finding "the
 * Roulot evening" meant knowing which screen to look on first. This page asks
 * all three and shows the answers together.
 *
 * Wines are searched by the server (the same quick word search the Journal
 * runs as you type, never the paid Smart search). Producers and tastings are
 * short lists the app already holds, so they are filtered here without another
 * request. The search text lives in the address, so Back returns to the same
 * results after opening one.
 */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const fromAddress = params.get('q') ?? '';
  const [draft, setDraft] = useState(fromAddress);
  const [settled, setSettled] = useState(fromAddress.trim());

  // Wait for a pause in typing before searching, and keep the address in step.
  useEffect(() => {
    const next = draft.trim();
    if (next === settled) return;
    const timer = window.setTimeout(() => {
      setSettled(next);
      setParams(next ? { q: next } : {}, { replace: true });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, settled, setParams]);

  const needle = searchKey(settled);
  const active = needle.length >= MIN_LENGTH;
  // "#birthday" is a hashtag: the server then looks at wine tags alone, and
  // producers and tastings, which have no tags, stay out of the answer.
  const tagMode = settled.startsWith('#');
  const everything = active && !tagMode;

  const wines = useLoad(
    ['search', 'wines', settled],
    (signal) => listWines(new URLSearchParams({ query: settled }), { limit: WINE_LIMIT, signal }),
    { skip: !active, keepPrevious: true },
  );
  const producers = useLoad(['producers'], listProducers, { skip: !everything });
  const tastings = useLoad(['tastings'], listTastings, { skip: !everything });

  const producerHits = useMemo<ProducerSummary[]>(
    () =>
      everything
        ? (producers.data?.items ?? []).filter((p) =>
            matches(needle, [p.canonicalName, p.homeLocality, p.homeRegion, p.homeCountry].filter(Boolean).join(' ')),
          )
        : [],
    [everything, needle, producers.data],
  );
  const tastingHits = useMemo<TastingSummary[]>(
    () =>
      everything
        ? (tastings.data?.items ?? []).filter((t) => matches(needle, [t.name, t.venue].filter(Boolean).join(' ')))
        : [],
    [everything, needle, tastings.data],
  );

  const wineItems: JournalWine[] = active ? (wines.data?.items ?? []) : [];
  const wineTotal = active ? (wines.data?.total ?? 0) : 0;
  const waiting =
    active &&
    ((wines.loading && !wines.data) ||
      (everything && ((producers.loading && !producers.data) || (tastings.loading && !tastings.data))));
  const failed = active ? wines.error || (everything ? producers.error || tastings.error : null) : null;
  const nothing = active && !waiting && !failed && !wineItems.length && !producerHits.length && !tastingHits.length;
  const journalLink = `/journal?query=${encodeURIComponent(settled)}`;

  return (
    <section className="search-page">
      <PageHeader title="Search" subtitle="Wines, producers and tastings in one place." />
      <form className="search-everywhere" role="search" onSubmit={(event) => event.preventDefault()}>
        <span aria-hidden="true">
          <AppIcon kind="search" />
        </span>
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="A wine, a producer, an evening…"
          aria-label="Search everything"
          autoFocus
          autoComplete="off"
          enterKeyHint="search"
        />
        {draft && (
          <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setDraft('')}>
            <AppIcon kind="close" />
          </button>
        )}
      </form>

      {!active && (
        <p className="search-hint">
          Type at least two letters. Try a producer, a village, a vintage year or the name of an evening. Start with #
          to look through your hashtags only, for example #birthday.
        </p>
      )}
      {waiting && <p aria-live="polite">Searching…</p>}
      {failed && (
        <LoadError
          error={failed}
          fallback="The search could not be completed."
          onRetry={() => {
            void wines.retry();
            void producers.retry();
            void tastings.retry();
          }}
        />
      )}
      {nothing && (
        <div className="empty">
          <h2>Nothing found</h2>
          <p>
            {tagMode
              ? `No wine carries the hashtag ${settled}. Remove the # to search everything instead.`
              : `No wine, producer or tasting matches “${settled}”. Try fewer words or a different spelling.`}
          </p>
        </div>
      )}

      {wineItems.length > 0 && (
        <section className="search-group" aria-labelledby="search-wines">
          <h2 id="search-wines">
            {tagMode ? `Wines tagged ${settled}` : 'Wines'} <small>{wineTotal}</small>
          </h2>
          <ul>
            {wineItems.map((wine) => (
              <li key={wine.id}>
                <Link className="search-result" to={wine.shared ? `/shared/${wine.id}` : `/wines/${wine.id}`}>
                  <span className="search-result-name">
                    {[wine.producer, wine.wineName].filter(Boolean).join(' · ') || 'Unnamed wine'}
                  </span>
                  <small>
                    {[wine.vintage, wine.appellation || wine.region, wine.shared ? 'Shared with you' : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
          {wineTotal > wineItems.length && (
            <Link className="search-more" to={journalLink}>
              See all {wineTotal} wines in the Journal
            </Link>
          )}
        </section>
      )}

      {producerHits.length > 0 && (
        <section className="search-group" aria-labelledby="search-producers">
          <h2 id="search-producers">
            Producers <small>{producerHits.length}</small>
          </h2>
          <ul>
            {producerHits.slice(0, LIST_LIMIT).map((producer) => (
              <li key={producer.id}>
                <Link className="search-result" to={`/producers/${producer.id}`}>
                  <span className="search-result-name">{producer.canonicalName}</span>
                  <small>
                    {[
                      producer.homeLocality || producer.homeRegion,
                      producer.homeCountry,
                      producer.tastedCount ? `${producer.tastedCount} tasted` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
          {producerHits.length > LIST_LIMIT && (
            <Link className="search-more" to="/producers">
              {count(producerHits.length - LIST_LIMIT, 'more producer')} on the Producers page
            </Link>
          )}
        </section>
      )}

      {tastingHits.length > 0 && (
        <section className="search-group" aria-labelledby="search-tastings">
          <h2 id="search-tastings">
            Tastings <small>{tastingHits.length}</small>
          </h2>
          <ul>
            {tastingHits.slice(0, LIST_LIMIT).map((tasting) => (
              <li key={tasting.id}>
                <Link className="search-result" to={`/tastings/${tasting.id}`}>
                  <span className="search-result-name">{tasting.name}</span>
                  <small>
                    {[dateLabel(tasting.tastingDate), tasting.venue, count(tasting.wineCount, 'wine')]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </Link>
              </li>
            ))}
          </ul>
          {tastingHits.length > LIST_LIMIT && (
            <Link className="search-more" to="/tastings">
              {count(tastingHits.length - LIST_LIMIT, 'more tasting')} on the Tastings page
            </Link>
          )}
        </section>
      )}
    </section>
  );
}
