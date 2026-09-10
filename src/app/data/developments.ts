export interface DevelopmentUnit {
  type: string;
  address: string;
  spaces: number;
  bedrooms: number;
  coveredArea: number;
  totalArea: number;
  parking: boolean;
  price: number;
  forRent: boolean;
}

import type { PropertyTour3dEntry } from "../lib/propertyTours3d";
import type { PropertyVideoEntry } from "../lib/propertyVideos";

export interface Development {
  id: string;
  name: string;
  location: string;
  colony: string;
  fullAddress: string;
  type: string;
  description: string;
  richDescription?: string;
  image: string;
  images: string[];
  status: "En Construcción" | "Pre-venta" | "Disponible" | "Próximamente";
  units: number;
  deliveryDate: string;
  priceRange: string;
  amenities: string[];
  services: string[];
  additionalFeatures: string[];
  developmentUnits: DevelopmentUnit[];
  videos?: PropertyVideoEntry[];
  tours3d?: PropertyTour3dEntry[];
  /** @deprecated Primer video externo. */
  videoUrl?: string;
  /** @deprecated Primer tour 3D. */
  tour3dUrl?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  featured?: boolean;
  displayOnWeb?: boolean;
  /**
   * Fecha de baja (`developments.archived_at`): sigue en el CRM pero no se publica.
   * Solo llega en las consultas del panel; el sitio filtra estas fichas. Ver docs/ADR-001.
   */
  archivedAt?: string;
  /** Por qué se dio de baja: ausente en la última importación de Tokko, o baja manual. */
  archivedReason?: "missing_in_tokko" | "manual";
  inChargePhone?: string;
  inChargeWhatsapp?: string;
  inChargeName?: string;
  inChargeEmail?: string;
  referenceCode?: string;
  tokkoId?: string;
  payload?: Record<string, unknown>;
}

/** Valor mostrado en el sitio público cuando no hay fecha de entrega en catálogo. */
export function displayDeliveryDate(value: string | undefined | null): string {
  const t = String(value ?? "").trim();
  return t.length > 0 ? t : "Por definir";
}

/** @deprecated Sin datos mock; el catálogo viene de Supabase. */
export const seedDevelopments: Development[] = [];

/** Alias para páginas que importaban `developments`; usar datos remotos. */
export const developments: Development[] = seedDevelopments;
