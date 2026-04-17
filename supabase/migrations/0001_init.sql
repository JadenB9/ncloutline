-- NCL Arena schema
-- run this first in Supabase SQL Editor

create extension if not exists pgcrypto;

-- rooms: a workspace anyone with the code (and token, if set) can join
create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  token_hash text,
  created_at timestamptz default now(),
  creator_fingerprint text not null
);

-- room_members: per-user presence record inside a room
create table room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade not null,
  user_fingerprint text not null,
  display_name text not null,
  color text not null,
  last_section_id uuid,
  joined_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  unique(room_id, user_fingerprint)
);

-- sections: NCL categories (hardcoded keys) plus custom per-room sections
create table sections (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade not null,
  name text not null,
  category_key text,
  is_custom boolean default false,
  order_index int not null,
  created_at timestamptz default now()
);

-- questions: one challenge per row, grouped by difficulty within a section
create table questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references sections(id) on delete cascade not null,
  difficulty text check (difficulty in ('easy','medium','hard')) not null,
  prompt text default '',
  notes text default '',
  flag text default '',
  points int default 0,
  status text default 'not_started'
    check (status in ('not_started','in_progress','solved')),
  ydoc_state bytea,
  claimed_by uuid references room_members(id) on delete set null,
  claimed_at timestamptz,
  solved_at timestamptz,
  order_index int not null,
  updated_at timestamptz default now()
);

-- answer_submissions: each user's proposed answer + their personal confidence
-- team confidence is derived: group by normalized value, sum per-user confidence,
-- weight by fraction of team agreeing
create table answer_submissions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete cascade not null,
  room_id uuid references rooms(id) on delete cascade not null,
  user_fingerprint text not null,
  display_name text not null,
  color text not null,
  value text not null default '',
  value_normalized text generated always as (lower(trim(value))) stored,
  confidence int default 50 check (confidence between 0 and 100),
  status text default 'proposed'
    check (status in ('proposed','dismissed','accepted')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(question_id, user_fingerprint)
);

-- strikes: lightweight downvote so the team can flag answers that didn't work
create table answer_strikes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references answer_submissions(id) on delete cascade not null,
  user_fingerprint text not null,
  created_at timestamptz default now(),
  unique(submission_id, user_fingerprint)
);

-- discussion: per-question chat thread (lightweight, not collaborative)
create table discussion_messages (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete cascade not null,
  room_id uuid references rooms(id) on delete cascade not null,
  user_fingerprint text not null,
  display_name text not null,
  color text not null,
  body text not null,
  created_at timestamptz default now()
);

-- rate_limit_events: Postgres-backed sliding window limiter.
-- written to on every ratelimited API call. counts rows in the window to decide.
-- worker or cron cleans out old rows (see cleanup_rate_limits below).
create table rate_limit_events (
  id bigserial primary key,
  bucket text not null,           -- e.g. "join:1.2.3.4" or "create:1.2.3.4"
  created_at timestamptz default now()
);

create index idx_rate_limit_bucket_time
  on rate_limit_events(bucket, created_at desc);

create or replace function check_rate_limit(
  p_bucket text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from rate_limit_events
  where bucket = p_bucket
    and created_at > now() - (p_window_seconds || ' seconds')::interval;

  if recent_count >= p_max then
    return false;
  end if;

  insert into rate_limit_events (bucket) values (p_bucket);
  return true;
end;
$$;

-- periodic cleanup: anything older than a day is dead weight
create or replace function cleanup_rate_limits()
returns void
language sql
as $$
  delete from rate_limit_events where created_at < now() - interval '1 day';
$$;

-- activity: stream shown in the right sidebar
create table activity_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade not null,
  actor_fingerprint text,
  actor_display_name text,
  actor_color text,
  verb text not null,
  target_type text,
  target_id uuid,
  payload jsonb,
  created_at timestamptz default now()
);

-- indexes for the queries we actually run
create index idx_sections_room on sections(room_id, order_index);
create index idx_questions_section on questions(section_id, difficulty, order_index);
create index idx_submissions_question on answer_submissions(question_id);
create index idx_submissions_room on answer_submissions(room_id);
create index idx_strikes_submission on answer_strikes(submission_id);
create index idx_discussion_question on discussion_messages(question_id, created_at);
create index idx_activity_room on activity_events(room_id, created_at desc);
create index idx_members_room on room_members(room_id);

-- keep questions.updated_at fresh so the right sidebar can sort activity
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger questions_touch
before update on questions
for each row execute procedure touch_updated_at();

create trigger submissions_touch
before update on answer_submissions
for each row execute procedure touch_updated_at();

-- view used by the question card to render the team confidence bar
-- groups matching answers, sums per-user confidence, weights by agreer fraction
create or replace view question_answer_groups as
with totals as (
  select question_id, count(*)::float as total
  from answer_submissions
  where status <> 'dismissed'
  group by question_id
),
grouped as (
  select
    s.question_id,
    s.value_normalized,
    min(s.value) as display_value,
    count(*)::int as agreer_count,
    coalesce(avg(s.confidence),0)::float as avg_confidence,
    coalesce(sum(s.confidence),0)::float as sum_confidence,
    array_agg(json_build_object(
      'fingerprint', s.user_fingerprint,
      'name', s.display_name,
      'color', s.color,
      'confidence', s.confidence,
      'submission_id', s.id
    ) order by s.updated_at desc) as submissions
  from answer_submissions s
  where s.status <> 'dismissed' and s.value_normalized <> ''
  group by s.question_id, s.value_normalized
)
select
  g.question_id,
  g.value_normalized,
  g.display_value,
  g.agreer_count,
  g.avg_confidence,
  g.submissions,
  -- team confidence: avg personal confidence * (fraction agreeing),
  -- clamped 0..100. A lone 90% vote scores lower than 3 people at 70%.
  round(
    least(100, greatest(0,
      g.avg_confidence * (g.agreer_count::float / nullif(t.total,0))
      + (g.agreer_count - 1) * 8
    ))
  )::int as team_confidence
from grouped g
join totals t using (question_id);
