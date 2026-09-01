import { Link } from 'react-router-dom';
import { JournalScopeTabs } from '../wines/JournalScopeTabs';
import { CellarScope } from './CellarScope';
import '../../cellar.css';

export default function CellarPage(){
  return <section className="journal-page cellar-page">
    <div className="hero journal-hero"><p className="eyebrow">YOUR CELLAR</p><h1>Bottles still waiting.</h1><p>What you hold, kept apart from what you have drunk — and out of every statistic until you open one.</p></div>
    <div className="journal-scope-row">
      <JournalScopeTabs scope="cellar"/>
      <Link className="journal-tastings-link" to="/tastings">Browse your tastings <span aria-hidden="true">›</span></Link>
    </div>
    <CellarScope/>
  </section>;
}
