-- Onboarding progress is a small bag of flags read only by the user it belongs
-- to - never queried across accounts, never joined - so it rides on app_users
-- rather than in a table of its own. authenticate() selects u.*, so the column
-- reaches /api/me without a second read on every page load.
ALTER TABLE app_users ADD COLUMN tour_state TEXT NOT NULL DEFAULT '{}';
