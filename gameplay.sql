-- CIPHER Phase 1 gameplay
-- Run after the challenge_checkpoints and checkpoint_answers tables exist.

create table if not exists public.checkpoint_submissions (
    id uuid primary key default gen_random_uuid(),
    checkpoint_id uuid not null
        references public.challenge_checkpoints(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    submitted_answer text not null,
    is_correct boolean not null,
    points_awarded integer not null default 0 check (points_awarded >= 0),
    submitted_at timestamptz not null default now()
);

create index if not exists checkpoint_submissions_user_idx
    on public.checkpoint_submissions(user_id, submitted_at desc);

create unique index if not exists checkpoint_submissions_success_idx
    on public.checkpoint_submissions(checkpoint_id, user_id)
    where is_correct = true;

alter table public.checkpoint_submissions enable row level security;

drop policy if exists "Players can view their own submissions"
on public.checkpoint_submissions;

create policy "Players can view their own submissions"
on public.checkpoint_submissions for select
to authenticated
using (user_id = auth.uid());

drop function if exists public.submit_checkpoint_answer(uuid, text);

create or replace function public.submit_checkpoint_answer(
    checkpoint_id_input uuid,
    submitted_answer text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    current_checkpoint record;
    normalized_answer text;
    correct_answer boolean;
    points_to_award integer;
begin
    if auth.uid() is null then
        raise exception 'You must be signed in to submit an answer';
    end if;

    normalized_answer := lower(
        regexp_replace(trim(coalesce(submitted_answer, '')), '\s+', ' ', 'g')
    );

    if normalized_answer = '' then
        raise exception 'Enter an answer before submitting';
    end if;

    select
        cp.id,
        cp.points,
        cp.is_published,
        c.status,
        c.starts_at,
        c.ends_at
    into current_checkpoint
    from public.challenge_checkpoints cp
    join public.challenges c on c.id = cp.challenge_id
    where cp.id = checkpoint_id_input;

    if current_checkpoint.id is null then
        raise exception 'This checkpoint does not exist';
    end if;

    if current_checkpoint.is_published is not true
       or current_checkpoint.status not in ('published', 'active') then
        raise exception 'This checkpoint is not currently available';
    end if;

    if current_checkpoint.starts_at is not null
       and now() < current_checkpoint.starts_at then
        raise exception 'This challenge has not started yet';
    end if;

    if current_checkpoint.ends_at is not null
       and now() > current_checkpoint.ends_at then
        raise exception 'This challenge has ended';
    end if;

    if exists (
        select 1
        from public.checkpoint_submissions
        where checkpoint_id = checkpoint_id_input
          and user_id = auth.uid()
          and is_correct = true
    ) then
        raise exception 'You have already completed this checkpoint';
    end if;

    select exists (
        select 1
        from public.checkpoint_answers
        where checkpoint_id = checkpoint_id_input
          and lower(
              regexp_replace(trim(accepted_answer), '\s+', ' ', 'g')
          ) = normalized_answer
    )
    into correct_answer;

    points_to_award := case
        when correct_answer then current_checkpoint.points
        else 0
    end;

    insert into public.checkpoint_submissions (
        checkpoint_id,
        user_id,
        submitted_answer,
        is_correct,
        points_awarded
    )
    values (
        checkpoint_id_input,
        auth.uid(),
        trim(submitted_answer),
        correct_answer,
        points_to_award
    );

    if correct_answer then
        insert into public.user_achievements (user_id, achievement_id)
        select auth.uid(), a.id
        from public.achievements a
        where (
            a.name = 'First Signal'
            and (
                select count(*)
                from public.checkpoint_submissions
                where user_id = auth.uid()
                  and is_correct = true
            ) >= 1
        )
        or (
            a.name = 'Pattern Seeker'
            and (
                select count(*)
                from public.checkpoint_submissions
                where user_id = auth.uid()
                  and is_correct = true
            ) >= 5
        )
        or (
            a.name = 'Cipher Veteran'
            and (
                select count(*)
                from public.checkpoint_submissions
                where user_id = auth.uid()
                  and is_correct = true
            ) >= 10
        )
        on conflict (user_id, achievement_id) do nothing;
    end if;

    return json_build_object(
        'is_correct', correct_answer,
        'points_awarded', points_to_award
    );
end;
$$;

revoke all on function public.submit_checkpoint_answer(uuid, text) from public;
grant execute on function public.submit_checkpoint_answer(uuid, text)
    to authenticated;

create or replace function public.get_player_stats()
returns json
language sql
security definer
set search_path = public
as $$
    select json_build_object(
        'total_points', coalesce(sum(points_awarded), 0),
        'challenges_solved', count(*) filter (where is_correct),
        'achievement_count', (
            select count(*)
            from public.user_achievements
            where user_id = auth.uid()
        ),
        'team_name', (
            select t.name
            from public.team_members tm
            join public.teams t on t.id = tm.team_id
            where tm.user_id = auth.uid()
            order by tm.joined_at
            limit 1
        )
    )
    from public.checkpoint_submissions
    where user_id = auth.uid();
$$;

revoke all on function public.get_player_stats() from public;
grant execute on function public.get_player_stats() to authenticated;

drop function if exists public.get_individual_leaderboard();

create or replace function public.get_individual_leaderboard()
returns table (
    rank bigint,
    display_name text,
    total_points bigint,
    checkpoints_completed bigint
)
language sql
security definer
set search_path = public
as $$
    with scores as (
        select
            s.user_id,
            sum(s.points_awarded)::bigint as total_points,
            count(*)::bigint as checkpoints_completed
        from public.checkpoint_submissions s
        where s.is_correct = true
        group by s.user_id
    ),
    ranked as (
        select
            row_number() over (
                order by total_points desc,
                    checkpoints_completed desc,
                    user_id
            ) as rank,
            user_id,
            total_points,
            checkpoints_completed
        from scores
    )
    select
        r.rank,
        coalesce(p.display_name, 'CIPHER Player') as display_name,
        r.total_points,
        r.checkpoints_completed
    from ranked r
    left join public.profiles p on p.id = r.user_id
    order by r.rank
    limit 100;
$$;

revoke all on function public.get_individual_leaderboard() from public;
grant execute on function public.get_individual_leaderboard() to authenticated;

drop function if exists public.get_team_leaderboard();

create or replace function public.get_team_leaderboard()
returns table (
    rank bigint,
    team_name text,
    total_points bigint,
    checkpoints_completed bigint,
    member_count bigint
)
language sql
security definer
set search_path = public
as $$
    with scores as (
        select
            tm.team_id,
            sum(s.points_awarded)::bigint as total_points,
            count(*)::bigint as checkpoints_completed
        from public.team_members tm
        join public.checkpoint_submissions s on s.user_id = tm.user_id
        where s.is_correct = true
        group by tm.team_id
    ),
    members as (
        select team_id, count(*)::bigint as member_count
        from public.team_members
        group by team_id
    ),
    ranked as (
        select
            row_number() over (
                order by scores.total_points desc,
                    scores.checkpoints_completed desc,
                    scores.team_id
            ) as rank,
            scores.team_id,
            scores.total_points,
            scores.checkpoints_completed
        from scores
    )
    select
        r.rank,
        t.name as team_name,
        r.total_points,
        r.checkpoints_completed,
        m.member_count
    from ranked r
    join public.teams t on t.id = r.team_id
    join members m on m.team_id = r.team_id
    order by r.rank
    limit 100;
$$;

revoke all on function public.get_team_leaderboard() from public;
grant execute on function public.get_team_leaderboard() to authenticated;
