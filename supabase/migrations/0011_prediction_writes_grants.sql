-- 0007_grants.sql granted SELECT on the prediction tables but not the writes
-- needed by submit_predictions (which is security invoker). Without these,
-- POST /api/predictions surfaces as a 400 'request failed' because Postgres
-- raises 'permission denied for table predictions' before RLS is consulted.
-- RLS still scopes which rows a user can write.

grant insert, update, delete on
    public.predictions,
    public.group_predictions,
    public.knockout_predictions
  to authenticated;
