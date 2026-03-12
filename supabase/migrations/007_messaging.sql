-- =============================================================================
-- Messaging system: conversations, participants, messages, and RLS
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

-- 1. Enum types for context and participant roles
do $$
begin
  if not exists (select 1 from pg_type where typname = 'conversation_context_type') then
    create type public.conversation_context_type as enum ('listing', 'contractor', 'general');
  end if;

  if not exists (select 1 from pg_type where typname = 'conversation_participant_role') then
    create type public.conversation_participant_role as enum ('landlord', 'renter', 'contractor');
  end if;
end $$;

-- 2. Conversations table
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid not null references auth.users(id) on delete cascade,
  context_type public.conversation_context_type not null default 'general',
  context_listing_id uuid references public.listings(id) on delete cascade,
  context_contractor_id uuid references public.contractors(id) on delete cascade,
  last_message_at timestamptz,
  last_message_preview text
);

create index if not exists idx_conversations_last_message_at
  on public.conversations (last_message_at desc nulls last);

-- 3. Conversation participants
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.conversation_participant_role,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create index if not exists idx_conversation_participants_user_id
  on public.conversation_participants (user_id);

-- 4. Messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_messages_conversation_created_at
  on public.messages (conversation_id, created_at desc);

-- 5. Enable RLS
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- 6. RLS policies

-- Helper: check if current user is a participant in a conversation
create or replace function public.is_conversation_participant(conv_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conv_id
      and cp.user_id = auth.uid()
  );
$$;

-- Conversations: participants can select
create policy "Participants can view conversations"
  on public.conversations
  for select
  using (public.is_conversation_participant(id));

-- Conversations: creator can insert (API will also insert participants)
create policy "Authenticated can create conversations"
  on public.conversations
  for insert
  with check (auth.role() = 'authenticated');

-- Conversation participants: participants can view their own rows
create policy "Participants can view conversation_participants"
  on public.conversation_participants
  for select
  using (auth.uid() = user_id or public.is_conversation_participant(conversation_id));

-- Conversation participants: allow inserting rows when the user is in the conversation set-up
create policy "Authenticated can add conversation_participants"
  on public.conversation_participants
  for insert
  with check (auth.role() = 'authenticated');

-- Conversation participants: users can update their own last_read_at
create policy "Users can update their own participant row"
  on public.conversation_participants
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Messages: only participants can read messages
create policy "Participants can read messages"
  on public.messages
  for select
  using (public.is_conversation_participant(conversation_id));

-- Messages: only participants can send messages
create policy "Participants can send messages"
  on public.messages
  for insert
  with check (
    auth.uid() = sender_id
    and public.is_conversation_participant(conversation_id)
  );

