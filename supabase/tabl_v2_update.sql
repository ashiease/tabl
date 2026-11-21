-- =====================================================================
-- TABL v2 · database update
-- Run once in Supabase → SQL Editor (it is safe to re-run).
-- Everything runs as one transaction: if any step fails, nothing changes.
--
-- What this adds / fixes (numbers match the change list):
--   A1 waitlist hand-off · A2 queue positions · A3 admin reset
--   B6 admin role locked · B7 server sets all times · B8 one table per student
--   B9 break fixes · B10 no direct writes · B11 expiry every 10 s
--   12 push notifications · 16 use an away table until the owner returns
--   18/28 reports + admin inbox · 19 belongings · 22 misuse pause
--   24 suspend/reinstate · 25 resident roster · 27 policy settings
--   29 activity log · 31 announcements · 32 system health · 33 block bookings
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 0. Extensions and the new "blocked" table status (for block bookings)
-- ---------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;
alter type public.table_status add value if not exists 'blocked';

-- ---------------------------------------------------------------------
-- 1. New tables
-- ---------------------------------------------------------------------

-- 27 · rules, editable by the admin
create table if not exists public.app_policy (
  id                   int primary key default 1 check (id = 1),
  session_minutes      int not null default 60  check (session_minutes between 15 and 240),
  break_minutes        int not null default 15  check (break_minutes between 0 and 60),
  hold_minutes         int not null default 5   check (hold_minutes between 1 and 30),
  exam_mode            boolean not null default false,
  exam_session_minutes int not null default 45  check (exam_session_minutes between 15 and 240),
  exam_break_minutes   int not null default 10  check (exam_break_minutes between 0 and 60),
  misuse_limit         int not null default 3   check (misuse_limit between 1 and 20),
  misuse_window_days   int not null default 7   check (misuse_window_days between 1 and 60),
  misuse_pause_hours   int not null default 24  check (misuse_pause_hours between 1 and 168),
  updated_at           timestamptz not null default now(),
  updated_by           uuid
);
insert into public.app_policy (id) values (1) on conflict (id) do nothing;

-- 29 · activity and audit log (kept 90 days)
create table if not exists public.activity_log (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  event    text not null,
  user_id  uuid,
  actor_id uuid,
  table_id text,
  space_id text,
  details  jsonb not null default '{}'::jsonb
);
create index if not exists activity_log_user_idx on public.activity_log (user_id, event, at desc);
create index if not exists activity_log_at_idx   on public.activity_log (at desc);

-- 12 · notifications (also the in-app inbox) and device push tokens
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null,
  title      text not null,
  body       text not null default '',
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  read_at    timestamptz
);
create index if not exists notifications_user_idx    on public.notifications (user_id, created_at desc);
create index if not exists notifications_pending_idx on public.notifications (created_at) where sent_at is null;

create table if not exists public.push_tokens (
  user_id    uuid not null,
  token      text not null,
  platform   text,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- 24 / 22 · suspension and misuse-pause fields on profiles
alter table public.profiles add column if not exists suspended_until  timestamptz;
alter table public.profiles add column if not exists suspended_reason text;
alter table public.profiles add column if not exists pause_cleared_at timestamptz;

-- 25 · resident roster (username = roll number → hostel)
create table if not exists public.residents (
  username    text primary key,
  hostel_id   text not null,
  imported_at timestamptz not null default now()
);

-- 18 / 28 · student reports, handled in the admin inbox
create table if not exists public.reports (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  reporter_id     uuid not null,
  table_id        text not null,
  space_id        text,
  kind            text not null check (kind in
                    ('sitting_without_scanning', 'asked_to_leave', 'belongings_left', 'damaged', 'other')),
  note            text check (char_length(note) <= 500),
  occupant_id     uuid,   -- who held the table when it was reported (filled in by the server)
  status          text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_at     timestamptz,
  resolved_by     uuid,
  admin_note      text check (char_length(admin_note) <= 500)
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);

-- 19 · items left at a table
create table if not exists public.lost_items (
  id          bigint generated always as identity primary key,
  table_id    text not null,
  space_id    text,
  description text not null check (char_length(description) <= 200),
  status      text not null default 'at_table' check (status in ('at_table', 'at_desk', 'returned')),
  created_at  timestamptz not null default now(),
  created_by  uuid,
  updated_at  timestamptz not null default now()
);

-- 31 · announcements (one hall, or everyone when space_id is null)
create table if not exists public.announcements (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  created_by uuid,
  space_id   text,
  title      text not null check (char_length(title) between 1 and 80),
  body       text not null default '' check (char_length(body) <= 500),
  expires_at timestamptz not null
);

-- 33 · block bookings (exams, events); table_ids null = every table in the space
create table if not exists public.block_bookings (
  id           bigint generated always as identity primary key,
  title        text not null check (char_length(title) between 1 and 80),
  space_id     text not null,
  table_ids    text[],
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  cancelled_at timestamptz,
  check (ends_at > starts_at)
);

-- 16 · using an away table until its owner returns
create table if not exists public.table_borrows (
  id               bigint generated always as identity primary key,
  table_id         text not null,
  space_id         text,
  user_id          uuid not null,
  owner_session_id text not null,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  status           text not null default 'active' check (status in ('active', 'ended', 'converted'))
);
create unique index if not exists table_borrows_one_per_table on public.table_borrows (table_id) where status = 'active';
create unique index if not exists table_borrows_one_per_user  on public.table_borrows (user_id)  where status = 'active';

-- A2 · one waiting entry per student per table (older duplicates are retired first)
update public.waitlist w set status = 'expired'
 where w.status = 'waiting'
   and exists (select 1 from public.waitlist o
                where o.user_id = w.user_id and o.table_id = w.table_id and o.status = 'waiting'
                  and (o.created_at, o.id) < (w.created_at, w.id));
create unique index if not exists waitlist_one_per_user_table on public.waitlist (user_id, table_id) where status = 'waiting';

-- ---------------------------------------------------------------------
-- 2. Row-level security
-- ---------------------------------------------------------------------
alter table public.app_policy     enable row level security;
alter table public.activity_log   enable row level security;
alter table public.notifications  enable row level security;
alter table public.push_tokens    enable row level security;
alter table public.residents      enable row level security;
alter table public.reports        enable row level security;
alter table public.lost_items     enable row level security;
alter table public.announcements  enable row level security;
alter table public.block_bookings enable row level security;
alter table public.table_borrows  enable row level security;

drop policy if exists app_policy_read      on public.app_policy;
drop policy if exists activity_admin_read  on public.activity_log;
drop policy if exists notifications_own    on public.notifications;
drop policy if exists residents_admin_read on public.residents;
drop policy if exists reports_read         on public.reports;
drop policy if exists lost_items_read      on public.lost_items;
drop policy if exists announcements_read   on public.announcements;
drop policy if exists blocks_read          on public.block_bookings;
drop policy if exists borrows_read         on public.table_borrows;

create policy app_policy_read      on public.app_policy     for select to authenticated using (true);
create policy activity_admin_read  on public.activity_log   for select to authenticated using (public.is_admin());
create policy notifications_own    on public.notifications  for select to authenticated using (user_id = auth.uid());
create policy residents_admin_read on public.residents      for select to authenticated using (public.is_admin());
create policy reports_read         on public.reports        for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy lost_items_read      on public.lost_items     for select to authenticated using (true);
create policy announcements_read   on public.announcements  for select to authenticated using (expires_at > now() or public.is_admin());
create policy blocks_read          on public.block_bookings for select to authenticated using (true);
create policy borrows_read         on public.table_borrows  for select to authenticated using (true);

-- new tables are read-only from the app; every change goes through the functions below
revoke all on public.app_policy, public.activity_log, public.notifications, public.push_tokens, public.residents,
              public.reports, public.lost_items, public.announcements, public.block_bookings, public.table_borrows
  from anon;
revoke insert, update, delete, truncate on public.app_policy, public.activity_log, public.notifications, public.push_tokens,
              public.residents, public.reports, public.lost_items, public.announcements, public.block_bookings, public.table_borrows
  from authenticated;
-- read access (rows are still filtered by the policies above)
grant select on public.app_policy, public.activity_log, public.notifications, public.residents, public.reports,
                public.lost_items, public.announcements, public.block_bookings, public.table_borrows
  to authenticated;

-- B10 · existing tables: students can no longer write sessions, tables or reservations directly
drop policy if exists sessions_insert_own      on public.sessions;
drop policy if exists sessions_update_own      on public.sessions;
drop policy if exists tables_update_by_owner   on public.tables;
drop policy if exists reservations_insert_own  on public.reservations;
drop policy if exists reservations_delete_own  on public.reservations;
revoke insert, update, delete, truncate on public.sessions, public.tables, public.reservations from anon, authenticated;

-- B6 · profiles: students may change only their hostel (and only when there is no roster)
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant update (hostel_id) on public.profiles to authenticated;
-- ---------------------------------------------------------------------
-- 3. Internal helpers (not callable from the app)
-- ---------------------------------------------------------------------

-- current rules, honouring exam mode
create or replace function public.tabl_session_len() returns interval
language sql stable security definer set search_path = public as $$
  select make_interval(mins => case when exam_mode then exam_session_minutes else session_minutes end) from app_policy where id = 1
$$;
create or replace function public.tabl_break_secs() returns int
language sql stable security definer set search_path = public as $$
  select 60 * case when exam_mode then exam_break_minutes else break_minutes end from app_policy where id = 1
$$;
create or replace function public.tabl_hold_len() returns interval
language sql stable security definer set search_path = public as $$
  select make_interval(mins => hold_minutes) from app_policy where id = 1
$$;

create or replace function public.tabl_label(p_table text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select label from tables where id = p_table), p_table)
$$;

