import { Link } from 'react-router-dom';
import { useActiveTasting } from './useActiveTasting';
import '../../tastings.css';

/**
 * The one line saying an evening is running.
 *
 * In flow above the page rather than fixed above the nav: the wine form already
 * parks a fixed save bar in that band, and a second element there would collide
 * on exactly the screen you are on all evening.
 */
export function LiveTastingStrip(){
  const {tasting}=useActiveTasting();
  if(!tasting)return null;
  return <Link className="live-tasting-strip" to={`/tastings/${tasting.id}`}>
    <span className="live-tasting-dot" aria-hidden="true"/>
    <span className="live-tasting-name">{tasting.name}</span>
    <small>Tasting in progress{tasting.venue?` · ${tasting.venue}`:''} · every wine you log joins it</small>
    <span className="live-tasting-chevron" aria-hidden="true">›</span>
  </Link>;
}
