import type { TranslationKey } from "../i18n/dictionaries";
import type { Property } from "../components/PropertyCard";

/** Clave de ordenación del catálogo (público y admin). */
export type CatalogPropertySortKey =
  | "newest"
  | "price-low"
  | "price-high"
  | "area-small"
  | "area-large"
  | "bedrooms-low"
  | "bedrooms-high"
  | "bathrooms-low"
  | "bathrooms-high";

function cmpId(a: Property, b: Property): number {
  return a.id.localeCompare(b.id);
}

/** Ordena una copia del listado; `newest` conserva el orden recibido (p. ej. del hook / Supabase). */
export function sortCatalogProperties(
  items: Property[],
  sortKey: CatalogPropertySortKey
): Property[] {
  const next = [...items];
  if (sortKey === "newest") return next;

  switch (sortKey) {
    case "price-low":
      next.sort((a, b) => (a.price !== b.price ? a.price - b.price : cmpId(a, b)));
      break;
    case "price-high":
      next.sort((a, b) => (a.price !== b.price ? b.price - a.price : cmpId(a, b)));
      break;
    case "area-small":
      next.sort((a, b) => (a.area !== b.area ? a.area - b.area : cmpId(a, b)));
      break;
    case "area-large":
      next.sort((a, b) => (a.area !== b.area ? b.area - a.area : cmpId(a, b)));
      break;
    case "bedrooms-low":
      next.sort((a, b) =>
        a.bedrooms !== b.bedrooms ? a.bedrooms - b.bedrooms : cmpId(a, b)
      );
      break;
    case "bedrooms-high":
      next.sort((a, b) =>
        a.bedrooms !== b.bedrooms ? b.bedrooms - a.bedrooms : cmpId(a, b)
      );
      break;
    case "bathrooms-low":
      next.sort((a, b) =>
        a.bathrooms !== b.bathrooms ? a.bathrooms - b.bathrooms : cmpId(a, b)
      );
      break;
    case "bathrooms-high":
      next.sort((a, b) =>
        a.bathrooms !== b.bathrooms ? b.bathrooms - a.bathrooms : cmpId(a, b)
      );
      break;
    default:
      break;
  }
  return next;
}

/**
 * Opciones de `<select>` compartidas (landing y admin).
 * `label` es el texto en español que usa el admin —que no se traduce—; las
 * páginas públicas renderizan `t(labelKey)` para seguir el idioma activo.
 */
export const CATALOG_PROPERTY_SORT_OPTIONS: {
  value: CatalogPropertySortKey;
  label: string;
  labelKey: TranslationKey;
}[] = [
  { value: "newest", label: "Más recientes", labelKey: "sort.newest" },
  { value: "price-low", label: "Precio: menor a mayor", labelKey: "sort.priceAsc" },
  { value: "price-high", label: "Precio: mayor a menor", labelKey: "sort.priceDesc" },
  { value: "area-small", label: "Área: menor a mayor", labelKey: "sort.areaAsc" },
  { value: "area-large", label: "Área: mayor a menor", labelKey: "sort.areaDesc" },
  { value: "bedrooms-low", label: "Recámaras: menor a mayor", labelKey: "sort.bedroomsAsc" },
  { value: "bedrooms-high", label: "Recámaras: mayor a menor", labelKey: "sort.bedroomsDesc" },
  { value: "bathrooms-low", label: "Baños: menor a mayor", labelKey: "sort.bathroomsAsc" },
  { value: "bathrooms-high", label: "Baños: mayor a menor", labelKey: "sort.bathroomsDesc" },
];
