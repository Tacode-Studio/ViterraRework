-- Contenido editable del sitio por idioma.
--
-- Antes había una fila por página; ahora hay una por (página, idioma), de modo
-- que el admin edita ES y EN por separado sin duplicar formularios. Las filas
-- existentes quedan como 'es' por el DEFAULT de la columna.
--
-- El cliente resuelve la cadena de respaldo EN -> ES -> DEFAULT_SITE_CONTENT,
-- así que una página sin traducir se muestra en español en vez de vacía.
--
-- Migración idempotente: se puede reaplicar sin dejar residuo.

alter table public.site_content_sections
  add column if not exists locale text not null default 'es';

alter table public.site_content_sections
  drop constraint if exists site_content_sections_locale_chk;

alter table public.site_content_sections
  add constraint site_content_sections_locale_chk
  check (locale in ('es', 'en'));

-- La PK pasa de `page` a `(page, locale)`.
alter table public.site_content_sections
  drop constraint if exists site_content_sections_pkey;

alter table public.site_content_sections
  add constraint site_content_sections_pkey primary key (page, locale);

/*
 * `footer` faltaba en el CHECK desde que se agregó la sección: el cliente la
 * incluye en SITE_CONTENT_PAGE_KEYS y la escribe, pero la restricción la
 * rechazaba, así que guardar el pie de página fallaba en silencio para el
 * editor. Se aprovecha que aquí se reconstruye el constraint.
 */
alter table public.site_content_sections
  drop constraint if exists site_content_sections_page_chk;

alter table public.site_content_sections
  add constraint site_content_sections_page_chk
  check (
    page in (
      'home',
      'header',
      'footer',
      'contact',
      'services',
      'about',
      'developments',
      'rent',
      'sale'
    )
  );

comment on column public.site_content_sections.locale is
  'Idioma del payload; el cliente hace fallback EN -> ES -> defaults del bundle.';
