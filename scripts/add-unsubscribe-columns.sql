-- Adds unsubscribe tracking columns to the "Cold Email" table.
-- Run this in the Supabase SQL Editor ONCE before shipping the unsubscribe feature.
--
-- `unsubscribed_at`    : when the contact clicked the unsubscribe link.
-- `unsubscribe_reason` : optional free-text reason from the confirmation page.
--
-- The existing boolean `opted_out` column is still used for exclusion in the
-- workflow query; unsubscribe sets BOTH `opted_out = true` AND
-- `unsubscribed_at = now()` so (a) the existing filter keeps working and
-- (b) we have an audit timestamp + reason for each unsubscribe.
--
-- Safe to re-run (IF NOT EXISTS).

ALTER TABLE "Cold Email"
  ADD COLUMN IF NOT EXISTS unsubscribed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS unsubscribe_reason text;

-- Optional: index if you ever want to report/filter on unsubscribes quickly.
CREATE INDEX IF NOT EXISTS cold_email_unsubscribed_at_idx
  ON "Cold Email" (unsubscribed_at)
  WHERE unsubscribed_at IS NOT NULL;
