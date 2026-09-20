import { PageHeader } from '../../components/PageHeader';
import { Link } from 'react-router-dom';
import { JournalScopeTabs } from '../wines/JournalScopeTabs';
import { CellarScope } from './CellarScope';
import '../../cellar.css';

export default function CellarPage(){
  return <section className="journal-page cellar-page">
    <PageHeader title="Journal" subtitle="Bottles in your cellar." className="journal-heading"/>
    <div className="journal-scope-row">
      <JournalScopeTabs scope="cellar"/>
      <Link className="journal-tastings-link" to="/tastings">Browse your tastings <span aria-hidden="true">›</span></Link>
    </div>
    <CellarScope/>
  </section>;
}
