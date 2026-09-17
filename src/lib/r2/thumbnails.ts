// Keep old versions in this list if the thumbnail recipe changes, so deleting
// a photo also removes derivatives produced by previous versions.
export const THUMBNAIL_VERSION='v1';
const THUMBNAIL_VERSIONS=[THUMBNAIL_VERSION];
export const thumbnailObjectKey=(originalKey:string,version=THUMBNAIL_VERSION)=>`thumb/${version}/${originalKey}.webp`;
export const photoObjectKeys=(originalKey:string)=>[originalKey,...THUMBNAIL_VERSIONS.map(version=>thumbnailObjectKey(originalKey,version))];
