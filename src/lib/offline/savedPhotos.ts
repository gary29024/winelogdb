/**
 * Label photos kept on this device, so the wines you have looked at still show
 * their label when there is no connection.
 *
 * Only the small version of a photo (the one used in lists and on a wine's
 * page) is kept, and only after the server has handed it over to this
 * account. Photos live beside the saved copies of screens: one database per
 * account, deleted on sign-out or when a different person signs in, and
 * limited in number so the phone's storage is not eaten up.
 */
import {
  browserDeviceStore,
  connectionFailed,
  deleteWithSavedReads,
  savedReadsOwner,
  type DeviceStore,
} from './savedReads';

/** About 30 MB at the usual size of a small photo; the oldest go first. */
export const MAX_SAVED_PHOTOS = 500;

const browserStore = browserDeviceStore<Blob>('winelog-saved-photos:', MAX_SAVED_PHOTOS);
let store: DeviceStore<Blob> = browserStore;
deleteWithSavedReads((scope) => store.clear(scope));

/** Tests only: keep photos somewhere other than the browser's database. */
export function setSavedPhotosStore(next: DeviceStore<Blob> | null) {
  store = next ?? browserStore;
}

/** File a small photo that just arrived. Never waited for; a full database is not an error. */
export function rememberPhoto(imageId: string, photo: Blob) {
  const owner = savedReadsOwner();
  if (!owner || !photo.size) return;
  void store.put(owner, imageId, { value: photo, at: Date.now() }).catch(() => null);
}

export async function recallPhoto(imageId: string): Promise<Blob | undefined> {
  const owner = savedReadsOwner();
  if (!owner) return undefined;
  try {
    return (await store.get(owner, imageId))?.value;
  } catch {
    return undefined;
  }
}

/**
 * Fetch a photo, keeping the small version, and fall back to the kept one when
 * the server cannot be reached at all. A full-size photo asked for with no
 * connection gets the small version too, which is better than nothing;
 * `standIn` says so, so the caller does not hold on to it as the real thing.
 */
export async function photoKeepingCopy(
  imageId: string,
  variant: 'thumbnail' | 'original',
  fetchPhoto: () => Promise<Blob>,
): Promise<{ photo: Blob; standIn: boolean }> {
  try {
    const photo = await fetchPhoto();
    if (variant === 'thumbnail') rememberPhoto(imageId, photo);
    return { photo, standIn: false };
  } catch (error) {
    if (!connectionFailed(error)) throw error;
    const photo = await recallPhoto(imageId);
    if (!photo) throw error;
    return { photo, standIn: variant === 'original' };
  }
}
