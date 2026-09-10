# ADR-001: Baja en el CRM de propiedades y desarrollos eliminados en Tokko

**Estado:** Aceptado — implementado
**Fecha:** 2026-09-10
**Decisores:** Cristóbal (implementación) · Cliente (aprobación funcional)

## Contexto

Los botones "Importar de Tokko Broker" del panel (propiedades y desarrollos) solo insertan
y actualizan. Cuando el cliente elimina una propiedad o un desarrollo en Tokko Broker, la
ficha sigue viva en el CRM y sigue publicándose en el sitio web. El cliente pide que esos
mismos botones puedan dar de baja lo que ya no existe en Tokko.

### Qué hay hoy en el código

**El borrado ya existe, pero fuera del alcance del panel.** `tokko-sync` tiene un modo
`"full"` que hace `DELETE` de todo `tokko_id` presente en la base y ausente en la respuesta
de Tokko, excluyendo los manuales:

- Propiedades y desarrollos: bloques `if (propertiesMode === "full")` / `developmentsMode === "full"`
- Protección de manuales: `isManualTokkoId` — prefijo `manual_` o IDs 9000000–9999999

*(Referencias al código previo al cambio; ver "Implementación" al final para el estado actual.)*

Ese modo solo se alcanza vía curl/cron con `SYNC_HTTP_SECRET` (sin `propertiesMode` ni
`developmentsMode` en el body). **No hay ningún cron configurado en el repo**, así que hoy
está dormido y nunca se ejercitó en producción.

Los diálogos del panel lo evitan a propósito: `PropertyImportDialog.tsx:117` envía
`insertOnlyNew: true` junto con el modo, como red de seguridad para que una Edge Function
desactualizada caiga en "solo nuevas" y no en el modo con borrado.

### Fuerzas en juego

**1. La paginación de Tokko puede truncarse en silencio.** `fetchTokkoAllItems`
(`index.ts:203`) corta por `TOKKO_MAX_BATCHES`, por página incompleta o por ausencia de
`total_count`, **sin lanzar error**. Si Tokko devuelve la mitad del catálogo, el modo `full`
interpreta la otra mitad como "ya no existe" y la borra. El único guardia actual es
`errors.length === 0 && fetchedTokkoIds.length > 0`, que no detecta un fetch truncado.

**2. El borrado se lleva datos que solo viven en el CRM.** Tokko no conoce
`contact_phone`, `contact_whatsapp`, `video_url`, `video_storage_path` (archivo en el bucket
`property-media`, hasta 5 GB), `tour_3d_url` ni `featured`. Si la propiedad vuelve, hay que
rehacerlo a mano.

**3. El borrado deja huérfanos.** `catalog_translations` referencia `entity_id` sin FK
(`20260818140000_catalog_translations.sql`), así que las traducciones pagadas quedan
colgando y se vuelven a pagar si la ficha regresa. Los leads guardan `relatedPropertyId`
dentro de `payload` (`20260618140000_rate_limit_and_contact_lead.sql:296`), así que la ficha
del lead apuntaría a una propiedad inexistente. `property_tag_links` y `development_units`
sí cascadean correctamente.

**4. `deleted_at` no sirve como bandera de visibilidad.** Existe en ambas tablas y se
puebla desde el `deleted_at` de Tokko (`index.ts:526` y `:700`), pero ningún query lo filtra
— y hay un comentario explícito en `supabaseProperties.ts:434` explicando por qué: en datos
sincronizados de Tokko a veces nunca queda `NULL` y el listado quedaría vacío. Es dato
muerto y no debe reutilizarse.

**5. Los desarrollos ya tienen el patrón resuelto.** `developments.display_on_web` +
la opción `publicOnly` en `fetchDevelopmentsWithUnits` / `fetchDevelopmentsPage`
(`supabaseDevelopments.ts:239-247, 284-290`) son exactamente la plomería que hace falta.
Propiedades no tiene equivalente.

## Decisión

Los botones de importación ganan una baja **reversible por archivado**, con **confirmación
previa mostrando la lista**, **solo manual** (sin cron), y con criterio **"ausente de la API
de Tokko"** — es decir, eliminada desde Tokko Broker.

El borrado físico deja de ser un efecto secundario del import y pasa a ser una acción
deliberada por ítem desde una vista "Archivadas".

### Diseño

**a) Columna nueva, no reutilizar `deleted_at`**

```sql
alter table public.properties
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

alter table public.developments
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

create index if not exists properties_archived_at_idx
  on public.properties (archived_at) where archived_at is null;
create index if not exists developments_archived_at_idx
  on public.developments (archived_at) where archived_at is null;
```

`archived_reason` distingue `'missing_in_tokko'` de `'manual'` (una baja hecha a mano
desde el panel), para que la vista de archivadas explique por qué desapareció cada ficha.

