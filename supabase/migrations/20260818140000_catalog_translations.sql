-- Traducciones del catálogo (descripciones y títulos de Tokko).
--
-- Vive en tabla aparte a propósito: la importación de Tokko hace UPSERT sobre
-- `properties` y `developments`, así que una traducción guardada en esas
-- columnas se perdería en la siguiente sincronización.
--
-- `source_hash` es el SHA-256 del texto original en el momento de traducir.
-- Permite dos cosas: no volver a pagar por lo que no cambió, y detectar cuándo
-- Tokko modificó el original para retraducir solo eso.
--
-- Migración idempotente.

create table if not exists public.catalog_translations (
  entity text not null,
  entity_id uuid not null,
  field text not null,
  locale text not null,
  /** Texto traducido que se muestra en el sitio. */
  translated text not null,
  /** SHA-256 del original; si deja de coincidir, la traducción está obsoleta. */
  source_hash text not null,
  /**
   * `machine` la escribió el pipeline; `manual` la corrigió una persona en el
   * admin. El pipeline nunca pisa una corrección manual.
   */
  origin text not null default 'machine',
  updated_at timestamptz not null default now(),
  primary key (entity, entity_id, field, locale)
);

alter table public.catalog_translations
  drop constraint if exists catalog_translations_entity_chk;
alter table public.catalog_translations
  add constraint catalog_translations_entity_chk
  check (entity in ('property', 'development'));

alter table public.catalog_translations
  drop constraint if exists catalog_translations_locale_chk;
alter table public.catalog_translations
  add constraint catalog_translations_locale_chk
  check (locale in ('en'));

alter table public.catalog_translations
  drop constraint if exists catalog_translations_origin_chk;
alter table public.catalog_translations
  add constraint catalog_translations_origin_chk
  check (origin in ('machine', 'manual'));

/** El sitio público filtra por (entity, locale) al pintar un listado. */
create index if not exists catalog_translations_entity_locale_idx
  on public.catalog_translations (entity, locale);

create or replace function public.catalog_translations_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists catalog_translations_set_updated_at on public.catalog_translations;
create trigger catalog_translations_set_updated_at
  before update on public.catalog_translations
  for each row
  execute function public.catalog_translations_set_updated_at();

alter table public.catalog_translations enable row level security;
alter table public.catalog_translations force row level security;

-- Lectura pública: el sitio sin sesión necesita las traducciones para pintar
-- el catálogo en inglés, igual que ya lee `properties`.
drop policy if exists catalog_translations_select_all on public.catalog_translations;
create policy catalog_translations_select_all
  on public.catalog_translations
  for select
  to anon, authenticated
  using (true);

/*
 * Escritura: el pipeline corre con service role, que salta RLS. Estas políticas
 * son para que un admin autenticado pueda corregir una traducción desde el
 * override oculto del editor.
 */
-- Misma condición que `site_content_sections` (admin o permiso edit_site),
-- inlineada igual que allí porque no existe una función helper para esto.
drop policy if exists catalog_translations_write_editors on public.catalog_translations;
create policy catalog_translations_write_editors
  on public.catalog_translations
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.tokko_users tu
      where tu.id = auth.uid()
        and tu.deleted_at is null
        and (
          tu.role = 'admin'
          or 'edit_site' = any (coalesce(tu.permissions, '{}'::text[]))
        )
    )
  )
  with check (
    exists (
      select 1
      from public.tokko_users tu
      where tu.id = auth.uid()
        and tu.deleted_at is null
        and (
          tu.role = 'admin'
          or 'edit_site' = any (coalesce(tu.permissions, '{}'::text[]))
        )
    )
  );

comment on table public.catalog_translations is
  'Traducciones del catálogo fuera de las columnas del sync de Tokko; source_hash detecta originales modificados.';
