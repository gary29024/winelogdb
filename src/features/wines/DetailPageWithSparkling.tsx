import { useEffect,useState } from 'react';
import { useParams } from 'react-router-dom';
import type { SparklingDetails } from '../../lib/wine/sparklingDetails';
import { DetailPage } from './DetailPage';
import { getWineSparklingDetails } from './api';
import { SparklingDetailsCard } from './SparklingDetailsCard';

export function DetailPageWithSparkling(){
  const {id}=useParams(),[details,setDetails]=useState<SparklingDetails|null>(null);
  useEffect(()=>{
    if(!id)return;
    let live=true;
    getWineSparklingDetails(id).then(result=>{if(live)setDetails(result.details)}).catch(()=>undefined);
    return()=>{live=false};
  },[id]);
  return <><DetailPage/><SparklingDetailsCard details={details}/></>;
}