**b) Modo nuevo en `tokko-sync`: `pruneMissing`**

Se combina con los modos actuales en vez de reemplazarlos:

```jsonc
{ "resources": ["properties"], "propertiesMode": "sync_all",
  "pruneMissing": true, "dryRun": true }
```

- `dryRun: true` → **no escribe**: devuelve `prune.candidates` con
  `{ id, tokko_id, title, reference_code }` de cada ficha ausente en Tokko.
- `dryRun: false` → aplica `UPDATE ... SET archived_at = now(),
  archived_reason = 'missing_in_tokko'` sobre esos `tokko_id`. Nunca `DELETE`.
- **Desarchivado automático:** todo `tokko_id` que vuelva a aparecer en la respuesta de
  Tokko y tenga `archived_at IS NOT NULL` se limpia a `NULL` en el mismo upsert. Cubre el
  caso frecuente de una propiedad pausada en Tokko que regresa.

**c) Guardias en el servidor, no solo en la UI**

Sin esto, el flujo sigue siendo tan peligroso como el modo `full`:

1. `fetchTokkoAllItems` debe devolver `{ items, complete: boolean }`. `complete` es `false`
   si se agotó `maxBatches`/`maxPages`, o si Tokko reportó `total_count` y se recibieron
   menos ítems. **Con `complete === false` el prune se salta y se reporta el motivo.**
2. **Umbral proporcional:** si los candidatos superan el 20 % del catálogo (o un mínimo
   absoluto, p. ej. 25 fichas), la función rechaza el prune con
   `error: "prune_threshold_exceeded"` y el detalle del conteo. Solo se aplica si el body
   trae `force: true`, que el diálogo envía únicamente tras una segunda confirmación
   explícita del usuario.
3. `errors.length === 0` sigue siendo requisito (ya existe).
4. `isManualTokkoId` sigue excluyendo lo creado a mano en el CRM (ya existe).
5. Autorización: la función ya exige `role='admin'` estricto por JWT
   (`isAuthorizedAdminJwt`, `index.ts:1025`). No hace falta cambiar nada.

**d) Filtro de visibilidad en el sitio**

- **Propiedades:** `fetchCatalogProperties` recibe `includeArchived?: boolean`. El hook
  `useCatalogProperties` lo propaga. Las páginas públicas (`SalePage`, `RentPage`,
  `PropertiesPage`, `HomePage`, `MapSearchPage`, `PropertyDetailPage`, `WishlistPage`)
  quedan con el filtro `archived_at IS NULL`; `AdminWorkspace.tsx:385` pasa
  `includeArchived: true` para poder gestionarlas. También `fetchFeaturedPropertiesForHome`
  y `useCatalogPriceSlices`.
- **Desarrollos:** reutilizar la opción `publicOnly` existente, añadiendo
  `.is("archived_at", null)` junto al `display_on_web` actual.
- **Defensa en profundidad (opcional):** añadir `archived_at is null` a la política RLS de
  `select` para `anon`, para que una ficha archivada no sea consultable desde el cliente
  aunque alguien construya el query a mano.

**e) Flujo del botón (dos pasos)**

En `PropertyImportDialog` / `DevelopmentImportDialog`, un checkbox bajo el selector de modo:
*"Dar de baja las que ya no están en Tokko"*, disponible en `update_only` y `sync_all`
(no en `new_only`, donde no tiene sentido).

1. Clic en importar → llamada con `pruneMissing: true, dryRun: true`.
2. Paso nuevo `"confirm-prune"`: *"3 propiedades ya no están en Tokko y se ocultarán del
   sitio: Casa Providencia · Depto Andares · Local Chapalita. Podrás restaurarlas desde
   Archivadas."* Botones **Confirmar baja** / **Importar sin dar de baja**.
3. Confirmar → segunda llamada con `dryRun: false`.

Si el servidor devuelve `prune_threshold_exceeded`, el diálogo muestra la advertencia fuerte
("Tokko devolvió mucho menos catálogo del habitual; puede ser un fallo temporal de su API")
y solo entonces ofrece el botón que reenvía con `force: true`.

**f) Vista "Archivadas" en el panel**

Filtro/pestaña en el inventario de propiedades y en el de desarrollos, con la fecha y el
motivo de archivado, y dos acciones: **Restaurar** (`archived_at = null`) y **Eliminar
definitivamente**. Solo esa última hace `DELETE`, y debe además:

- borrar las filas de `catalog_translations` de esa `entity_id` (no hay FK que cascadee);
- borrar el objeto de `property-media` si hay `video_storage_path`, y los espejos del bucket
  de listings.

**g) Cerrar el modo `full`**

