-- Which step of a run a call was. NULL is the run's own work (research,
-- recognition); 'translation' is the Chinese translation a Deep Search or
-- producer research run makes as its last step. It is filed under the run's
-- own kind and run ID, so the run's cost includes it, and the step lets the
-- run's breakdown show it as its own line.
ALTER TABLE ai_usage_events ADD COLUMN step TEXT;
