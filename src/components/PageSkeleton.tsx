import '../feedback.css';

type Shape = 'detail' | 'list' | 'cards';

/**
 * Grey placeholder shapes shown while a page loads, in place of a line of text.
 *
 * The page appears to be arriving rather than stalled, and nothing jumps when
 * the content lands. The label is still there for screen readers, and is the
 * same sentence the page used to print.
 */
export function PageSkeleton({ label, shape = 'detail' }: { label: string; shape?: Shape }) {
  return (
    <div className={`page-skeleton page-skeleton-${shape}`} aria-live="polite" aria-busy="true">
      <span className="skeleton-label">{label}</span>
      {shape === 'detail' && (
        <>
          <div className="skeleton-hero">
            <span className="skeleton-block skeleton-thumb" />
            <span className="skeleton-lines">
              <span className="skeleton-block skeleton-line skeleton-line-short" />
              <span className="skeleton-block skeleton-line skeleton-line-title" />
              <span className="skeleton-block skeleton-line skeleton-line-medium" />
            </span>
          </div>
          <span className="skeleton-block skeleton-panel" />
          <span className="skeleton-block skeleton-panel skeleton-panel-tall" />
        </>
      )}
      {shape === 'list' &&
        [0, 1, 2, 3, 4].map((row) => (
          <div className="skeleton-row" key={row}>
            <span className="skeleton-block skeleton-dot" />
            <span className="skeleton-lines">
              <span className="skeleton-block skeleton-line skeleton-line-medium" />
              <span className="skeleton-block skeleton-line skeleton-line-short" />
            </span>
          </div>
        ))}
      {shape === 'cards' && (
        <div className="skeleton-cards">
          {[0, 1, 2, 3, 4, 5].map((card) => (
            <span className="skeleton-block skeleton-card" key={card} />
          ))}
        </div>
      )}
    </div>
  );
}