El `DELETE` masivo de `index.ts:1452` y `:1245` se reemplaza por la misma ruta de archivado
con guardias. Hoy está a un curl de distancia de vaciar el catálogo y ya no tiene consumidor
(no hay cron). Nota aparte: `softDeleteProperty` (`supabaseProperties.ts:524`) y
`softDeleteDevelopment` (`supabaseDevelopments.ts:472`) están mal nombradas — hacen `DELETE`
duro. Al introducir `archived_at` conviene renombrarlas o hacerlas coherentes con el nombre.

## Opciones consideradas

### Opción A: Borrado duro desde el botón (exponer el modo `full` al panel)

| Dimensión | Evaluación |
|---|---|
| Complejidad | Baja — el código ya existe, es quitar la restricción |
| Costo | Nulo en desarrollo, alto ante el primer incidente |
| Escalabilidad | Igual que hoy |
| Familiaridad del equipo | Total |

**Pros:** es literalmente lo que el cliente pidió; cero código nuevo en la base de datos; sin
filtros nuevos en las consultas públicas.

**Contras:** irreversible; pierde video, tour 3D, teléfono de contacto y destacado; deja
traducciones huérfanas que se vuelven a pagar; rompe el enlace de leads existentes; y sobre
todo, un fetch truncado de Tokko vacía el catálogo sin aviso ni vuelta atrás.

### Opción B: Archivado reversible con confirmación previa (elegida)

| Dimensión | Evaluación |
|---|---|
| Complejidad | Media — 1 migración, 1 modo en la Edge Function, filtro en consultas públicas, 1 vista de admin |
| Costo | ~2-3 días de trabajo |
| Escalabilidad | Buena; el índice parcial mantiene el catálogo público rápido |
| Familiaridad del equipo | Alta — `display_on_web` ya es este mismo patrón |

**Pros:** cumple el requisito real ("que no se muestren en el sitio"); reversible con un
clic; conserva los datos que solo viven en el CRM; el desarchivado automático absorbe las
despublicaciones temporales de Tokko; los guardias convierten un fallo de la API de Tokko en
un mensaje de error en vez de en una pérdida de datos.

**Contras:** las filas se acumulan (mitigable con purga por antigüedad más adelante); hay
que tocar todas las consultas públicas de propiedades; una ficha archivada sigue ocupando
espacio de media hasta que alguien la purgue.

### Opción C: Cron nocturno con prune automático

| Dimensión | Evaluación |
|---|---|
| Complejidad | Media-baja sobre la opción B |
| Costo | Bajo |
| Escalabilidad | Buena |
| Familiaridad del equipo | Media — no hay ningún cron en el proyecto todavía |

**Pros:** el sitio nunca muestra fichas muertas entre importaciones manuales; nadie tiene
que acordarse de pulsar el botón.

**Contras:** no es lo que el cliente pidió; sin supervisión humana, los guardias son la
única defensa ante un mal día de la API de Tokko; y no hay infraestructura de cron ni de
alertas montada para enterarse si falla.

## Análisis de trade-offs

El eje real no es "borrar vs. no borrar", sino **quién absorbe el costo de un error**. Con
borrado duro, un fallo de la API de Tokko o un truncamiento de paginación se paga con
pérdida de datos irrecuperable y trabajo manual de recaptura. Con archivado, se paga con
una fila extra en la tabla y un clic de "Restaurar".

Ese seguro cuesta una columna, un filtro por consulta y una vista de admin. Dado que el
requisito del cliente es de **visibilidad** ("que ya no se muestren en el sitio web") y no
de borrado, la opción B lo satisface por completo sin asumir el riesgo de la A.

La confirmación previa (dos pasos) es la parte que más valor aporta por lo poco que cuesta:
convierte una operación destructiva y ciega en una revisada. El cliente ve exactamente qué
fichas van a desaparecer antes de que desaparezcan.

Se descartó el cron por ahora porque añade una superficie autónoma sobre un flujo que
todavía no tiene rodaje en producción. Vale la pena reconsiderarlo cuando el archivado
manual lleve unos meses funcionando y haya confianza en los guardias.

## Consecuencias

**Qué se vuelve más fácil**
- Dar de baja del sitio lo eliminado en Tokko, sin tocar la base de datos a mano.
- Deshacer una baja equivocada.
- Auditar por qué desapareció una ficha (`archived_reason` + fecha).
- Sobrevivir a un fallo parcial de la API de Tokko sin daño.

**Qué se vuelve más difícil**
- Toda consulta pública nueva sobre `properties` debe acordarse del filtro `archived_at`.
  Conviene encapsularlo en los helpers de `supabaseProperties.ts` y no repetirlo suelto.
