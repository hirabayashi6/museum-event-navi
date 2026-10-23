-- 親御さんの声：「こんなイベントがあったらいいな」の投稿
-- 投稿は誰でもできるが、必ず「確認待ち」で入る。サイトに出るのは、運営が目視で「掲載」にしたものだけ
create table if not exists voices (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  age text not null check (age in ('baby', 'low', 'high', 'none')), -- 0〜5さい／小学1〜3年／小学4〜6年／答えない
  pref text check (pref is null or char_length(pref) <= 4),
  body text not null check (char_length(body) between 5 and 300),
  nickname text check (nickname is null or char_length(nickname) <= 20),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')), -- 確認待ち／掲載／掲載しない
  note text -- 運営のメモ（公開しない）
);
create index if not exists voices_status_created on voices (status, created_at desc);

alter table voices enable row level security;
drop policy if exists "post voice" on voices;
drop policy if exists "read approved voices" on voices;
-- 投稿：確認待ちとしてだけ入れられる
create policy "post voice" on voices for insert to anon with check (status = 'pending' and note is null);
-- 閲覧：掲載にしたものだけ
create policy "read approved voices" on voices for select to anon using (status = 'approved');

grant insert (age, pref, body, nickname) on voices to anon;
grant select (id, created_at, age, pref, body, nickname) on voices to anon;
grant all on voices to service_role;
