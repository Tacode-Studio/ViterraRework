/**
 * Traducción de los campos enumerables del catálogo (tipo, estatus, situación,
 * amenidades, servicios, etiquetas y características).
 *
 * Estos valores vienen del sync de Tokko en español, pero son un conjunto
 * cerrado y repetido: 121 términos distintos cubren las 256 propiedades del
 * catálogo. Traducirlos con tabla da calidad perfecta y costo cero, a
 * diferencia de las descripciones largas, que son texto libre.
 *
 * Un término desconocido se devuelve tal cual: si Tokko agrega vocabulario
 * nuevo, aparece en español en vez de romperse o quedar vacío.
 */
import { DEFAULT_LOCALE, type Locale } from "./locale";

/**
 * Clave de búsqueda: minúsculas, espacios colapsados y sin punto final.
 * Necesario porque el catálogo trae el mismo término escrito de varias formas
 * ("Agua Potable" y "Agua potable", "Instalación eléctrica subterránea.").
 */
export function normalizeCatalogTerm(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.+$/, "").trim();
}

/** Tipo de propiedad (`properties.type`, `developments.type`). */
const TYPE_EN: Record<string, string> = {
  "departamento": "Apartment",
  "casa": "House",
  "terreno": "Land",
  "terreno comercial": "Commercial land",
  "local": "Retail space",
  "depósito": "Warehouse",
  "oficina": "Office",
  "edificio comercial": "Commercial building",
  "bodega": "Warehouse",
  "edificio": "Building",
  "quinta": "Country house",
  "campo": "Farmland",
  "cochera": "Parking space",
  /* Tipos que solo aparecen en `developments.type`. */
  "condominio": "Condominium",
  "condominio industrial": "Industrial condominium",
  "barrio privado": "Gated community",
  "otro": "Other",
};

/**
 * Avance de obra de un desarrollo (`developments.status`). Tabla aparte de
 * STATUS_EN, que describe la operación (venta/renta) de una propiedad: son
 * dimensiones distintas que coinciden en nombre de columna.
 */
const DEVELOPMENT_STATUS_EN: Record<string, string> = {
  "en construcción": "Under construction",
  "disponible": "Available",
  "próximamente": "Coming soon",
  "entregado": "Delivered",
  "preventa": "Pre-sale",
};

/** Estatus interno (`properties.status`), no viene de Tokko como texto libre. */
const STATUS_EN: Record<string, string> = {
  "venta": "For sale",
  "alquiler": "For rent",
  "renta": "For rent",
  "venta_y_alquiler": "For sale or rent",
};

/** Situación de ocupación (`properties.situation`). */
const SITUATION_EN: Record<string, string> = {
  "vacía": "Vacant",
  "habitada": "Occupied",
  "inquilino": "Tenant occupied",
  "---": "—",
};

/**
 * Amenidades, servicios, etiquetas y características adicionales. Van juntos
 * porque el catálogo repite el mismo término entre campos ("Apto mascotas"
 * aparece como etiqueta y como amenidad).
 */