create or replace function public.tabl_space_name(p_space text) returns text
language sql immutable as $$
  select case when p_space is null then 'TABL' else initcap(p_space) end
$$;

create or replace function public.tabl_log(p_event text, p_user uuid, p_table text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into activity_log (event, user_id, actor_id, table_id, space_id, details)
  values (p_event, p_user, auth.uid(), p_table, (select space_id from tables where id = p_table), coalesce(p_details, '{}'::jsonb))
$$;

create or replace function public.tabl_notify(p_user uuid, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, title, body, data)
  select p_user, p_title, p_body, coalesce(p_data, '{}'::jsonb) where p_user is not null
$$;

create or replace function public.tabl_notify_admins(p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, title, body, data)
  select id, p_title, p_body, coalesce(p_data, '{}'::jsonb) from profiles where role = 'admin'
$$;

create or replace function public.tabl_assert_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admins_only'; end if;
end $$;

-- 25 · roster in use? (also used by the profiles trigger, so students may call it)
create or replace function public.tabl_roster_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from residents)
$$;

-- B8 · does this student already hold a table (session, reservation or borrowed table)?
create or replace function public.tabl_user_busy(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sessions where user_id = p_user and status in ('active', 'on_break'))
      or exists (select 1 from reservations where user_id = p_user and expires_at > now())
      or exists (select 1 from table_borrows where user_id = p_user and status = 'active')
$$;

-- 22 · reserving ahead is paused after too many no-shows / break overruns
create or replace function public.tabl_reserve_paused_until(p_user uuid) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare pol app_policy; v_since timestamptz; v_count int; v_last timestamptz;
begin
  select * into pol from app_policy where id = 1;
  select greatest(now() - make_interval(days => pol.misuse_window_days), coalesce(pause_cleared_at, '-infinity'))
    into v_since from profiles where id = p_user;
  select count(*), max(at) into v_count, v_last from activity_log
   where user_id = p_user and event in ('no_show', 'break_overrun') and at > coalesce(v_since, now() - make_interval(days => pol.misuse_window_days));
  if v_count >= pol.misuse_limit then
    return v_last + make_interval(hours => pol.misuse_pause_hours);
  end if;
  return null;
end $$;

-- 24 / 25 · can this student use this table at all? returns an error code, or null if fine
create or replace function public.tabl_access_problem(p_user uuid, p_table text) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_susp timestamptz; v_hostel text; v_space text;
begin
  if p_user is null then return 'not_signed_in'; end if;
  select suspended_until, hostel_id into v_susp, v_hostel from profiles where id = p_user;
  if v_susp is not null and v_susp > now() then return 'account_suspended'; end if;
  if p_table is not null then
    select space_id into v_space from tables where id = p_table;
    if v_space is null then return 'table_not_found'; end if;
    if v_space <> 'library' and tabl_roster_active() and v_hostel is distinct from v_space then
      return 'hostel_residents_only';
    end if;
  end if;
  return null;
end $$;

create or replace function public.tabl_assert_access(p_user uuid, p_table text) returns void
language plpgsql stable security definer set search_path = public as $$
declare v text := tabl_access_problem(p_user, p_table);
begin
  if v is not null then raise exception '%', v; end if;
end $$;

-- 33 · block bookings that apply to a table
create or replace function public.tabl_block_applies(b block_bookings, p_table text) returns boolean
language sql stable set search_path = public as $$
  select b.cancelled_at is null
     and (p_table = any(b.table_ids)
          or (b.table_ids is null and b.space_id = (select space_id from tables where id = p_table)))
$$;

create or replace function public.tabl_block_active(p_table text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from block_bookings b
                  where b.starts_at <= now() and b.ends_at > now() and tabl_block_applies(b, p_table))
$$;

create or replace function public.tabl_next_block_start(p_table text, p_until timestamptz) returns timestamptz
language sql stable security definer set search_path = public as $$
  select min(b.starts_at) from block_bookings b
   where b.starts_at > now() and b.starts_at <= p_until and tabl_block_applies(b, p_table)
$$;

-- B7 · session end time, set by the server (cut short if a block booking starts sooner)
create or replace function public.tabl_session_end_for(p_table text) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare v_end timestamptz := now() + tabl_session_len(); v_block timestamptz;
begin
  v_block := tabl_next_block_start(p_table, v_end);
  if v_block is not null then
    if v_block < now() + interval '10 minutes' then raise exception 'table_blocked_soon'; end if;
    v_end := v_block;
  end if;
  return v_end;
end $$;
-- ---------------------------------------------------------------------
-- 4. Table life-cycle (internal)
-- ---------------------------------------------------------------------

-- A1 · give a free table to the first person waiting (5-min hold)
create or replace function public.tabl_promote_waitlist(p_table text) returns void
language plpgsql security definer set search_path = public as $$
declare t tables; w record; v_hold interval := tabl_hold_len();
begin
  select * into t from tables where id = p_table for update;
  if t.id is null or t.status <> 'available' then return; end if;
  -- don't offer a table that is about to be blocked
  if tabl_next_block_start(p_table, now() + v_hold + interval '10 minutes') is not null then return; end if;

  for w in
    select * from waitlist
     where table_id = p_table and status = 'waiting' and not coalesce(notified, false)
     order by created_at, id
     for update skip locked
  loop
    -- people who already have a table, are suspended, or may not use this hall keep their place
    continue when tabl_user_busy(w.user_id) or tabl_access_problem(w.user_id, p_table) is not null;

    insert into reservations (id, table_id, space_id, user_id, expires_at)
    values ('res-wl-' || gen_random_uuid(), p_table, t.space_id, w.user_id, now() + v_hold);
    update tables set status = 'reserved' where id = p_table;
    update waitlist set notified = true, notified_at = now() where id = w.id;

    perform tabl_log('waitlist_offered', w.user_id, p_table);
    perform tabl_notify(w.user_id, 'Your table is ready',
      t.label || ' in ' || tabl_space_name(t.space_id) || ' is free. It''s held for you for '
      || extract(epoch from v_hold)::int / 60 || ' minutes: scan its QR to start.',
      jsonb_build_object('type', 'waitlist_ready', 'table_id', p_table));
    return;
  end loop;
end $$;

