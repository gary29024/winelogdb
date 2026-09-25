-- A member's explicit Deep Search "Check status" runs bounded maintenance for
-- one operation. Record when it last ran so repeated clicks or a stuck client
-- cannot repeat that work more than once per cooldown window.
ALTER TABLE credit_operations ADD COLUMN checked_at INTEGER;
