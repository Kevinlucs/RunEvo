-- Campos usados pela tela Editar perfil.
alter table public.athlete_profiles
  add column if not exists gender text
  check (gender in ('masculino', 'feminino', 'nao-binario', 'prefiro-nao-dizer'));