-- a table just became free: block it if a block booking is running, otherwise offer it to the queue
create or replace function public.tabl_settle_table(p_table text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from tables where id = p_table and status = 'available') then
    if tabl_block_active(p_table) then
      update tables set status = 'blocked', current_session_id = null where id = p_table;
    else
      perform tabl_promote_waitlist(p_table);
    end if;
  end if;
end $$;

-- the owner's session has ended: hand the table to whoever was using it (16), else free it
create or replace function public.tabl_release_table(p_table text, p_session text) returns void
language plpgsql security definer set search_path = public as $$
declare b table_borrows; v_end timestamptz; v_new text;
begin
  perform 1 from tables where id = p_table for update;

  select * into b from table_borrows
   where table_id = p_table and owner_session_id = p_session and status = 'active' for update;
  if b.id is not null then
    begin
      v_end := tabl_session_end_for(p_table);
    exception when others then
      v_end := null;   -- a block booking starts too soon: don't hand it over
    end;
    if v_end is not null
       and not exists (select 1 from sessions where user_id = b.user_id and status in ('active', 'on_break'))
       and tabl_access_problem(b.user_id, p_table) is null then
      v_new := 'session-b-' || gen_random_uuid();
      insert into sessions (id, table_id, space_id, user_id, ends_at, status)
      values (v_new, p_table, b.space_id, b.user_id, v_end, 'active');
      update table_borrows set status = 'converted', ended_at = now() where id = b.id;
      update tables set status = 'occupied', current_session_id = v_new where id = p_table;
      delete from waitlist where user_id = b.user_id and table_id = p_table;
      perform tabl_log('borrow_converted', b.user_id, p_table, jsonb_build_object('session_id', v_new));
      perform tabl_notify(b.user_id, 'The table is yours',
        'The owner of ' || tabl_label(p_table) || ' didn''t come back, so it''s now your session, until '
        || to_char(v_end at time zone 'Asia/Kolkata', 'HH12:MI AM') || '.',
        jsonb_build_object('type', 'borrow_converted', 'table_id', p_table));
      return;
    end if;
    update table_borrows set status = 'ended', ended_at = now() where id = b.id;
    perform tabl_notify(b.user_id, 'Please free the table',
      tabl_label(p_table) || ' is no longer available to you.', jsonb_build_object('type', 'borrow_ended', 'table_id', p_table));
  end if;

  update tables set status = 'available', current_session_id = null
   where id = p_table and (current_session_id = p_session or current_session_id is null);
  perform tabl_settle_table(p_table);
end $$;

