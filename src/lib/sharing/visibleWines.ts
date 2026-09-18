/**
 * Whether this account currently has at least one wine shared into it.
 *
 * This deliberately checks grants directly rather than scanning the visible-wine
 * view. Journal/Journey use the answer to retain their existing owner-only fast
 * path when there is nothing shared to merge.
 */
export async function hasIncomingSharedWines(db:D1Database,viewer:string){
  const row=await db.prepare(`
    SELECT 1 AS found
    FROM wine_shares s
    JOIN friendships f ON f.user_id=s.recipient_id AND f.friend_id=s.owner_id
    JOIN app_users u ON u.id=s.owner_id AND u.status='active'
    WHERE s.recipient_id=?
    UNION ALL
    SELECT 1 AS found
    FROM tasting_shares ts
    JOIN friendships f ON f.user_id=ts.recipient_id AND f.friend_id=ts.owner_id
    JOIN app_users u ON u.id=ts.owner_id AND u.status='active'
    JOIN wine_experiences we ON we.owner_id=ts.owner_id AND we.tasting_id=ts.tasting_id
    WHERE ts.recipient_id=?
    LIMIT 1
  `).bind(viewer,viewer).first<{found:number}>();
  return Boolean(row);
}
