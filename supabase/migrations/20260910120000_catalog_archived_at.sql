-- Baja reversible de fichas eliminadas en Tokko Broker (ver docs/ADR-001).
--
-- `archived_at` es la bandera de visibilidad del sitio: una ficha archivada no
-- se publica pero conserva todo lo que solo vive en el CRM (video, tour 3D,
-- teléfono de contacto, destacado) y sus traducciones.
--
-- NO se reutiliza `deleted_at`: esa columna espeja el `deleted_at` del payload de
-- Tokko y en datos sincronizados a veces nunca queda NULL, así que filtrar por
-- ella dejaría el catálogo vacío (ver comentario en fetchCatalogProperties).
--
-- Migración idempotente.

alter table public.properties
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

alter table public.developments
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

comment on column public.properties.archived_at is
  'Fecha de baja: si no es NULL la ficha no se muestra en el sitio. Reversible desde el panel.';
comment on column public.properties.archived_reason is
  'Por qué se archivó: missing_in_tokko (ausente en la importación) o manual (baja hecha en el panel).';
comment on column public.developments.archived_at is
  'Fecha de baja: si no es NULL el desarrollo no se muestra en el sitio. Reversible desde el panel.';
comment on column public.developments.archived_reason is
  'Por qué se archivó: missing_in_tokko (ausente en la importación) o manual (baja hecha en el panel).';

alter table public.properties
  drop constraint if exists properties_archived_reason_chk;
alter table public.properties
  add constraint properties_archived_reason_chk
  check (archived_reason is null or archived_reason in ('missing_in_tokko', 'manual'));

alter table public.developments
  drop constraint if exists developments_archived_reason_chk;
alter table public.developments
  add constraint developments_archived_reason_chk
  check (archived_reason is null or archived_reason in ('missing_in_tokko', 'manual'));

-- Índices parciales: el catálogo público siempre consulta `archived_at is null`,
-- que es además la gran mayoría de las filas.
create index if not exists properties_archived_at_idx
  on public.properties (archived_at) where archived_at is null;
create index if not exists developments_archived_at_idx
  on public.developments (archived_at) where archived_at is null;

-- ---------------------------------------------------------------------------
-- RLS: defensa en profundidad
--
-- El filtro `archived_at is null` ya va en las consultas del sitio; esto evita
-- además que una ficha archivada sea legible con la anon key construyendo el
-- query a mano. `authenticated` sigue viendo todo porque el panel necesita
-- listar y restaurar las archivadas.
-- ---------------------------------------------------------------------------
drop policy if exists properties_select_public on public.properties;
drop policy if exists developments_select_public on public.developments;

create policy properties_select_anon
  on public.properties for select to anon
  using (archived_at is null);

create policy properties_select_authenticated
  on public.properties for select to authenticated
  using (true);

create policy developments_select_anon
  on public.developments for select to anon
  using (archived_at is null);

create policy developments_select_authenticated
  on public.developments for select to authenticated
  using (true);