const FEATURE_EN: Record<string, string> = {
  "a estrenar": "Brand new",
  "accesibilidad c/ movilidad reducida": "Wheelchair accessible",
  "acepta mascotas": "Pets allowed",
  "agua corriente": "Running water",
  "agua potable": "Drinking water",
  "aire acondicionado central": "Central air conditioning",
  "aire acondicionado individual": "Individual air conditioning",
  "al lago": "Lakefront",
  "altillo": "Attic",
  "alumbrado público": "Street lighting",
  "amenities": "Amenities",
  "amoblado": "Furnished",
  "apto mascotas": "Pets allowed",
  "apto profesional": "Suitable for professional use",
  "armarios empotrados": "Built-in wardrobes",
  "ascensor": "Elevator",
  "balcón": "Balcony",
  "balcón terraza": "Terrace balcony",
  "barrio privado": "Gated community",
  "baulera": "Storage room",
  "baño de servicio": "Service bathroom",
  "biblioteca": "Library",
  "bodega": "Storage",
  "cable": "Cable TV",
  "cancha de fútbol": "Soccer field",
  "cancha de golf": "Golf course",
  "cancha de tenis": "Tennis court",
  "cerramiento perimetral": "Perimeter fencing",
  "chimenea": "Fireplace",
  "cloaca": "Sewer",
  "club house": "Club house",
  "cochera subterránea": "Underground parking",
  "cocina": "Kitchen",
  "colegio": "School nearby",
  "comedor diario": "Breakfast nook",
  "dependencia": "Staff quarters",
  "detector de incendios": "Fire detector",
  "drenaje": "Drainage",
  "edificio de oficinas administrativas": "Administrative office building",
  "electricidad": "Electricity",
  "elevador": "Elevator",
  "en construcción": "Under construction",
  "encargado": "Building manager",
  "escritorio": "Study",
  "escritura inmediata": "Immediate deed transfer",
  "espacio para lectura": "Reading nook",
  "esquina": "Corner lot",
  "estacionamiento de visitas": "Visitor parking",
  "estilo moderno": "Modern style",
  "galería": "Covered porch",
  "gas envasado": "Bottled gas",
  "gas natural": "Natural gas",
  "gimnasio": "Gym",
  "guarda de seguridad": "Security guard",
  "hall": "Entrance hall",
  "hidromasaje": "Whirlpool tub",
  "iluminación natural": "Natural light",
  "instalación eléctrica subterránea": "Underground power lines",
  "internet": "Internet",
  "jardín": "Garden",
  "laundry": "Laundry room",
  "lavadero": "Laundry room",
  "lavavajillas": "Dishwasher",
  "limpieza de áreas comunes": "Common area cleaning",
  "living comedor": "Living-dining room",
  "lote interno": "Interior lot",
  "luminoso": "Bright",
  "mantenimiento incluido": "Maintenance included",
  "microcine": "Screening room",
  "microondas": "Microwave",
  "oficina": "Office",
  "parrilla": "Barbecue grill",
  "parrilla techada": "Covered barbecue area",
  "patio": "Patio",
  "patio de juegos": "Playground",
  "pavimentación": "Paved roads",
  "pavimento": "Paved road",
  "perimetral": "Perimeter fencing",
  "persianas": "Window blinds",
  "pileta": "Swimming pool",
  "pileta climatizada": "Heated pool",
  "pileta comunitaria": "Community pool",
  "pileta descubierta": "Outdoor pool",
  "portones eléctricos": "Electric gates",
  "potencial alto para alquilar": "High rental potential",
  "preinstalación de aire acondicionado": "Air conditioning pre-installation",
  "puerta de garaje automática": "Automatic garage door",
  "recepción 24 horas": "24-hour reception",
  "recolección de basura": "Garbage collection",
  "red de desagües pluviales": "Storm drainage",
  "restaurante": "Restaurant",
  "riego automático": "Automatic irrigation",
  "sala de juegos": "Game room",
  "sala de reuniones": "Meeting room",
  "salón de usos múltiples": "Multipurpose room",
  "salón para niños": "Children's playroom",
  "sauna": "Sauna",
  "seguridad": "Security",
  "seguridad 24hs": "24-hour security",
  "seguridad privada": "Private security",
  "solarium": "Sun deck",
  "spa": "Spa",
  "sum": "Multipurpose room",
  "sótano": "Basement",
  "teléfono": "Landline",
  "terraza": "Terrace",
  "toilette": "Powder room",
  "ubicación tranquila": "Quiet location",
  "una planta": "Single story",
  "vestidor": "Walk-in closet",
  "video cámaras": "Security cameras",
  "videovigilancia": "Video surveillance",
  "vista a la montaña": "Mountain view",
  "vista al mar": "Ocean view",
  "vista al valle": "Valley view",
  "vista panorámica": "Panoramic view",
  "wifi": "Wi-Fi",
  "zona apta para turismo": "Tourism-friendly area",
  "zonas verdes": "Green areas",
  "área de asadores": "Barbecue area",
  "área recreativa": "Recreation area",
};

function translateWith(
  table: Record<string, string>,
  raw: string | undefined | null,
  locale: Locale,
): string {
  const value = raw?.trim() ?? "";
  if (!value || locale === DEFAULT_LOCALE) return value;
  return table[normalizeCatalogTerm(value)] ?? value;
}

/** Tipo de propiedad o desarrollo. */
export function translatePropertyType(raw: string | undefined | null, locale: Locale): string {
  return translateWith(TYPE_EN, raw, locale);
}

/** Estatus de la operación (venta / alquiler). */
export function translatePropertyStatus(raw: string | undefined | null, locale: Locale): string {
  return translateWith(STATUS_EN, raw, locale);
}

/** Situación de ocupación. */
export function translatePropertySituation(raw: string | undefined | null, locale: Locale): string {
  return translateWith(SITUATION_EN, raw, locale);
}

/** Avance de obra de un desarrollo ("En Construcción", "Disponible"…). */
export function translateDevelopmentStatus(
  raw: string | undefined | null,
  locale: Locale,
): string {
  return translateWith(DEVELOPMENT_STATUS_EN, raw, locale);
}

/** Amenidad, servicio, etiqueta o característica adicional. */
export function translateCatalogFeature(raw: string | undefined | null, locale: Locale): string {
  return translateWith(FEATURE_EN, raw, locale);
}

/** Lista de amenidades/servicios/etiquetas, conservando el orden. */
export function translateCatalogFeatures(
  values: readonly string[] | undefined | null,
  locale: Locale,
): string[] {
  if (!values?.length) return [];
  if (locale === DEFAULT_LOCALE) return [...values];
  return values.map((v) => translateCatalogFeature(v, locale));
}

/** Solo para pruebas: cobertura del vocabulario real del catálogo. */
export const CATALOG_TERM_TABLES = {
  type: TYPE_EN,
  status: STATUS_EN,
  developmentStatus: DEVELOPMENT_STATUS_EN,
  situation: SITUATION_EN,
  feature: FEATURE_EN,
} as const;
