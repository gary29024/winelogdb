-- The cru tier is derived from the place tree and the label text, and the
-- derivation cannot always reach the right answer: "Vosne Romanee Suchots"
-- names no cru marker at all, so nothing says premier cru. This column records
-- a tier chosen by hand, which the derivation then defers to.
--
-- Null means derive, as before. 'none' means explicitly no tier, which is the
-- only way to clear one the tree insists on. classification stays the effective
-- value, so everything reading it - Insights, the detail pill - is unchanged.
ALTER TABLE wines ADD COLUMN classification_override TEXT;