-- end one session (any cause), record break time used, log it, then release the table
create or replace function public.tabl_finish_session(p_session text, p_status session_status, p_event text, p_notify boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s sessions; v_used int; v_title text; v_body text;
begin
  select * into s from sessions where id = p_session for update;
  if s.id is null or s.status not in ('active', 'on_break') then return; end if;

  v_used := coalesce(s.break_seconds_used, 0)
    + case when s.status = 'on_break' and s.break_started_at is not null
           then greatest(0, extract(epoch from (least(now(), coalesce(s.break_ends_at, now())) - s.break_started_at))::int)
           else 0 end;

  update sessions
     set status = p_status, ended_at = now(), break_seconds_used = v_used,
         break_started_at = null, paused_at = null, break_ends_at = null
   where id = s.id;

  perform tabl_log(p_event, s.user_id, s.table_id, jsonb_build_object('session_id', s.id));

  if p_notify then
    v_title := case p_event when 'break_overrun' then 'Break over · table released'
                            when 'session_expired' then 'Session ended'
                            else 'Your table was released' end;
    v_body  := case p_event when 'break_overrun' then 'You didn''t return from your break, so ' || tabl_label(s.table_id) || ' was released.'
                            when 'session_expired' then 'Your time at ' || tabl_label(s.table_id) || ' is up.'
                            else 'An admin released ' || tabl_label(s.table_id) || '.' end
               || ' Please collect your belongings.';
    perform tabl_notify(s.user_id, v_title, v_body, jsonb_build_object('type', p_event, 'table_id', s.table_id));
  end if;

  perform tabl_release_table(s.table_id, s.id);
end $$;

-- release a student's reservation (internal: cancel, expiry, suspension, reset)
create or replace function public.tabl_drop_reservation(r reservations, p_event text, p_notify boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from reservations where id = r.id;
  update tables set status = 'available' where id = r.table_id and status = 'reserved';
  if r.id like 'res-wl-%' then
    update waitlist set status = 'expired'
     where user_id = r.user_id and table_id = r.table_id and status = 'waiting' and notified;
  end if;
  perform tabl_log(p_event, r.user_id, r.table_id, jsonb_build_object('reservation_id', r.id));
  if p_notify then
    perform tabl_notify(r.user_id,
      case when p_event = 'waitlist_offer_expired' then 'Your hold ran out' else 'Reservation expired' end,
      tabl_label(r.table_id) || ' was released because it wasn''t scanned in time.',
      jsonb_build_object('type', p_event, 'table_id', r.table_id));
  end if;
  perform tabl_settle_table(r.table_id);
end $$;

-- ---------------------------------------------------------------------
-- 5. Student actions (same names and inputs as before: the current app keeps working)
-- ---------------------------------------------------------------------

-- B7/B8 · reserve: 5-min hold set by the server, one table per student
create or replace function public.reserve_table(p_table_id text, p_reservation_id text, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform tabl_assert_access(auth.uid(), p_table_id);
  if tabl_reserve_paused_until(auth.uid()) > now() then raise exception 'reserve_paused'; end if;
  if tabl_user_busy(auth.uid()) then raise exception 'already_have_a_table'; end if;

  perform 1 from tables where id = p_table_id and status = 'available' for update;
  if not found then raise exception 'table_not_available'; end if;
  if tabl_next_block_start(p_table_id, now() + tabl_hold_len() + interval '10 minutes') is not null then
    raise exception 'table_blocked_soon';
  end if;

  insert into reservations (id, table_id, space_id, user_id, expires_at)
  select coalesce(p_reservation_id, 'res-' || gen_random_uuid()), t.id, t.space_id, auth.uid(), now() + tabl_hold_len()
    from tables t where t.id = p_table_id;                      -- p_expires_at is ignored
  update tables set status = 'reserved' where id = p_table_id;
  perform tabl_log('reserved', auth.uid(), p_table_id);
end $$;

create or replace function public.cancel_reservation(p_reservation_id text)
returns void language plpgsql security definer set search_path = public as $$
declare r reservations;
begin
  select * into r from reservations where id = p_reservation_id for update;
  if r.id is null then return; end if;
  if r.user_id <> auth.uid() and not is_admin() then raise exception 'not_your_reservation'; end if;
  perform tabl_drop_reservation(r,
    case when r.user_id <> auth.uid() then 'admin_released_reservation' else 'reservation_cancelled' end,
    r.user_id <> auth.uid());
end $$;

-- scan the reserved table's QR: valid, unexpired reservation; session length set by the server
create or replace function public.scan_to_start(p_reservation_id text, p_session_id text, p_ends_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare r reservations; v_end timestamptz; v_id text := coalesce(p_session_id, 'session-' || gen_random_uuid());
begin
  select * into r from reservations where id = p_reservation_id for update;
  if r.id is null then raise exception 'reservation_not_found'; end if;
  if r.user_id <> auth.uid() then raise exception 'not_your_reservation'; end if;
  if r.expires_at <= now() then raise exception 'reservation_expired'; end if;
  perform tabl_assert_access(auth.uid(), r.table_id);
  if exists (select 1 from sessions where user_id = auth.uid() and status in ('active', 'on_break')) then
    raise exception 'already_in_a_session';
  end if;

  perform 1 from tables where id = r.table_id for update;
  v_end := tabl_session_end_for(r.table_id);
  insert into sessions (id, table_id, space_id, user_id, ends_at, status)
  values (v_id, r.table_id, r.space_id, auth.uid(), v_end, 'active');           -- p_ends_at is ignored
  delete from reservations where id = r.id;
  update tables set status = 'occupied', current_session_id = v_id where id = r.table_id;
  delete from waitlist where user_id = auth.uid() and table_id = r.table_id;
  perform tabl_log('checked_in', auth.uid(), r.table_id, jsonb_build_object('session_id', v_id, 'via', 'reservation'));
end $$;

-- scan a free table's QR directly
create or replace function public.check_in_direct(p_table_id text, p_session_id text, p_ends_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare r reservations; v_end timestamptz; v_space text; v_id text := coalesce(p_session_id, 'session-' || gen_random_uuid());
begin
  perform tabl_assert_access(auth.uid(), p_table_id);
  if exists (select 1 from sessions where user_id = auth.uid() and status in ('active', 'on_break'))
     or exists (select 1 from table_borrows where user_id = auth.uid() and status = 'active') then
    raise exception 'already_in_a_session';
  end if;

  select space_id into v_space from tables where id = p_table_id and status = 'available' for update;
  if not found then raise exception 'table_not_available'; end if;
  v_end := tabl_session_end_for(p_table_id);

  -- a reservation held elsewhere is given up
  for r in select * from reservations where user_id = auth.uid() for update loop
    perform tabl_drop_reservation(r, 'reservation_cancelled', false);
  end loop;

  insert into sessions (id, table_id, space_id, user_id, ends_at, status)
  values (v_id, p_table_id, v_space, auth.uid(), v_end, 'active');            -- p_ends_at is ignored
  update tables set status = 'occupied', current_session_id = v_id where id = p_table_id;
  delete from waitlist where user_id = auth.uid() and table_id = p_table_id;
  perform tabl_log('checked_in', auth.uid(), p_table_id, jsonb_build_object('session_id', v_id, 'via', 'direct'));
end $$;

-- B9 · breaks: only from an active session; budget from the policy (the app's value is ignored)
drop function if exists public.start_break(text, timestamptz, integer);

create or replace function public.start_break(p_session_id text, p_break_duration_minutes integer)
returns void language plpgsql security definer set search_path = public as $$
declare s sessions; v_remaining int;
begin
  select * into s from sessions where id = p_session_id and user_id = auth.uid() for update;
  if s.id is null then raise exception 'not_your_session'; end if;
  if s.status <> 'active' then raise exception 'session_not_active'; end if;

  v_remaining := tabl_break_secs() - coalesce(s.break_seconds_used, 0);
  if v_remaining <= 0 then raise exception 'no_break_time_left'; end if;

  update sessions
     set status = 'on_break', break_ends_at = now() + make_interval(secs => v_remaining),
         break_duration = tabl_break_secs() / 60, paused_at = now(), break_started_at = now()
   where id = s.id;
  update tables set status = 'on_break' where id = s.table_id and current_session_id = s.id;
  perform tabl_log('break_started', auth.uid(), s.table_id, jsonb_build_object('session_id', s.id));
end $$;

create or replace function public.end_break(p_session_id text)
returns void language plpgsql security definer set search_path = public as $$
declare s sessions; b table_borrows; v_end timestamptz;
begin
  select * into s from sessions where id = p_session_id and user_id = auth.uid() for update;
  if s.id is null then raise exception 'not_your_session'; end if;
  if s.status <> 'on_break' then raise exception 'not_on_break'; end if;

  -- the pause doesn't eat study time, but a block booking still cuts it short
  v_end := s.ends_at + case when s.paused_at is not null then now() - s.paused_at else interval '0' end;
  v_end := least(v_end, coalesce(tabl_next_block_start(s.table_id, v_end), v_end));

  update sessions
     set status = 'active', break_ends_at = null, break_duration = null, paused_at = null, break_started_at = null,
         break_seconds_used = coalesce(break_seconds_used, 0)
           + case when s.break_started_at is not null then greatest(0, extract(epoch from now() - s.break_started_at)::int) else 0 end,
         ends_at = v_end
   where id = s.id;
  update tables set status = 'occupied' where id = s.table_id and current_session_id = s.id;

  -- 16 · anyone using the table while the owner was away has to leave
  select * into b from table_borrows where owner_session_id = s.id and status = 'active' for update;
  if b.id is not null then
    update table_borrows set status = 'ended', ended_at = now() where id = b.id;
    perform tabl_log('borrow_ended', b.user_id, s.table_id, jsonb_build_object('reason', 'owner_returned'));
    perform tabl_notify(b.user_id, 'The owner is back',
      'Please free ' || tabl_label(s.table_id) || ': its owner has returned from their break.',
      jsonb_build_object('type', 'borrow_ended', 'table_id', s.table_id));
  end if;
  perform tabl_log('break_ended', auth.uid(), s.table_id, jsonb_build_object('session_id', s.id));
end $$;

-- B9 · end a session: only open ones, never touching someone else's table
create or replace function public.end_session(p_session_id text, p_reason session_status)
returns void language plpgsql security definer set search_path = public as $$
declare s sessions; v_event text; v_by_admin boolean;
begin
  if p_reason not in ('completed', 'expired') then raise exception 'invalid_reason'; end if;
  select * into s from sessions where id = p_session_id for update;
  if s.id is null then return; end if;
  v_by_admin := s.user_id <> auth.uid();
  if v_by_admin and not is_admin() then raise exception 'not_your_session'; end if;
  if s.status not in ('active', 'on_break') then return; end if;   -- already ended: nothing to do

  v_event := case
    when v_by_admin then 'admin_force_release'
    when s.status = 'on_break' and s.break_ends_at <= now() then 'break_overrun'
    when p_reason = 'expired' and s.ends_at <= now() then 'session_expired'
    else 'session_completed' end;

  perform tabl_finish_session(s.id,
    case when v_event = 'session_completed' then 'completed'::session_status else 'expired'::session_status end,
    v_event, v_by_admin);
end $$;

-- ---------------------------------------------------------------------
-- 6. Triggers
-- ---------------------------------------------------------------------

-- waitlist: students still insert/delete their own entries directly (the app does this),
-- but only valid entries get in
create or replace function public.tabl_trg_waitlist_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare t tables; v text;
begin
  if new.user_id is distinct from auth.uid() then raise exception 'not_your_entry'; end if;
  select * into t from tables where id = new.table_id;
  if t.id is null then raise exception 'table_not_found'; end if;
  v := tabl_access_problem(new.user_id, new.table_id);
  if v is not null then raise exception '%', v; end if;
  if t.status <> 'occupied' then raise exception 'table_not_occupied'; end if;
  if exists (select 1 from sessions where id = t.current_session_id and user_id = new.user_id) then
    raise exception 'already_your_table';
  end if;
  if exists (select 1 from waitlist where user_id = new.user_id and table_id = new.table_id and status = 'waiting') then
    raise exception 'already_in_queue';
  end if;

  new.id := coalesce(new.id, 'wait-' || gen_random_uuid());
  new.space_id := t.space_id;
  new.status := 'waiting';
  new.notified := false;
  new.notified_at := null;
  new.created_at := now();
  perform tabl_log('waitlist_joined', new.user_id, new.table_id);
  return new;
end $$;
drop trigger if exists tabl_waitlist_insert on public.waitlist;
create trigger tabl_waitlist_insert before insert on public.waitlist
  for each row when (current_user in ('authenticated', 'anon'))
  execute function public.tabl_trg_waitlist_insert();

-- profiles: once a roster is imported, the hostel comes from the roster (25)
create or replace function public.tabl_trg_profiles_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and new.hostel_id is distinct from old.hostel_id then
    if public.tabl_roster_active() then raise exception 'hostel_set_by_roster'; end if;
    if new.hostel_id = 'library' then raise exception 'not_a_hostel'; end if;
  end if;
  return new;
end $$;
drop trigger if exists tabl_profiles_update on public.profiles;
create trigger tabl_profiles_update before update on public.profiles
  for each row execute function public.tabl_trg_profiles_update();

-- B6 · new accounts are always students; hostel comes from the roster if there is one
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user text := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
begin
  insert into profiles (id, username, display_name, role, hostel_id)
  values (new.id, v_user,
          coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
          'student',      -- was taken from sign-up data, so anyone could register as admin
          (select hostel_id from residents where lower(username) = lower(v_user)))
  on conflict (id) do nothing;
  return new;
end $$;
-- ---------------------------------------------------------------------
-- 7. Scheduled job (runs every 10 s): expiry, block bookings, waitlist hand-off
-- ---------------------------------------------------------------------
create or replace function public.expire_overdue_sessions() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; rr reservations; v_count int := 0;
begin
  -- 60-min sessions that ran out
  for r in select id from sessions where status = 'active' and ends_at <= now() for update skip locked loop
    perform tabl_finish_session(r.id, 'expired', 'session_expired', true);
    v_count := v_count + 1;
  end loop;

  -- breaks that ran out (break over = session over)
  for r in select id from sessions
            where status = 'on_break' and break_ends_at is not null and break_ends_at <= now()
            for update skip locked loop
    perform tabl_finish_session(r.id, 'expired', 'break_overrun', true);
    v_count := v_count + 1;
  end loop;

  -- reservations not scanned in time
  for rr in select * from reservations where expires_at <= now() for update skip locked loop
    perform tabl_drop_reservation(rr,
      case when rr.id like 'res-wl-%' then 'waitlist_offer_expired' else 'no_show' end, true);
    v_count := v_count + 1;
  end loop;

  -- 33 · block bookings starting / ending
  for r in select id from tables where status = 'available' and tabl_block_active(id) loop
    update tables set status = 'blocked', current_session_id = null where id = r.id;
  end loop;
  for r in select id from tables where status = 'blocked' and not tabl_block_active(id) loop
    update tables set status = 'available' where id = r.id;
    perform tabl_settle_table(r.id);
  end loop;

  -- 16 · tidy up borrows whose owner is no longer on a break
  update table_borrows b set status = 'ended', ended_at = now()
   where b.status = 'active'
     and not exists (select 1 from sessions s where s.id = b.owner_session_id and s.status = 'on_break');

  -- A1 · catch-all: any free table with a queue goes to the next person
  for r in select distinct w.table_id from waitlist w join tables t on t.id = w.table_id
            where w.status = 'waiting' and not coalesce(w.notified, false) and t.status = 'available' loop
    perform tabl_promote_waitlist(r.table_id);
  end loop;

  return v_count;
end $$;

-- daily clean-up: keep personal history only as long as needed
create or replace function public.tabl_cleanup() returns void
language sql security definer set search_path = public as $$
  delete from activity_log  where at < now() - interval '90 days';
  delete from notifications where created_at < now() - interval '30 days';
  delete from reports       where status <> 'open' and created_at < now() - interval '180 days';
  delete from lost_items    where status = 'returned' and updated_at < now() - interval '30 days';
  delete from announcements where expires_at < now() - interval '30 days';
  delete from table_borrows where status <> 'active' and started_at < now() - interval '90 days';
  delete from block_bookings where ends_at < now() - interval '180 days';
$$;

-- 12 · send queued notifications to Expo's push service (100 per run)
create or replace function public.send_pending_pushes() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare v_n int; v_payload jsonb;
begin
  with batch as (
    select n.id from notifications n
     where n.sent_at is null and n.created_at > now() - interval '30 minutes'
     order by n.id limit 100 for update skip locked
  ), marked as (
    update notifications n set sent_at = now() from batch b where n.id = b.id
    returning n.user_id, n.title, n.body, n.data
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object(
           'to', t.token, 'title', m.title, 'body', m.body, 'data', m.data,
           'sound', 'default', 'priority', 'high', 'channelId', 'default')), '[]'::jsonb)
    into v_n, v_payload
    from marked m join push_tokens t on t.user_id = m.user_id;

  -- stale ones are never pushed (still visible in the app's inbox)
  update notifications set sent_at = now() where sent_at is null and created_at <= now() - interval '30 minutes';

  if v_n > 0 then
    perform net.http_post(
      url     := 'https://exp.host/--/api/v2/push/send',
      body    := v_payload,
      headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb);
  end if;
  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- 8. Student functions (new)
-- ---------------------------------------------------------------------

-- A2 · my place in each queue
create or replace function public.my_waitlist_positions()
returns table (entry_id text, table_id text, queue_position int, waiting int)
language sql stable security definer set search_path = public as $$
  select w.id, w.table_id,
         (select count(*)::int from waitlist o where o.table_id = w.table_id and o.status = 'waiting'
            and (o.created_at, o.id) <= (w.created_at, w.id)),
         (select count(*)::int from waitlist o where o.table_id = w.table_id and o.status = 'waiting')
    from waitlist w
   where w.user_id = auth.uid() and w.status = 'waiting'
$$;

-- A2 · how many people wait for each table (counts only, no names)
create or replace function public.waitlist_counts()
returns table (table_id text, waiting int)
language sql stable security definer set search_path = public as $$
  select w.table_id, count(*)::int from waitlist w where w.status = 'waiting' group by w.table_id
$$;

-- 22 / 24 / 25 · my account status, for the app to explain why something is blocked
create or replace function public.my_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'suspended_until',      case when p.suspended_until > now() then p.suspended_until end,
    'suspended_reason',     case when p.suspended_until > now() then p.suspended_reason end,
    'reserve_paused_until', case when tabl_reserve_paused_until(p.id) > now() then tabl_reserve_paused_until(p.id) end,
    'roster_active',        tabl_roster_active(),
    'roster_hostel',        (select r.hostel_id from residents r where lower(r.username) = lower(p.username)),
    'unread',               (select count(*) from notifications n where n.user_id = p.id and n.read_at is null))
  from profiles p where p.id = auth.uid()
$$;

-- 16 · use an away table until its owner returns (scan its QR)
create or replace function public.borrow_table(p_table_id text) returns void
language plpgsql security definer set search_path = public as $$
declare t tables; s sessions;
begin
  perform tabl_assert_access(auth.uid(), p_table_id);
  if tabl_user_busy(auth.uid()) then raise exception 'already_have_a_table'; end if;
  select * into t from tables where id = p_table_id for update;
  if t.status <> 'on_break' then raise exception 'table_not_on_break'; end if;
  select * into s from sessions where id = t.current_session_id and status = 'on_break';
  if s.id is null then raise exception 'table_not_on_break'; end if;
  if s.user_id = auth.uid() then raise exception 'already_your_table'; end if;
  if exists (select 1 from table_borrows where table_id = p_table_id and status = 'active') then
    raise exception 'table_already_borrowed';
  end if;

  insert into table_borrows (table_id, space_id, user_id, owner_session_id) values (p_table_id, t.space_id, auth.uid(), s.id);
  perform tabl_log('borrow_started', auth.uid(), p_table_id, jsonb_build_object('owner_session_id', s.id));
  perform tabl_notify(s.user_id, 'Someone is using your table',
    'A student is using ' || t.label || ' while you''re on break. They''ll leave when you scan back in.',
    jsonb_build_object('type', 'borrow_started', 'table_id', p_table_id));
end $$;

create or replace function public.end_borrow() returns void
language plpgsql security definer set search_path = public as $$
declare b table_borrows;
begin
  select * into b from table_borrows where user_id = auth.uid() and status = 'active' for update;
  if b.id is null then return; end if;
  update table_borrows set status = 'ended', ended_at = now() where id = b.id;
  perform tabl_log('borrow_ended', auth.uid(), b.table_id, jsonb_build_object('reason', 'left'));
end $$;

-- 18 · report a problem at a table (max 5 a day)
create or replace function public.report_table(p_table_id text, p_kind text, p_note text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare t tables; v_id bigint; v_occupant uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into t from tables where id = p_table_id;
  if t.id is null then raise exception 'table_not_found'; end if;
  if (select count(*) from reports where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too_many_reports';
  end if;
  select user_id into v_occupant from sessions where id = t.current_session_id;

  insert into reports (reporter_id, table_id, space_id, kind, note, occupant_id)
  values (auth.uid(), p_table_id, t.space_id, p_kind, nullif(trim(p_note), ''), v_occupant)
  returning id into v_id;
  perform tabl_log('report_created', auth.uid(), p_table_id, jsonb_build_object('report_id', v_id, 'kind', p_kind));
  perform tabl_notify_admins('New report · ' || t.label,
    replace(p_kind, '_', ' ') || coalesce(': ' || nullif(trim(p_note), ''), ''),
    jsonb_build_object('type', 'report', 'report_id', v_id, 'table_id', p_table_id));
  return v_id;
end $$;

-- 12 · register / remove this phone for push notifications
create or replace function public.set_push_token(p_token text, p_platform text default null) returns void
language sql security definer set search_path = public as $$
  insert into push_tokens (user_id, token, platform) select auth.uid(), p_token, p_platform where auth.uid() is not null
  on conflict (user_id, token) do update set updated_at = now(), platform = excluded.platform
$$;

create or replace function public.clear_push_token(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from push_tokens where user_id = auth.uid() and token = p_token
$$;

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null
$$;
-- ---------------------------------------------------------------------
-- 9. Admin functions (all check is_admin() first)
-- ---------------------------------------------------------------------

-- A3 · reset everything (confirmation is done in the app)
create or replace function public.reset_all_tables() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0;
begin
  perform tabl_assert_admin();
  for r in select id, user_id from sessions where status in ('active', 'on_break') for update loop
    update sessions set status = 'completed', ended_at = now(), break_started_at = null, paused_at = null, break_ends_at = null
     where id = r.id;
    perform tabl_notify(r.user_id, 'Tables were reset', 'An admin reset all tables, so your session has ended.',
                        jsonb_build_object('type', 'reset'));
    v_n := v_n + 1;
  end loop;
  delete from reservations;
  update waitlist set status = 'expired' where status = 'waiting';
  update table_borrows set status = 'ended', ended_at = now() where status = 'active';
  update tables set status = case when tabl_block_active(id) then 'blocked'::table_status else 'available'::table_status end,
                    current_session_id = null;
  perform tabl_log('admin_reset', null, null, jsonb_build_object('sessions_ended', v_n));
  return v_n;
end $$;

-- 27 · change the rules from the app
create or replace function public.admin_set_policy(p jsonb) returns app_policy
language plpgsql security definer set search_path = public as $$
declare v_old app_policy; v_new app_policy;
begin
  perform tabl_assert_admin();
  select * into v_old from app_policy where id = 1 for update;
  update app_policy set
    session_minutes      = coalesce((p->>'session_minutes')::int, session_minutes),
    break_minutes        = coalesce((p->>'break_minutes')::int, break_minutes),
    hold_minutes         = coalesce((p->>'hold_minutes')::int, hold_minutes),
    exam_mode            = coalesce((p->>'exam_mode')::boolean, exam_mode),
    exam_session_minutes = coalesce((p->>'exam_session_minutes')::int, exam_session_minutes),
    exam_break_minutes   = coalesce((p->>'exam_break_minutes')::int, exam_break_minutes),
    misuse_limit         = coalesce((p->>'misuse_limit')::int, misuse_limit),
    misuse_window_days   = coalesce((p->>'misuse_window_days')::int, misuse_window_days),
    misuse_pause_hours   = coalesce((p->>'misuse_pause_hours')::int, misuse_pause_hours),
    updated_at = now(), updated_by = auth.uid()
  where id = 1 returning * into v_new;
  perform tabl_log('admin_policy_changed', null, null, jsonb_build_object('before', to_jsonb(v_old), 'after', to_jsonb(v_new)));
  return v_new;
end $$;

-- 24 · students, with what they hold now and their recent record
create or replace function public.admin_list_users(p_search text default null)
returns table (user_id uuid, username text, display_name text, hostel_id text, roster_hostel text,
               suspended_until timestamptz, suspended_reason text, reserve_paused_until timestamptz,
               no_shows_7d int, break_overruns_7d int, sessions_7d int, reports_against_30d int, current_table text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform tabl_assert_admin();
  return query
  select p.id, p.username, p.display_name, p.hostel_id,
         (select r.hostel_id from residents r where lower(r.username) = lower(p.username)),
         case when p.suspended_until > now() then p.suspended_until end,
         case when p.suspended_until > now() then p.suspended_reason end,
         case when tabl_reserve_paused_until(p.id) > now() then tabl_reserve_paused_until(p.id) end,
         (select count(*)::int from activity_log a where a.user_id = p.id and a.event = 'no_show' and a.at > now() - interval '7 days'),
         (select count(*)::int from activity_log a where a.user_id = p.id and a.event = 'break_overrun' and a.at > now() - interval '7 days'),
         (select count(*)::int from activity_log a where a.user_id = p.id and a.event = 'checked_in' and a.at > now() - interval '7 days'),
         (select count(*)::int from reports x where x.occupant_id = p.id and x.created_at > now() - interval '30 days'),
         (select t.label from sessions s join tables t on t.id = s.table_id
           where s.user_id = p.id and s.status in ('active', 'on_break') limit 1)
    from profiles p
   where p.role = 'student'
     and (p_search is null or p.username ilike '%' || p_search || '%' or p.display_name ilike '%' || p_search || '%')
   order by p.username
   limit 200;
end $$;

-- 24 · suspend (p_hours null = until reinstated): everything they hold is released
create or replace function public.admin_suspend_user(p_user uuid, p_hours int, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r record; rr reservations; v_until timestamptz;
begin
  perform tabl_assert_admin();
  if exists (select 1 from profiles where id = p_user and role = 'admin') then raise exception 'cannot_suspend_admin'; end if;
  v_until := case when p_hours is null then 'infinity'::timestamptz else now() + make_interval(hours => p_hours) end;
  update profiles set suspended_until = v_until, suspended_reason = nullif(trim(p_reason), '') where id = p_user;

  for r in select id from sessions where user_id = p_user and status in ('active', 'on_break') loop
    perform tabl_finish_session(r.id, 'completed', 'admin_force_release', false);
  end loop;
  for rr in select * from reservations where user_id = p_user loop
    perform tabl_drop_reservation(rr, 'admin_released_reservation', false);
  end loop;
  update waitlist set status = 'expired' where user_id = p_user and status = 'waiting';
  update table_borrows set status = 'ended', ended_at = now() where user_id = p_user and status = 'active';

  perform tabl_log('admin_suspend', p_user, null, jsonb_build_object('until', v_until, 'reason', p_reason));
  perform tabl_notify(p_user, 'Account suspended',
    case when p_hours is null then 'Your TABL account is suspended until an admin reinstates it.'
         else 'Your TABL account is suspended until ' || to_char(v_until at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM') || '.' end
    || coalesce(' Reason: ' || nullif(trim(p_reason), ''), ''),
    jsonb_build_object('type', 'suspended'));
end $$;

create or replace function public.admin_unsuspend_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform tabl_assert_admin();
  update profiles set suspended_until = null, suspended_reason = null where id = p_user;
  perform tabl_log('admin_unsuspend', p_user, null);
  perform tabl_notify(p_user, 'Account reinstated', 'You can use TABL again.', jsonb_build_object('type', 'unsuspended'));
end $$;

-- 22 · lift a misuse pause early
create or replace function public.admin_clear_pause(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform tabl_assert_admin();
  update profiles set pause_cleared_at = now() where id = p_user;
  perform tabl_log('admin_clear_pause', p_user, null);
end $$;

-- 25 · import the resident roster: [{"username":"264205002","hostel_id":"kameng"}, ...]
create or replace function public.admin_import_roster(p_rows jsonb, p_replace boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_bad jsonb; v_rows int; v_matched int;
begin
  perform tabl_assert_admin();
  -- hostel ids must be real hostels (any table's space other than the library)
  select coalesce(jsonb_agg(distinct x->>'hostel_id'), '[]'::jsonb) into v_bad
    from jsonb_array_elements(p_rows) x
   where x->>'hostel_id' is null or x->>'hostel_id' = 'library'
      or not exists (select 1 from tables t where t.space_id = x->>'hostel_id');
  if jsonb_array_length(v_bad) > 0 then
    raise exception 'unknown_hostels: %', v_bad;
  end if;

  if p_replace then delete from residents; end if;
  insert into residents (username, hostel_id)
  select distinct on (lower(trim(x->>'username'))) lower(trim(x->>'username')), x->>'hostel_id'
    from jsonb_array_elements(p_rows) x
   where nullif(trim(x->>'username'), '') is not null
  on conflict (username) do update set hostel_id = excluded.hostel_id, imported_at = now();
  get diagnostics v_rows = row_count;

  update profiles p set hostel_id = r.hostel_id from residents r where lower(p.username) = r.username;
  get diagnostics v_matched = row_count;
  if p_replace then
    update profiles p set hostel_id = null
     where p.role = 'student' and not exists (select 1 from residents r where r.username = lower(p.username));
  end if;

  perform tabl_log('admin_roster_import', null, null, jsonb_build_object('rows', v_rows, 'matched', v_matched, 'replace', p_replace));
  return jsonb_build_object('rows', v_rows, 'matched_accounts', v_matched, 'total_in_roster', (select count(*) from residents));
end $$;

-- 25 · switch roster checks off again (students choose their hostel, as before)
create or replace function public.admin_clear_roster() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform tabl_assert_admin();
  delete from residents;
  perform tabl_log('admin_roster_cleared', null, null);
end $$;

-- 28 · disputes inbox
create or replace function public.admin_list_reports(p_status text default 'open')
returns table (id bigint, created_at timestamptz, kind text, note text, status text, admin_note text,
               table_id text, table_label text, space_id text, reporter text, occupant text, occupant_id uuid, resolved_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform tabl_assert_admin();
  return query
  select r.id, r.created_at, r.kind, r.note, r.status, r.admin_note, r.table_id, t.label, r.space_id,
         rp.username, op.username, r.occupant_id, r.resolved_at
    from reports r
    left join tables t on t.id = r.table_id
    left join profiles rp on rp.id = r.reporter_id
    left join profiles op on op.id = r.occupant_id
   where p_status is null or r.status = p_status
   order by r.created_at desc
   limit 200;
end $$;

create or replace function public.admin_resolve_report(p_id bigint, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r reports;
begin
  perform tabl_assert_admin();
  if p_status not in ('resolved', 'dismissed') then raise exception 'invalid_status'; end if;
  update reports set status = p_status, admin_note = nullif(trim(p_note), ''), resolved_at = now(), resolved_by = auth.uid()
   where id = p_id returning * into r;
  if r.id is null then raise exception 'report_not_found'; end if;
  perform tabl_log('report_' || p_status, r.reporter_id, r.table_id, jsonb_build_object('report_id', p_id));
  perform tabl_notify(r.reporter_id, 'Your report was ' || p_status,
    'About ' || tabl_label(r.table_id) || coalesce(': ' || nullif(trim(p_note), ''), '.'),
    jsonb_build_object('type', 'report_' || p_status, 'report_id', p_id));
end $$;

-- 29 · activity and audit log
create or replace function public.admin_activity(p_limit int default 100, p_user uuid default null, p_event text default null)
returns table (id bigint, at timestamptz, event text, username text, actor text, table_label text, space_id text, details jsonb)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform tabl_assert_admin();
  return query
  select a.id, a.at, a.event, u.username, ac.username, t.label, a.space_id, a.details
    from activity_log a
    left join profiles u on u.id = a.user_id
    left join profiles ac on ac.id = a.actor_id
    left join tables t on t.id = a.table_id
   where (p_user is null or a.user_id = p_user) and (p_event is null or a.event = p_event)
   order by a.at desc
   limit least(coalesce(p_limit, 100), 500);
end $$;

-- 31 · announcements (space null = everyone), optionally pushed to phones
create or replace function public.admin_post_announcement(p_space_id text, p_title text, p_body text,
                                                          p_hours int default 24, p_push boolean default true) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform tabl_assert_admin();
  insert into announcements (created_by, space_id, title, body, expires_at)
  values (auth.uid(), nullif(p_space_id, ''), trim(p_title), coalesce(trim(p_body), ''),
          now() + make_interval(hours => greatest(1, least(coalesce(p_hours, 24), 24 * 14))))
  returning id into v_id;

  if p_push then
    insert into notifications (user_id, title, body, data)
    select p.id, trim(p_title), coalesce(trim(p_body), ''), jsonb_build_object('type', 'announcement', 'announcement_id', v_id)
      from profiles p
     where p.role = 'student'
       and (nullif(p_space_id, '') is null or p_space_id = 'library'
            or p.hostel_id = p_space_id
            or exists (select 1 from sessions s where s.user_id = p.id and s.space_id = p_space_id and s.status in ('active', 'on_break')));
  end if;
  perform tabl_log('admin_announcement', null, null, jsonb_build_object('announcement_id', v_id, 'space_id', p_space_id, 'title', p_title));
  return v_id;
end $$;

create or replace function public.admin_delete_announcement(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform tabl_assert_admin();
  update announcements set expires_at = now() where id = p_id;
end $$;

-- 19 · items left at a table
create or replace function public.admin_add_lost_item(p_table_id text, p_description text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform tabl_assert_admin();
  insert into lost_items (table_id, space_id, description, created_by)
  select p_table_id, t.space_id, trim(p_description), auth.uid() from tables t where t.id = p_table_id
  returning id into v_id;
  if v_id is null then raise exception 'table_not_found'; end if;
  perform tabl_log('lost_item_added', null, p_table_id, jsonb_build_object('item_id', v_id, 'description', p_description));
  return v_id;
end $$;

create or replace function public.admin_update_lost_item(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform tabl_assert_admin();
  update lost_items set status = p_status, updated_at = now() where id = p_id;
  perform tabl_log('lost_item_' || p_status, null, (select table_id from lost_items where id = p_id), jsonb_build_object('item_id', p_id));
end $$;

-- 33 · block bookings
create or replace function public.admin_create_block(p_title text, p_space_id text, p_table_ids text[],
                                                     p_starts_at timestamptz, p_ends_at timestamptz) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint; b block_bookings; r record;
begin
  perform tabl_assert_admin();
  if p_ends_at <= p_starts_at then raise exception 'end_before_start'; end if;
  if p_ends_at <= now() then raise exception 'block_in_past'; end if;
  if not exists (select 1 from tables where space_id = p_space_id) then raise exception 'unknown_space'; end if;

  insert into block_bookings (title, space_id, table_ids, starts_at, ends_at, created_by)
  values (trim(p_title), p_space_id, nullif(p_table_ids, '{}'), p_starts_at, p_ends_at, auth.uid())
  returning * into b;
  v_id := b.id;

  -- sessions already running on these tables end when the block starts; their owners are told now
  for r in select s.id, s.user_id, s.table_id from sessions s
            where s.status in ('active', 'on_break') and tabl_block_applies(b, s.table_id) and s.ends_at > b.starts_at loop
    update sessions set ends_at = greatest(now(), b.starts_at) where id = r.id;
    perform tabl_notify(r.user_id, 'Your table is booked soon',
      tabl_label(r.table_id) || ' is booked for "' || b.title || '" from '
      || to_char(b.starts_at at time zone 'Asia/Kolkata', 'HH12:MI AM') || ', so your session ends then.',
      jsonb_build_object('type', 'block', 'block_id', v_id));
  end loop;
  -- tables that are free right now are blocked straight away if the block has started
  update tables t set status = 'blocked', current_session_id = null
   where t.status = 'available' and b.starts_at <= now() and tabl_block_applies(b, t.id);

  perform tabl_log('admin_block_created', null, null, jsonb_build_object('block_id', v_id, 'title', p_title,
                   'space_id', p_space_id, 'table_ids', p_table_ids, 'starts_at', p_starts_at, 'ends_at', p_ends_at));
  return v_id;
end $$;

create or replace function public.admin_cancel_block(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  perform tabl_assert_admin();
  update block_bookings set cancelled_at = now() where id = p_id and cancelled_at is null;
  for r in select id from tables where status = 'blocked' and not tabl_block_active(id) loop
    update tables set status = 'available' where id = r.id;
    perform tabl_settle_table(r.id);
  end loop;
  perform tabl_log('admin_block_cancelled', null, null, jsonb_build_object('block_id', p_id));
end $$;

-- 32 · system health
create or replace function public.tabl_stuck_tables() returns table (table_id text, label text, problem text)
language sql stable security definer set search_path = public as $$
  select t.id, t.label, case
      when t.status in ('occupied', 'on_break') and not exists
           (select 1 from sessions s where s.id = t.current_session_id and s.status in ('active', 'on_break'))
        then 'marked in use, but no open session'
      when t.status = 'reserved' and not exists (select 1 from reservations r where r.table_id = t.id)
        then 'marked reserved, but no reservation'
      when t.status = 'available' and exists (select 1 from sessions s where s.table_id = t.id and s.status in ('active', 'on_break'))
        then 'marked free, but someone is checked in'
      when t.status::text = 'blocked' and not tabl_block_active(t.id)
        then 'marked blocked, but no block booking is running'
    end
  from tables t
  where (t.status in ('occupied', 'on_break') and not exists
           (select 1 from sessions s where s.id = t.current_session_id and s.status in ('active', 'on_break')))
     or (t.status = 'reserved' and not exists (select 1 from reservations r where r.table_id = t.id))
     or (t.status = 'available' and exists (select 1 from sessions s where s.table_id = t.id and s.status in ('active', 'on_break')))
     or (t.status::text = 'blocked' and not tabl_block_active(t.id))
$$;

create or replace function public.admin_health() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_job jsonb; v_push jsonb;
begin
  perform tabl_assert_admin();
  begin
    select jsonb_build_object('schedule', j.schedule, 'active', j.active,
             'last_run', (select max(d.start_time) from cron.job_run_details d where d.jobid = j.jobid),
             'last_status', (select d.status from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1),
             'failures_1h', (select count(*) from cron.job_run_details d where d.jobid = j.jobid and d.status = 'failed'
                               and d.start_time > now() - interval '1 hour'))
      into v_job from cron.job j where j.jobname = 'tabl-expire';
  exception when others then v_job := jsonb_build_object('error', sqlerrm);
  end;
  begin
    select jsonb_build_object('last_status', (select status_code from net._http_response order by created desc limit 1),
                              'errors_1h', (select count(*) from net._http_response
                                             where created > now() - interval '1 hour' and (status_code is null or status_code >= 400)))
      into v_push;
  exception when others then v_push := jsonb_build_object('error', sqlerrm);
  end;
  return jsonb_build_object(
    'checked_at', now(),
    'expiry_job', v_job,
    'push', coalesce(v_push, '{}'::jsonb) || jsonb_build_object(
              'queued', (select count(*) from notifications where sent_at is null),
              'devices', (select count(*) from push_tokens)),
    'stuck_tables', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from tabl_stuck_tables() x),
    'open_reports', (select count(*) from reports where status = 'open'),
    'suspended_users', (select count(*) from profiles where suspended_until > now()),
    'roster_size', (select count(*) from residents));
end $$;

create or replace function public.admin_fix_stuck_tables() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_n int := 0; v_sess text;
begin
  perform tabl_assert_admin();
  for r in select * from tabl_stuck_tables() loop
    select s.id into v_sess from sessions s where s.table_id = r.table_id and s.status in ('active', 'on_break')
     order by s.started_at desc limit 1;
    if v_sess is not null then
      update tables set current_session_id = v_sess,
             status = (select case when status = 'on_break' then 'on_break'::table_status else 'occupied'::table_status end
                         from sessions where id = v_sess)
       where id = r.table_id;
    elsif exists (select 1 from reservations where table_id = r.table_id) then
      update tables set status = 'reserved', current_session_id = null where id = r.table_id;
    else
      update tables set status = 'available', current_session_id = null where id = r.table_id;
      perform tabl_settle_table(r.table_id);
    end if;
    v_n := v_n + 1;
  end loop;
  perform tabl_log('admin_fixed_stuck_tables', null, null, jsonb_build_object('fixed', v_n));
  return v_n;
end $$;

-- 30-day summary for the admin dashboard
create or replace function public.admin_insights(p_days int default 7) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)));
begin
  perform tabl_assert_admin();
  return jsonb_build_object(
    'days', p_days,
    'check_ins',       (select count(*) from activity_log where event = 'checked_in' and at > v_since),
    'no_shows',        (select count(*) from activity_log where event = 'no_show' and at > v_since),
    'break_overruns',  (select count(*) from activity_log where event = 'break_overrun' and at > v_since),
    'waitlist_offers', (select count(*) from activity_log where event = 'waitlist_offered' and at > v_since),
    'waitlist_claimed',(select count(*) from activity_log a where a.event = 'checked_in' and a.at > v_since
                          and exists (select 1 from activity_log o where o.event = 'waitlist_offered' and o.user_id = a.user_id
                                        and o.table_id = a.table_id and o.at between a.at - interval '30 minutes' and a.at)),
    'borrow_converted',(select count(*) from activity_log where event = 'borrow_converted' and at > v_since),
    'reports',         (select count(*) from reports where created_at > v_since),
    'by_hour',         (select coalesce(jsonb_agg(c order by h), '[]'::jsonb) from (
                          select h, (select count(*) from activity_log a where a.event = 'checked_in' and a.at > v_since
                                       and extract(hour from a.at at time zone 'Asia/Kolkata') = h) c
                            from generate_series(0, 23) h) x));
end $$;
-- ---------------------------------------------------------------------
-- 10. Who may call what
-- ---------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and (p.proname like 'tabl\_%' or p.proname like 'admin\_%'
            or p.proname in ('reserve_table', 'cancel_reservation', 'scan_to_start', 'check_in_direct', 'start_break',
                             'end_break', 'end_session', 'expire_overdue_sessions', 'send_pending_pushes', 'reset_all_tables',
                             'my_waitlist_positions', 'waitlist_counts', 'my_status', 'borrow_table', 'end_borrow',
                             'report_table', 'set_push_token', 'clear_push_token', 'mark_notifications_read', 'handle_new_user'))
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    -- callable from the app: student actions, admin actions (which check is_admin themselves)
    if f.proname like 'admin\_%' or f.proname in ('reserve_table', 'cancel_reservation', 'scan_to_start', 'check_in_direct',
         'start_break', 'end_break', 'end_session', 'reset_all_tables', 'my_waitlist_positions', 'waitlist_counts', 'my_status',
         'borrow_table', 'end_borrow', 'report_table', 'set_push_token', 'clear_push_token', 'mark_notifications_read',
         'tabl_roster_active') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 11. Live updates for the new tables (skipped if already set up)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['notifications', 'announcements', 'block_bookings', 'lost_items', 'table_borrows', 'app_policy', 'reports'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when others then null;   -- already added, or no realtime publication
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 12. Scheduled jobs
-- ---------------------------------------------------------------------
-- B11 · expiry every 10 seconds (was every minute)
select cron.alter_job(jobid, schedule := '10 seconds') from cron.job where jobname = 'tabl-expire';
-- (if there was no expiry job, create it)
select cron.schedule('tabl-expire', '10 seconds', 'select public.expire_overdue_sessions();')
 where not exists (select 1 from cron.job where jobname = 'tabl-expire');

-- 12 · push sender every 10 seconds, clean-up nightly at 02:53 IST
select cron.unschedule(jobid) from cron.job where jobname in ('tabl-push', 'tabl-cleanup');
select cron.schedule('tabl-push', '10 seconds', 'select public.send_pending_pushes();');
select cron.schedule('tabl-cleanup', '23 21 * * *', 'select public.tabl_cleanup();');

commit;

-- ---------------------------------------------------------------------
-- Afterwards, check (run separately):
--   select jobname, schedule, active from cron.job;                      -- 3 jobs, '10 seconds'
--   select public.expire_overdue_sessions();                              -- runs without error
--   select status, start_time from cron.job_run_details order by start_time desc limit 5;
-- ---------------------------------------------------------------------
