import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { recallPhoto, rememberPhoto } from '../../lib/offline/savedPhotos';

/**
 * A label photo of a wine a friend shared with you.
 *
 * These photos are ordinary picture links, so the browser loads them itself.
 * This wrapper adds one thing: once the small version has loaded it is also
 * kept on this phone, and if the picture later fails to load (no connection)
 * the kept one is shown instead. A full-size photo is never kept; with no
 * connection it is stood in for by the small version, if this phone has it.
 */
const SMALL = 'variant=thumbnail';
const smallVersion = (src: string) => (src.includes(SMALL) ? src : `${src}${src.includes('?') ? '&' : '?'}${SMALL}`);
/** Photos already kept since the app was opened, so each is filed once. */
const keptThisVisit = new Set<string>();

function keep(src: string) {
  if (!src.includes(SMALL) || keptThisVisit.has(src)) return;
  keptThisVisit.add(src);
  // The browser has just loaded this picture, so this is answered from its own cache.
  fetch(src, { cache: 'force-cache', credentials: 'same-origin' })
    .then((response) => (response.ok ? response.blob() : Promise.reject(new Error('Image failed'))))
    .then((photo) => rememberPhoto(src, photo))
    .catch(() => keptThisVisit.delete(src));
}

export function SharedLabel({ src, alt, ...rest }: { src: string; alt: string } & ImgHTMLAttributes<HTMLImageElement>) {
  const [standIn, setStandIn] = useState<string>();
  useEffect(() => {
    setStandIn(undefined);
  }, [src]);
  useEffect(() => () => void (standIn && URL.revokeObjectURL(standIn)), [standIn]);

  return (
    <img
      loading="lazy"
      decoding="async"
      {...rest}
      src={standIn ?? src}
      alt={alt}
      onLoad={() => {
        if (!standIn) keep(src);
      }}
      onError={() => {
        if (standIn) return;
        void recallPhoto(smallVersion(src)).then((photo) => {
          if (photo) setStandIn(URL.createObjectURL(photo));
        });
      }}
    />
  );
}
