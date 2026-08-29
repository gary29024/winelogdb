import { lazy,Suspense,useEffect,useState,type ReactNode } from 'react';
import { BrowserRouter,Navigate,Route,Routes,useParams } from 'react-router-dom';
import { Layout } from './components/Layout';
import { hasSession } from './lib/auth/client';
import type { WineRecord } from './lib/db/schema';

const LibraryPage=lazy(()=>import('./features/wines/LibraryPage').then(module=>({default:module.LibraryPage})));
const DetailPage=lazy(()=>import('./features/wines/DetailPage').then(module=>({default:module.DetailPage})));
const UploadPage=lazy(()=>import('./features/uploads/UploadPage').then(module=>({default:module.UploadPage})));
const GroupScanPage=lazy(()=>import('./features/uploads/GroupScanPage').then(module=>({default:module.GroupScanPage})));
const BatchScanPage=lazy(()=>import('./features/uploads/BatchScanPage').then(module=>({default:module.BatchScanPage})));
const WineForm=lazy(()=>import('./features/wines/WineForm').then(module=>({default:module.WineForm})));
const LoginPage=lazy(()=>import('./features/auth/LoginPage').then(module=>({default:module.LoginPage})));
const ProducersPage=lazy(()=>import('./features/producers/ProducersPage').then(module=>({default:module.ProducersPage})));
const ProducerDetailPage=lazy(()=>import('./features/producers/ProducerDetailPage').then(module=>({default:module.ProducerDetailPage})));
const ResearchCampaignPage=lazy(()=>import('./features/producers/ResearchCampaignPage').then(module=>({default:module.ResearchCampaignPage})));
const PassportPage=lazy(()=>import('./features/journey/PassportPage').then(module=>({default:module.PassportPage})));
const InsightsPage=lazy(()=>import('./features/journey/InsightsPage').then(module=>({default:module.InsightsPage})));
const AchievementsPage=lazy(()=>import('./features/achievements/AchievementsPage').then(module=>({default:module.AchievementsPage})));
const AchievementDetailPage=lazy(()=>import('./features/achievements/AchievementDetailPage').then(module=>({default:module.AchievementDetailPage})));
const CollectionEditorPage=lazy(()=>import('./features/achievements/CollectionEditorPage').then(module=>({default:module.CollectionEditorPage})));
const TastingsPage=lazy(()=>import('./features/tastings/TastingsPage').then(module=>({default:module.TastingsPage})));
const TastingDetailPage=lazy(()=>import('./features/tastings/TastingDetailPage').then(module=>({default:module.TastingDetailPage})));
const TastingSheetPage=lazy(()=>import('./features/tastings/TastingSheetPage').then(module=>({default:module.TastingSheetPage})));

function Edit(){
 const {id}=useParams(),[w,setW]=useState<WineRecord>(),[failed,setFailed]=useState(false);
 useEffect(()=>{
  if(!id)return;
  let active=true;setFailed(false);
  import('./features/wines/api').then(({getWine})=>getWine(id)).then(wine=>{if(active)setW(wine)}).catch(()=>{if(active)setFailed(true)});
  return()=>{active=false};
 },[id]);
 if(failed)return <p role="alert">Could not load wine.</p>;
 return w?<section><h1>Edit {w.wineName}</h1><WineForm id={id} initial={w}/></section>:<p>Loading wine…</p>;
}
function RequireSession({children}:{children:ReactNode}){return hasSession()?children:<Navigate to="/login" replace/>}
function RouteFallback(){return <p className="route-loading" aria-live="polite">Loading…</p>}

export default function App(){return <BrowserRouter><Suspense fallback={<RouteFallback/>}><Routes><Route path="/login" element={<LoginPage/>}/><Route element={<RequireSession><Layout/></RequireSession>}><Route index element={<PassportPage/>}/><Route path="passport" element={<Navigate to="/" replace/>}/><Route path="journal" element={<LibraryPage/>}/><Route path="producers" element={<ProducersPage/>}/><Route path="producers/research-batch" element={<ResearchCampaignPage/>}/><Route path="producers/:id" element={<ProducerDetailPage/>}/><Route path="insights" element={<InsightsPage/>}/><Route path="achievements" element={<AchievementsPage/>}/><Route path="achievements/new" element={<CollectionEditorPage/>}/><Route path="achievements/:id/edit" element={<CollectionEditorPage/>}/><Route path="achievements/:id" element={<AchievementDetailPage/>}/><Route path="tastings" element={<TastingsPage/>}/><Route path="tastings/:id" element={<TastingDetailPage/>}/><Route path="tastings/:id/sheet" element={<TastingSheetPage/>}/><Route path="upload" element={<UploadPage/>}/><Route path="group-scan" element={<GroupScanPage/>}/><Route path="batch-scan" element={<BatchScanPage/>}/><Route path="wines/new" element={<section><h1>Add wine</h1><WineForm/></section>}/><Route path="wines/:id" element={<DetailPage/>}/><Route path="wines/:id/edit" element={<Edit/>}/></Route></Routes></Suspense></BrowserRouter>}
