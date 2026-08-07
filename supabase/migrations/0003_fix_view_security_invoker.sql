-- Security fix: make the question_answer_groups view respect Row Level Security.
--
-- The view was created (0001_init.sql) without `security_invoker`, so it runs with
-- the privileges of its owner (the table owner), who is exempt from RLS. Combined
-- with the `grant select ... to anon` in 0002_rls.sql, that let anyone holding the
-- public anon key read every room's answers and participants, bypassing the room
-- scoping enforced on the base tables.
--
-- security_invoker = true makes the view execute as the querying role, so the base
-- tables' RLS policies (room_id = jwt_room_id()) apply to reads through the view too.

alter view question_answer_groups set (security_invoker = true);
