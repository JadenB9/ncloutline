-- Make the browser read-only.
--
-- Every write in the app goes through the Next.js API routes, which check the
-- room, validate input and then write with the service role. But 0002_rls.sql
-- also granted insert/update/delete to anon/authenticated, and the room page
-- hands each member their session JWT (role=authenticated, room_id claim) for
-- realtime. With that token anyone in a room could call PostgREST directly and
-- skip the API: delete the built-in category sections, post chat messages or
-- answers under someone else's display name, mark answers "accepted", edit
-- any question column, and so on.
--
-- The browser only needs SELECT (realtime postgres_changes is filtered by the
-- select policies), so take the write grants back. The service role bypasses
-- grants and RLS, so the API routes are unaffected.

revoke insert, update, delete on
  room_members, sections, questions,
  answer_submissions, answer_strikes, discussion_messages
from anon, authenticated;

-- the rate limiter is server-only. functions are executable by PUBLIC by
-- default, which exposed them as /rest/v1/rpc/* endpoints.
revoke execute on function check_rate_limit(text, int, int) from public, anon, authenticated;
revoke execute on function cleanup_rate_limits() from public, anon, authenticated;
grant execute on function check_rate_limit(text, int, int) to service_role;
grant execute on function cleanup_rate_limits() to service_role;
