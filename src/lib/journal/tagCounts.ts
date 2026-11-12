/**
 * The hashtags on someone's wines, with how many wines carry each.
 *
 * Tags are kept as a small list on every wine. Two spellings that differ only
 * in capitals or surrounding spaces ("Birthday", " birthday") are one tag; the
 * spelling shown is the first in alphabetical order. A wine counts once per tag
 * however many times the tag was typed on it. Only the person's own wines are
 * read: wines shared by friends carry their owner's tags, not the reader's.
 */
export type TagCount = { tag: string; wines: number };

/** Plenty for a list to tap from; the rest are still found by typing #. */
export const TAG_LIST_LIMIT = 60;

export async function listTagCounts(db: D1Database, owner: string, limit = TAG_LIST_LIMIT): Promise<TagCount[]> {
  const rows = await db
    .prepare(
      `SELECT min(trim(j.value)) AS tag, count(DISTINCT w.id) AS wines
         FROM wines w, json_each(w.tags_json) j
        WHERE w.owner_id=? AND json_valid(w.tags_json) AND j.type='text' AND trim(j.value)<>''
        GROUP BY lower(trim(j.value))
        ORDER BY wines DESC, lower(trim(j.value)) ASC
        LIMIT ?`,
    )
    .bind(owner, limit)
    .all<{ tag: string; wines: number }>();
  return rows.results.map((row) => ({ tag: String(row.tag), wines: Number(row.wines) }));
}
