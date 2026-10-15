-- Local preparation only: apply separately after reviewing the recovered database.
-- Fail quickly instead of waiting behind live transactions during application.
set lock_timeout = '3s';
create index if not exists chat_giveaways_type_created_read_idx on public.chat_giveaways (giveaway_type, created_at desc);
create index if not exists chat_giveaways_type_finished_read_idx on public.chat_giveaways (giveaway_type, finished_at desc) where winner_username is not null;
create index if not exists rewards_paid_created_read_idx on public.rewards (created_at desc) where paid = true;
reset lock_timeout;
