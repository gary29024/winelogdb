export type RecognitionPhotoMetadata={
  capturedAt?:string|null;
  latitude?:number|null;
  longitude?:number|null;
  source?:'exif'|'file_fallback'|'none';
};

export type SelectedRecognitionMetadata={
  capturedAt:string|null;
  latitude:number|null;
  longitude:number|null;
  timestampSource:'exif'|'file_fallback'|'none';
  gpsSource:'exif'|'none';
};

const validLatitude=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=-90&&value<=90;
const validLongitude=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=-180&&value<=180;
const validTimestamp=(value:unknown)=>typeof value==='string'&&!Number.isNaN(Date.parse(value));

export function selectRecognitionMetadata(input:RecognitionPhotoMetadata[]|null|undefined):SelectedRecognitionMetadata{
  // A request that omits the metadata field parses as JSON null rather than as
  // the intended empty list, so this has to accept "no metadata" as a shape and
  // not only as an empty array - otherwise every such scan is a 500.
  const items=Array.isArray(input)?input:[];
  const exifTimestamp=items.find(item=>item.source==='exif'&&validTimestamp(item.capturedAt));
  const fallbackTimestamp=items.find(item=>validTimestamp(item.capturedAt));
  const timestamp=exifTimestamp??fallbackTimestamp;
  const gps=items.find(item=>validLatitude(item.latitude)&&validLongitude(item.longitude));
  return {
    capturedAt:timestamp?.capturedAt?new Date(timestamp.capturedAt).toISOString():null,
    latitude:gps&&validLatitude(gps.latitude)?gps.latitude:null,
    longitude:gps&&validLongitude(gps.longitude)?gps.longitude:null,
    timestampSource:timestamp?.source==='exif'?'exif':timestamp?.source==='file_fallback'?'file_fallback':'none',
    gpsSource:gps?'exif':'none'
  };
}
