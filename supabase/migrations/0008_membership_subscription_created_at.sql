-- Store the Stripe subscription creation timestamp that made the membership row
-- authoritative. Webhook handling uses it to ignore older created/updated
-- events for superseded subscriptions.

alter table memberships
  add column if not exists stripe_subscription_created_at timestamptz;

-- We cannot reconstruct Stripe's exact subscription.created timestamp from the
-- database alone, but row creation time is a safer legacy authority than NULL:
-- old subscription events created before the local row are ignored, and future
-- Stripe/webhook reconciliation overwrites this with the exact Stripe value.
update memberships
set stripe_subscription_created_at = created_at
where stripe_subscription_id is not null
  and stripe_subscription_created_at is null;
