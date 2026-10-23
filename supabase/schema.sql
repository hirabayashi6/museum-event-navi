-- 博物館イベントナビ：Supabase のテーブル定義（SQL Editor に貼って実行）
create table if not exists museums (
  no text primary key,
  name text not null,
  pref text not null,
  city text not null default '',
  category text not null default '',
  url text not null default '',
  instagram text
);

create table if not exists events (
  id text primary key,
  no text not null references museums(no) on delete cascade,
  museum text not null,
  pref text not null,
  city text not null default '',
  title text not null,
  kind text,
  start_date date not null,
  end_date date,
  last_date date not null,
  time text,
  audience text[] not null default '{}',
  fee text,
  reservation text not null default '不明',
  place text,
  source_url text not null,
  method text not null,
  confidence real not null default 0,
  extracted_at timestamptz not null default now()
);

create index if not exists events_last_date on events (last_date);
create index if not exists events_pref_start on events (pref, start_date);

-- 閲覧は誰でも可、書き込みは巡回（service_role キー）だけ
alter table museums enable row level security;
alter table events enable row level security;
drop policy if exists "read museums" on museums;
drop policy if exists "read events" on events;
create policy "read museums" on museums for select using (true);
create policy "read events" on events for select using (true);

-- 「新しい表を自動で公開」を切っているので、権限を明示する
grant usage on schema public to anon, authenticated, service_role;
grant select on museums, events to anon, authenticated;
grant all on museums, events to service_role;
