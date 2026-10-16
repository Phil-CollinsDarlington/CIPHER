-- CIPHER achievements
-- Run this migration in the Supabase SQL editor.

create table if not exists public.achievements (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    description text not null,
    icon text not null default '✧',
    created_at timestamptz not null default now()
);

create table if not exists public.user_achievements (
    user_id uuid not null references auth.users(id) on delete cascade,
    achievement_id uuid not null references public.achievements(id) on delete cascade,
    awarded_at timestamptz not null default now(),
    primary key (user_id, achievement_id)
);

alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

create policy "Players can view achievement catalogue"
on public.achievements for select
to authenticated
using (true);

create policy "Players can view their earned achievements"
on public.user_achievements for select
to authenticated
using (user_id = auth.uid());

insert into public.achievements (name, description, icon)
values
    ('First Signal', 'Complete your first CIPHER checkpoint.', '✦'),
    ('Pattern Seeker', 'Complete five CIPHER checkpoints.', '◈'),
    ('Cipher Veteran', 'Complete ten CIPHER checkpoints.', '★')
on conflict (name) do nothing;
