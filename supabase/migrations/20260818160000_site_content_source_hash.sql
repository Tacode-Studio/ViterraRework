-- Hash del original para las traducciones automáticas del CMS.
--
-- En las filas traducidas (locale <> 'es') guarda el SHA-256 del payload en
-- español desde el que se generaron. El pipeline compara ese hash con el
-- payload español actual: si coincide, no vuelve a traducir ni a cobrar.
--
-- En las filas en español la columna queda NULL: son el original, no una
-- traducción de nada.
--
-- Migración idempotente.

alter table public.site_content_sections
  add column if not exists source_hash text;

comment on column public.site_content_sections.source_hash is
  'SHA-256 del payload en español desde el que se tradujo esta fila; NULL en las filas originales.';

/*
 * `manual_override` protege una corrección hecha a mano desde el editor
 * (`?i18n=1`). Cuando está activo el pipeline no toca la fila, igual que
 * `origin = manual` en catalog_translations.
 */
alter table public.site_content_sections
  add column if not exists manual_override boolean not null default false;

comment on column public.site_content_sections.manual_override is
  'Si es true, la traducción se editó a mano y el pipeline automático no la sobrescribe.';
