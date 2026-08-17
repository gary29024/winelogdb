const safeExtension = (type: string) => ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic'}[type] ?? 'bin');
export function createObjectKey(ownerId: string, contentType: string, now = new Date(), id: string = crypto.randomUUID()): string {
  const owner = ownerId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return `owners/${owner}/${now.toISOString().slice(0, 10)}/${id}.${safeExtension(contentType)}`;
}
