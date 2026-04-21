-- Offer negotiation: chain offers, creator tracking, single pending per conversation, participant inserts

do $migration$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    where t.typname = 'offer_status'
      and e.enumlabel = 'countered'
  ) then
    alter type public.offer_status add value 'countered';
  end if;
end
$migration$;

alter table public.offers
  add column if not exists parent_offer_id uuid references public.offers(id) on delete set null;

alter table public.offers
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.offers
  add column if not exists notes text;

update public.offers
set created_by = landlord_id
where created_by is null;

alter table public.offers
  alter column created_by set not null;

-- Legacy rows: multiple pending offers per conversation breaks the partial unique index.
-- Keep the newest pending row per conversation; mark older duplicates cancelled.
with ranked as (
  select
    id,
    row_number() over (
      partition by conversation_id
      order by created_at desc nulls last, id desc
    ) as rn
  from public.offers
  where status = 'pending'
)
update public.offers o
set
  status = 'cancelled'::public.offer_status,
  updated_at = timezone('utc'::text, now())
from ranked r
where o.id = r.id
  and r.rn > 1;

create unique index if not exists idx_offers_one_pending_per_conversation
  on public.offers (conversation_id)
  where status = 'pending';

drop policy if exists "Landlord can create offers" on public.offers;

create policy "Participants can create offers"
  on public.offers
  for insert
  with check (auth.uid() = landlord_id or auth.uid() = renter_id);
