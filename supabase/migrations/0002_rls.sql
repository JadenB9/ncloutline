-- NCL Arena RLS policies
-- run this AFTER 0001_init.sql in the Supabase SQL Editor.
--
-- Our app signs its own JWT with Supabase's JWT secret (grab it from
-- Supabase Dashboard -> Settings -> API -> JWT Settings) and passes it
-- as the Authorization: Bearer <token> header on the client side so that
-- PostgREST's auth.jwt() function can read our custom claims.
--
-- Claims we set:
--   room_id      - uuid of the room the user is in
--   fingerprint  - stable per-member id we generate server-side
--   display_name - the name shown to other members
--
-- Server-side admin writes (create room, etc.) use the service role key,
-- which bypasses RLS entirely.

alter table rooms              enable row level security;
alter table room_members       enable row level security;
alter table sections           enable row level security;
alter table questions          enable row level security;
alter table answer_submissions enable row level security;
alter table answer_strikes     enable row level security;
alter table discussion_messages enable row level security;
alter table activity_events    enable row level security;
alter table rate_limit_events  enable row level security;

-- helper: pull the room_id claim out of our JWT
create or replace function jwt_room_id()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'room_id','')::uuid;
$$;

create or replace function jwt_fingerprint()
returns text
language sql stable
as $$
  select current_setting('request.jwt.claims', true)::json->>'fingerprint';
$$;

-- rooms: a member can read only their own room, and never insert/update/delete from the client
create policy rooms_select on rooms
  for select using (id = jwt_room_id());

-- room_members: read-all-in-room, update only your own row
create policy members_select on room_members
  for select using (room_id = jwt_room_id());
create policy members_update_self on room_members
  for update using (
    room_id = jwt_room_id()
    and user_fingerprint = jwt_fingerprint()
  )
  with check (
    room_id = jwt_room_id()
    and user_fingerprint = jwt_fingerprint()
  );

-- sections: anyone in the room can read, write, delete (server validates custom vs hardcoded)
create policy sections_rw on sections
  for all using (room_id = jwt_room_id())
  with check (room_id = jwt_room_id());

-- questions: anyone in the room can read/write; join via sections to check room_id
create policy questions_rw on questions
  for all using (
    exists (
      select 1 from sections s
      where s.id = questions.section_id
        and s.room_id = jwt_room_id()
    )
  )
  with check (
    exists (
      select 1 from sections s
      where s.id = questions.section_id
        and s.room_id = jwt_room_id()
    )
  );

-- answer_submissions: read any in room, write only your own
create policy submissions_select on answer_submissions
  for select using (room_id = jwt_room_id());
create policy submissions_insert_self on answer_submissions
  for insert with check (
    room_id = jwt_room_id()
    and user_fingerprint = jwt_fingerprint()
  );
create policy submissions_update_self on answer_submissions
  for update using (
    room_id = jwt_room_id()
    and user_fingerprint = jwt_fingerprint()
  )
  with check (
    room_id = jwt_room_id()
    and user_fingerprint = jwt_fingerprint()
  );
create policy submissions_delete_self on answer_submissions
  for delete using (
    room_id = jwt_room_id()
    and user_fingerprint = jwt_fingerprint()
  );

-- strikes: toggle one per submission per user
create policy strikes_rw on answer_strikes
  for all using (
    exists (
      select 1 from answer_submissions s
      where s.id = answer_strikes.submission_id
        and s.room_id = jwt_room_id()
    )
  )
  with check (
    user_fingerprint = jwt_fingerprint()
    and exists (
      select 1 from answer_submissions s
      where s.id = answer_strikes.submission_id
        and s.room_id = jwt_room_id()
    )
  );

-- discussion: anyone in the room can read, insert as self
create policy discussion_select on discussion_messages
  for select using (room_id = jwt_room_id());
create policy discussion_insert_self on discussion_messages
  for insert with check (
    room_id = jwt_room_id()
    and user_fingerprint = jwt_fingerprint()
  );

-- activity feed: read-only to room members (server writes via service role)
create policy activity_select on activity_events
  for select using (room_id = jwt_room_id());

-- rate limit events: service role only, never exposed to clients
-- (no policy = denied by RLS; service role bypasses RLS)

-- grants: let the anon role talk to the tables with RLS on top
grant select on rooms, room_members, sections, questions,
  answer_submissions, answer_strikes, discussion_messages,
  activity_events to anon, authenticated;
grant insert, update, delete on room_members, sections, questions,
  answer_submissions, answer_strikes, discussion_messages to anon, authenticated;
grant select on question_answer_groups to anon, authenticated;

-- enable realtime for the tables the room workspace listens to
alter publication supabase_realtime add table sections;
alter publication supabase_realtime add table questions;
alter publication supabase_realtime add table answer_submissions;
alter publication supabase_realtime add table answer_strikes;
alter publication supabase_realtime add table discussion_messages;
alter publication supabase_realtime add table activity_events;
alter publication supabase_realtime add table room_members;