- El inventario del admin ahora tiene dos estados visibles y necesita distinguirlos en la UI.

**Qué habrá que revisar**
- Si las fichas archivadas se acumulan, definir política de purga automática (p. ej. 90
  días) — hoy queda como decisión pendiente, no se implementa.
- Si el cliente pide más adelante dar de baja también por estado (vendida/reservada) o por
  la marca de publicación web de Tokko, el criterio se amplía en `pruneMissing` sin cambiar
  la arquitectura: cambia qué se considera candidato, no qué se hace con los candidatos.
- El umbral del 20 % puede necesitar ajuste según el tamaño real del catálogo.

## Action items

1. [x] Migración `archived_at` + `archived_reason` + índices parciales en `properties` y `developments`.
2. [x] `fetchTokkoAllItemsChecked` devuelve `{ items, complete, incompleteReason }`, propagado a ambos bloques.
3. [x] Modo `pruneMissing` en `tokko-sync`: candidatos en `dryRun`, archivado en la pasada real, desarchivado automático de lo que reaparece.
4. [x] Guardias: `complete === false` bloquea, umbral del 20 % con `forcePrune`, `isManualTokkoId` y `errors.length === 0`.
5. [x] El `DELETE` del modo `full` pasa por la misma ruta de archivado con guardias.
6. [x] `includeArchived` en `fetchCatalogProperties` / `useCatalogProperties`; filtro en el catálogo, destacadas de portada, propiedades de un desarrollo y `useCatalogPriceSlices`.
7. [x] `archived_at is null` junto a `display_on_web` en el `publicOnly` de desarrollos.
8. [x] Casilla + paso de confirmación en los dos diálogos, incluido el camino de `threshold_exceeded` con `forcePrune`.
9. [x] Vista "Dadas de baja" con Restaurar y Eliminar definitivamente (limpiando `catalog_translations` y los objetos de storage).
10. [x] Tests: guardias del prune, filtro de visibilidad con su respaldo, y el flujo de dos pasos del diálogo.
11. [x] Sección de operación en el README.

Pendiente, fuera del alcance de este cambio:

- Política de purga automática de fichas archivadas (se decidió no implementarla todavía).
- Cron nocturno: sigue descartado hasta que el flujo manual tenga rodaje.

## Implementación

**Base de datos** — `supabase/migrations/20260910120000_catalog_archived_at.sql`: columnas,
check de `archived_reason`, índices parciales y políticas RLS que ocultan lo archivado al rol
`anon` (defensa en profundidad sobre el filtro de las consultas).

**Edge Function** — `supabase/functions/tokko-sync/`:
- `prune.ts` (nuevo): la lógica pura —`selectPruneCandidates`, `pruneBlockReason`,
  `isManualTokkoId`, umbrales—, fuera de `index.ts` para poder probarla con Vitest.
- `index.ts`: `fetchTokkoAllItemsChecked`, `collectPruneCandidates` (paginado de 1000 en 1000,
  porque PostgREST corta ahí y el `select` anterior se dejaba fichas fuera),
  `archiveCandidates`, `unarchiveReturned` y `runPrune`.

**Sitio** — `supabaseProperties.ts` (`withArchivedFilterFallback`, compartido con
`supabaseDevelopments.ts`), `useCatalogProperties` (caché de sesión separada para el panel,
que sí ve las archivadas), `useCatalogPriceSlices` y `api/legacy-listing.ts`.

**Panel** — `TokkoImportDialog.tsx` (nuevo) concentra el flujo de importación; los dos
diálogos anteriores, que eran duplicados salvo el género de las palabras, quedan como copy.
`AdminPropertiesViews` y `AdminDevelopmentsManager` muestran el distintivo y los botones de
dar de baja y restaurar; el borrado definitivo pasa por `deletePropertyPermanently` /
`deleteDevelopmentPermanently`, que limpian traducciones y archivos.

Se añadió además la baja manual por ficha (`archived_reason = 'manual'`), que no estaba en el
diseño original: sin ella, los diálogos de borrado ofrecían "dala de baja" como alternativa
segura y esa acción no existía en ninguna parte. La importación nunca reactiva una baja
manual, solo las que archivó ella misma por ausencia.

**Tests** — `tokkoPrune.test.ts` (guardias), `catalogArchivedVisibility.test.ts` (filtro y
respaldo sin migración), `PropertyImportDialog.test.tsx` (flujo de dos pasos, umbral y
bloqueos no forzables).

### Nota sobre `softDeleteProperty` / `softDeleteDevelopment`

Se llamaban "soft delete" pero hacían `DELETE`. Al existir ahora una baja reversible de
verdad, se renombraron a `deletePropertyPermanently` / `deleteDevelopmentPermanently` y se
les añadió la limpieza de dependientes.
