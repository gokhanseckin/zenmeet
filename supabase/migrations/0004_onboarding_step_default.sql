-- Fix: new teacher rows skipped the 'account' onboarding step.
--
-- teachers.onboarding_step defaulted to 'classroom' (the SECOND step), but the
-- flow order is ['account','classroom','stripe','provider','schedule','done'].
-- ensureTeacher() inserts a row with only { id }, so a brand-new teacher
-- inherited 'classroom' and was sent straight past the AccountStep form — the
-- only place display_name/timezone are collected — leaving display_name blank.
--
-- Correct the default to the first step so new teachers start at 'account'.
alter table teachers alter column onboarding_step set default 'account';
