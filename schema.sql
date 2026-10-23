-- Los Becerros de Marto: tabla del ranking
-- Pegar en Supabase > SQL Editor y correr una vez

create table if not exists public.becerros_scores (
  id          bigint generated always as identity primary key,
  player_name text        not null check (char_length(btrim(player_name)) between 1 and 16),
  score       integer     not null check (score between 0 and 1000000),
  calves      integer     not null default 0 check (calves between 0 and 10000),
  level       integer     not null default 1 check (level between 1 and 999),
  created_at  timestamptz not null default now()
);

create index if not exists becerros_scores_score_idx on public.becerros_scores (score desc);

alter table public.becerros_scores enable row level security;

-- Cualquiera puede ver el ranking y sumar su puntaje. Nadie puede editar ni borrar desde el juego
drop policy if exists "ranking visible" on public.becerros_scores;
create policy "ranking visible" on public.becerros_scores
  for select to anon, authenticated using (true);

drop policy if exists "sumar puntaje" on public.becerros_scores;
create policy "sumar puntaje" on public.becerros_scores
  for insert to anon, authenticated with check (true);

grant select, insert on public.becerros_scores to anon, authenticated;
