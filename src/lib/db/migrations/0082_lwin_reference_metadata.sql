ALTER TABLE wines ADD COLUMN reference_site TEXT;
ALTER TABLE wines ADD COLUMN reference_parcel TEXT;
ALTER TABLE wines ADD COLUMN identity_match_candidates_json TEXT;
ALTER TABLE wines ADD COLUMN identity_checked_at TEXT;
