-- CIPHER teams
-- Run this migration in the Supabase SQL editor.

-- WARNING: This resets all team data, memberships, policies, and functions.
-- Run this only when you are ready to remove the existing team setup.
drop function if exists public.create_cipher_team(text);
drop function if exists public.join_cipher_team(text);
drop table if exists public.team_members cascade;
drop table if exists public.teams cascade;

create table if not exists public.teams (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(trim(name)) between 2 and 80),
    join_code text not null unique
        check (join_code ~ '^[A-Z0-9]{8}$'),
    created_by uuid not null references auth.users(id) on delete restrict,
    created_at timestamptz not null default now()
);

create table if not exists public.team_members (
    team_id uuid not null references public.teams(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null default 'member'
        check (role in ('captain', 'member')),
    joined_at timestamptz not null default now(),
    primary key (team_id, user_id),
    unique (user_id, team_id)
);

create index if not exists team_members_user_id_idx
    on public.team_members(user_id);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

create policy "Members can view their teams"
on public.teams for select
to authenticated
using (
    exists (
        select 1
        from public.team_members
        where team_members.team_id = teams.id
          and team_members.user_id = auth.uid()
    )
);

create policy "Members can view team membership"
on public.team_members for select
to authenticated
using (
    user_id = auth.uid()
);

create or replace function public.create_cipher_team(team_name text)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
    new_team public.teams;
    new_code text;
begin
    if auth.uid() is null then
        raise exception 'You must be signed in to create a team';
    end if;

    loop
        new_code := upper(substr(gen_random_uuid()::text, 1, 8));
        exit when not exists (
            select 1 from public.teams where join_code = new_code
        );
    end loop;

    if char_length(trim(team_name)) not between 2 and 80 then
        raise exception 'Team name must contain 2 to 80 characters';
    end if;

    insert into public.teams (name, join_code, created_by)
    values (trim(team_name), new_code, auth.uid())
    returning * into new_team;

    insert into public.team_members (team_id, user_id, role)
    values (new_team.id, auth.uid(), 'captain');

    return new_team;
end;
$$;

create or replace function public.join_cipher_team(team_join_code text)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
    target_team public.teams;
    member_count integer;
begin
    if auth.uid() is null then
        raise exception 'You must be signed in to join a team';
    end if;

    select *
    into target_team
    from public.teams
    where join_code = upper(trim(team_join_code));

    if target_team.id is null then
        raise exception 'That team code is not valid';
    end if;

    if exists (
        select 1
        from public.team_members
        where team_id = target_team.id and user_id = auth.uid()
    ) then
        return target_team;
    end if;

    select count(*)
    into member_count
    from public.team_members
    where team_id = target_team.id;

    if member_count >= 5 then
        raise exception 'This team already has five members';
    end if;

    insert into public.team_members (team_id, user_id)
    values (target_team.id, auth.uid());

    return target_team;
end;
$$;

revoke all on function public.create_cipher_team(text) from public;
grant execute on function public.create_cipher_team(text) to authenticated;
revoke all on function public.join_cipher_team(text) from public;
grant execute on function public.join_cipher_team(text) to authenticated;
