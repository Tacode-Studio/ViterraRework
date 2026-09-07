import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Svg, Path, G, Rect, Circle } from "@react-pdf/renderer";
import type { Property } from "../PropertyCard";
import { descriptionSourceToStructuredText, resolvePublicDescription } from "../../lib/propertyDescription";
import type { Development } from "../../data/developments";
import type { User } from "../../contexts/AuthContext";
import { loadWorkspaceAdminSettings } from "../../data/workspaceSettings";

export interface PdfManualFields {
  frente?: string;
  fondo?: string;
  incluidoMantenimiento?: string;
  publicidad?: string;
  jardinM2?: string;
  salaTv?: string;
  estudio?: string;
  unidadesPrivativas?: string;
  enCoto?: string;
  vigilancia?: string;
  jardin?: string;
  terraza?: string;
  balcon?: string;
  amueblado?: string;
  estudiantes?: string;
  mascota?: string;
  cuartoServicio?: string;
  banoServicio?: string;
  condicionesVisita?: string;
}

interface FichaTecnicaPdfProps {
  data: Property | Development;
  type: "property" | "development";
  includeLogo: boolean;
  user: User | null;
  manualFields?: PdfManualFields;
}

const BRAND_RED = "#7a171d";
const BRAND_BLACK = "#101010";
const BRAND_LIGHT_RED = "#c28185";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
  },
  // TOP BANNER
  topBanner: {
    height: 100,
    backgroundColor: BRAND_BLACK,
    flexDirection: "row",
    paddingHorizontal: 30,
    paddingVertical: 15,
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    height: 50,
    marginRight: 20,
  },
  bannerInfo: {
    borderLeftWidth: 1,
    borderLeftColor: "#ffffff",
    paddingLeft: 15,
    justifyContent: "center",
    height: 45,
  },
  bannerInfoTextRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  bannerInfoLabel: {
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    width: 60,
  },
  bannerInfoValue: {
    color: "#e2e8f0",
    fontSize: 9,
  },
  bannerTitleContainer: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingLeft: 10,
  },
  bannerTitle: {
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    textTransform: "uppercase",
  },
  
  // MAIN IMAGE AREA
  imageAreaContainer: {
    height: 220,
    width: "100%",
    overflow: "hidden",
    position: "relative",
  },
  mainImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  addressOverlay: {
    position: "absolute",
    top: 10,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingVertical: 6,
    paddingHorizontal: 14,
    maxWidth: "55%",
  },
  addressText1: {
    color: "#ffffff",
    fontSize: 10,
    textAlign: "right",
  },
  addressText2: {
    color: "#e2e8f0",
    fontSize: 9,
    textAlign: "right",
    marginTop: 2,
  },
  
  // BADGE OVERLAY (inside image, bottom-left)
  badgeOverlayContainer: {
    position: "absolute",
    left: 20,
    bottom: 15,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingRight: 16,
    borderRadius: 36,
  },
  badgeCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: BRAND_RED,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  badgeIconLabel: {
    color: "#ffffff",
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  badgePriceContainer: {
    justifyContent: "center",
  },
  badgeOperation: {
    color: BRAND_RED,
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    textTransform: "uppercase",
    marginBottom: -3,
  },
  badgePrice: {
    color: "#1e293b",
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
  },

  columnsContainer: {
    flexDirection: "row",
    flex: 1,
  },
  leftColumn: {
    width: "60%",
    padding: 20,
    backgroundColor: "#ffffff",
  },
  rightColumn: {
    width: "40%",
    backgroundColor: BRAND_RED,
    padding: 20,
  },

  // ICONS ROW
  iconsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: BRAND_LIGHT_RED,
    paddingBottom: 10,
  },
  iconBox: {
    alignItems: "center",
    flex: 1,
  },
  iconLabel: {
    color: BRAND_RED,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
    marginBottom: 4,
  },
  iconValue: {
    color: "#334155",
    fontSize: 16,
    fontFamily: "Helvetica",
  },

  // DATA TABLE
  tableGroup: {
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  tableCol: {
    flex: 1,
    paddingHorizontal: 2,
  },
  tableColBorderRight: {
    borderRightWidth: 1,
    borderRightColor: BRAND_LIGHT_RED,
  },
  tableHeaderContainer: {
    borderBottomWidth: 1,
    borderBottomColor: BRAND_RED,
    paddingBottom: 2,
    marginBottom: 4,
    marginHorizontal: 4,
  },
  tableHeader: {
    color: BRAND_RED,
    fontSize: 7,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  tableValue: {
    color: "#475569",
    fontSize: 9,
    textAlign: "center",
  },
  tableFullWidthContainer: {
    borderBottomWidth: 1,
    borderBottomColor: BRAND_RED,
    paddingBottom: 2,
    marginBottom: 4,
  },
  tableFullWidthHeader: {
    color: BRAND_RED,
    fontSize: 7,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    textAlign: "left",
  },
  tableFullWidthValue: {
    color: "#475569",
    fontSize: 9,
    textAlign: "left",
  },

  // DESCRIPTION COLUMN
  descTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    marginBottom: 15,
  },
  descText: {
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 10,
  },
  descHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    marginTop: 8,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 8,
  },
  bulletPoint: {
    width: 10,
    fontSize: 10,
    lineHeight: 1.5,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.5,
  },

  // PAGE 2: MAP & GALLERY
  page2Container: {
    padding: 30,
  },
  mapSection: {
    marginBottom: 20,
    height: 180,
    overflow: "hidden",
    borderRadius: 4,
    position: "relative",
  },
  mapTitleBox: {
    position: "absolute",
    top: 15,
    left: 0,
    backgroundColor: BRAND_RED,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  mapTitle: {
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    marginLeft: 6,
  },
  mapImagePlaceholder: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  galleryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  galleryImage: {
    width: "48%",
    height: 180,
    marginBottom: 15,
    objectFit: "cover",
    borderRadius: 4,
  },

  // FOOTER (absolute, always at bottom of page 2)
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BRAND_RED,
    padding: 18,
    paddingHorizontal: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerTitle: {
    color: "#eab308", // goldish
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    marginBottom: 8,
  },
  footerTextRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  footerText: {
    color: "#ffffff",
    fontSize: 10,
    marginLeft: 6,
  },
});

// SVG Icons
const IconHouse = () => (
  <Svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#ffffff" strokeWidth="1.5">
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Path d="M9 22V12h6v10" />
  </Svg>
);
const IconBed = () => (
  <Svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke={BRAND_RED} strokeWidth="1.5">
    <Path d="M3 7v10M21 7v10M3 12h18M5 12V9a2 2 0 012-2h10a2 2 0 012 2v3M5 12v3M19 12v3" />
  </Svg>
);
const IconBath = () => (
  <Svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke={BRAND_RED} strokeWidth="1.5">
    <Path d="M7 6h10M7 6a2 2 0 00-2 2v2a2 2 0 002 2h10a2 2 0 002-2V8a2 2 0 00-2-2M7 6v14M17 6v14M4 14h16M12 20v2" />
    <Circle cx="12" cy="16" r="1" fill={BRAND_RED} />
  </Svg>
);
const IconCar = () => (
  <Svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke={BRAND_RED} strokeWidth="1.5">
    <Path d="M4 17h16a2 2 0 002-2v-4l-2.5-4H4.5L2 11v4a2 2 0 002 2zM4 17v2a1 1 0 001 1h2a1 1 0 001-1v-2M16 17v2a1 1 0 001 1h2a1 1 0 001-1v-2" />
    <Circle cx="6.5" cy="13.5" r="1.5" />
    <Circle cx="17.5" cy="13.5" r="1.5" />
  </Svg>
);
const IconStairs = () => (
  <Svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke={BRAND_RED} strokeWidth="1.5">
    <Path d="M3 21h6v-6h6v-6h6V3" />
  </Svg>
);

const renderDescription = (text: string, isDarkBg: boolean) => {
  const textColor = isDarkBg ? "#f8fafc" : "#475569";
  const headerColor = isDarkBg ? "#ffffff" : "#0f172a";
  const bulletColor = isDarkBg ? "#ffffff" : "#475569";

  return text.split("\n").map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("*")) {
      return (
        <View key={index} style={styles.bulletRow}>
          <Text style={[styles.bulletPoint, {color: bulletColor}]}>•</Text>
          <Text style={[styles.bulletText, {color: textColor}]}>{trimmed.substring(1).trim()}</Text>
        </View>
      );
    }
    
    if (trimmed.endsWith(":")) {
      return (
        <Text key={index} style={[styles.descHeader, {color: headerColor}]}>
          {trimmed}
        </Text>
      );
    }

    return (
      <Text key={index} style={[styles.descText, {color: textColor}]}>
        {trimmed}
      </Text>
    );
  });
};

function stripHtml(html: string | undefined): string {
  return descriptionSourceToStructuredText(html) || "Sin descripción disponible.";
}

export function FichaTecnicaPdf({ data, type, includeLogo, user, manualFields }: FichaTecnicaPdfProps) {
  const isDev = type === "development";
  const p = data as any;
  
  const operationType = p.status === "alquiler" ? "RENTA" : "VENTA";
  const title = isDev ? p.name : (p.publicationTitle || p.title || "PROPIEDAD");
  const location = isDev ? (p.colony || p.location) : p.location;
  const address = p.fullAddress || location || "";
  const price = isDev ? p.priceRange : `$${p.price?.toLocaleString()}`;
  const pubDesc = resolvePublicDescription({
    description: p.description,
    richDescription: p.richDescription,
  });
  const descriptionRaw = pubDesc.kind === "rich" ? pubDesc.html : pubDesc.kind === "plain" ? pubDesc.plain : "";
  const descriptionText = stripHtml(descriptionRaw);
  const image = p.image;
  const reference = p.referenceCode || (isDev ? p.tokkoId : "N/A");
  const agentName = user?.name || "Asesor Inmobiliario";
  const agentEmail = user?.email || "contacto@viterra.com.mx";
  const agentPhone = user?.profile?.phone || "33 3629-7122";

  // Identidad de la empresa configurable (Mi empresa → Configuración); usa
  // los valores por defecto de Viterra cuando los campos están vacíos.
  const companySettings = loadWorkspaceAdminSettings();
  const companyPhone = companySettings.companyPhone.trim() || "33 3629-7122";
  const companyAddress =
    companySettings.companyAddress.trim() ||
    "Av. Terranova #1455 Int. 102, Providencia 4a Secc; C.P. 44639, Guadalajara, Jal.";
  const companyWebsite = companySettings.companyWebsite.trim() || "viterrainmobiliaria.com";
  const companyTaxId = companySettings.companyTaxId.trim();
  
  // Extract values
  const bedrooms = p.bedrooms ? String(p.bedrooms) : "-";
  const bathrooms = p.bathrooms ? String(p.bathrooms) : "-";
  const parking = p.parkingSpaces ? String(p.parkingSpaces) : "-";
  const floors = p.floors ? String(p.floors) : "-";
  
  const propertyType = p.propertyType || "N/A";
  const architecture = p.architecture || "N/A";
  const landUse = p.landUse || "N/A";
  
  const landArea = p.area ? `${p.area} m²` : "-";
  const buildArea = p.roofedArea ? `${p.roofedArea} m²` : (isDev && p.units ? `${p.units} unid.` : "-");
  
  const maint = p.maintenancePrice ? `$${p.maintenancePrice}` : "n/a";
  const age = p.age || "N/A";
  
  // Extra fields from modal (with fallbacks)
  const f = manualFields || {};
  const frente = f.frente ? `${f.frente} m` : "- m";
  const fondo = f.fondo ? `${f.fondo} m` : "- m";
  const maintIncludes = f.incluidoMantenimiento || "--";
  const publicidad = f.publicidad || "No";
  
  const jardinM2 = f.jardinM2 ? `${f.jardinM2} m²` : "n/a";
  const salaTv = f.salaTv || "No";
  const estudio = f.estudio || "No";
  const unidades = f.unidadesPrivativas || "-";
  
  const enCoto = f.enCoto || "No";
  const vigilancia = f.vigilancia || "No";
  const jardin = f.jardin || "No";
  const terraza = f.terraza || "No";
  const balcon = f.balcon || "No";
  
  const amueblado = f.amueblado || "No";
  const estudiantes = f.estudiantes || "No";
  const mascota = f.mascota || "No";
  const cuartoServ = f.cuartoServicio || "No";
  const banoServ = f.banoServicio || "No";
  
  const rest = f.condicionesVisita || "-";
  
  let page1Desc = descriptionText;
  let page2Desc = "";
  if (descriptionText.length > 550) {
    const splitIndex = descriptionText.lastIndexOf(' ', 550);
    if (splitIndex > 0) {
      page1Desc = descriptionText.substring(0, splitIndex) + "...";
      page2Desc = descriptionText.substring(splitIndex).trim();
    } else {
      page1Desc = descriptionText.substring(0, 550) + "...";
      page2Desc = descriptionText.substring(550).trim();
    }
  }
  // Only show page 2 desc if it has real content (more than 5 chars)
  if (page2Desc.length < 5) page2Desc = "";

  const rawGallery: string[] = Array.isArray(isDev ? p.images : p.galleryImages)
    ? (isDev ? p.images : p.galleryImages)
    : [];

  // Convert relative URLs to absolute so @react-pdf/renderer can load them
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const toAbsolute = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  // Build final gallery: make all URLs absolute and remove duplicates of main image
  const absoluteGallery = rawGallery
    .map(toAbsolute)
    .filter(url => url && url !== toAbsolute(image));

  const hasGallery = absoluteGallery.length > 0;
  const logoUrl = `${baseUrl}/images/branding/viterra-logo-hero.png`;

  return (
    <Document>
      {/* PÁGINA 1: PORTADA Y FICHA */}
      <Page size="A4" style={styles.page}>
        
        {/* TOP BANNER */}
        <View style={styles.topBanner}>
          <View style={styles.bannerLeft}>
            {includeLogo && (
              <Image src={logoUrl} style={styles.logo} />
            )}
            <View style={styles.bannerInfo}>
              <View style={styles.bannerInfoTextRow}>
                <Text style={styles.bannerInfoLabel}>Opcionó:</Text>
                <Text style={styles.bannerInfoValue}>{agentName}</Text>
              </View>
              <View style={styles.bannerInfoTextRow}>
                <Text style={styles.bannerInfoLabel}>Referencia:</Text>
                <Text style={styles.bannerInfoValue}>{reference}</Text>
              </View>
              <View style={styles.bannerInfoTextRow}>
                <Text style={styles.bannerInfoLabel}>Contacto:</Text>
                <Text style={styles.bannerInfoValue}>{agentPhone}</Text>
              </View>
            </View>
          </View>
          <View style={styles.bannerTitleContainer}>
            <Text style={[styles.bannerTitle, { fontSize: title.length > 35 ? 12 : (title.length > 25 ? 16 : 22) }]}>{title}</Text>
          </View>
        </View>

        {/* IMAGE AREA with badge overlay */}
        <View style={styles.imageAreaContainer}>
          {image ? (
            <Image src={image} style={styles.mainImage} />
          ) : (
            <View style={[styles.mainImage, {backgroundColor: '#e2e8f0'}]} />
          )}
          <View style={styles.addressOverlay}>
            <Text style={styles.addressText1}>{address}</Text>
            {location && location !== address && (
              <Text style={styles.addressText2}>{location}</Text>
            )}
          </View>
          {/* Badge overlay (VENTA/RENTA + price) */}
          <View style={styles.badgeOverlayContainer}>
            <View style={styles.badgeCircle}>
              <Text style={styles.badgeIconLabel}>{isDev ? "PROY" : "CASA"}</Text>
              <IconHouse />
            </View>
            <View style={styles.badgePriceContainer}>
              <Text style={styles.badgeOperation}>{operationType}</Text>
              <Text style={styles.badgePrice}>{price}</Text>
            </View>
          </View>
        </View>

        {/* COLUMNS */}
        <View style={styles.columnsContainer}>
          {/* LEFT COLUMN: DATOS */}
          <View style={styles.leftColumn}>
            
            <View style={styles.iconsRow}>
              <View style={styles.iconBox}>
                <IconBed />
                <Text style={styles.iconLabel}>RECÁMARAS</Text>
                <Text style={styles.iconValue}>{bedrooms}</Text>
              </View>
              <View style={styles.iconBox}>
                <IconBath />
                <Text style={styles.iconLabel}>BAÑOS</Text>
                <Text style={styles.iconValue}>{bathrooms}</Text>
              </View>
              <View style={styles.iconBox}>
                <IconCar />
                <Text style={styles.iconLabel}>COCHERA</Text>
                <Text style={styles.iconValue}>{parking}</Text>
              </View>
              <View style={styles.iconBox}>
                <IconStairs />
                <Text style={styles.iconLabel}>NIVELES</Text>
                <Text style={styles.iconValue}>{floors}</Text>
              </View>
            </View>

            {/* ROW 1 */}
            <View style={styles.tableGroup}>
              <View style={styles.tableRow}>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>TIPO DE INMUEBLE</Text></View>
                  <Text style={styles.tableValue}>{propertyType}</Text>
                </View>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>ARQUITECTURA</Text></View>
                  <Text style={styles.tableValue}>{architecture}</Text>
                </View>
                <View style={styles.tableCol}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>USO DE SUELO</Text></View>
                  <Text style={styles.tableValue}>{landUse}</Text>
                </View>
              </View>
            </View>

            {/* ROW 2 */}
            <View style={styles.tableGroup}>
              <View style={styles.tableRow}>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>TERRENO</Text></View>
                  <Text style={styles.tableValue}>{landArea}</Text>
                </View>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>CONSTRUCCIÓN</Text></View>
                  <Text style={styles.tableValue}>{buildArea}</Text>
                </View>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>FRENTE</Text></View>
                  <Text style={styles.tableValue}>{frente}</Text>
                </View>
                <View style={styles.tableCol}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>FONDO</Text></View>
                  <Text style={styles.tableValue}>{fondo}</Text>
                </View>
              </View>
            </View>

            {/* ROW 3 */}
            <View style={styles.tableGroup}>
              <View style={styles.tableRow}>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>MANTENIMIENTO</Text></View>
                  <Text style={styles.tableValue}>{maint}</Text>
                </View>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>INCLUÍDO</Text></View>
                  <Text style={styles.tableValue}>{maintIncludes}</Text>
                </View>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>ANTIGÜEDAD</Text></View>
                  <Text style={styles.tableValue}>{age}</Text>
                </View>
                <View style={styles.tableCol}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>PUBLICIDAD</Text></View>
                  <Text style={styles.tableValue}>{publicidad}</Text>
                </View>
              </View>
            </View>
            
            {/* ROW 4 */}
            <View style={styles.tableGroup}>
              <View style={styles.tableRow}>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>JARDÍN M²</Text></View>
                  <Text style={styles.tableValue}>{jardinM2}</Text>
                </View>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>SALA TV</Text></View>
                  <Text style={styles.tableValue}>{salaTv}</Text>
                </View>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>ESTUDIO</Text></View>
                  <Text style={styles.tableValue}>{estudio}</Text>
                </View>
                <View style={styles.tableCol}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>UNID. PRIVATIVAS</Text></View>
                  <Text style={styles.tableValue}>{unidades}</Text>
                </View>
              </View>
            </View>
            
            {/* ROW 5 */}
            <View style={styles.tableGroup}>
              <View style={styles.tableRow}>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>EN COTO</Text></View>
                  <Text style={styles.tableValue}>{enCoto}</Text>
                </View>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>VIGILANCIA</Text></View>
                  <Text style={styles.tableValue}>{vigilancia}</Text>
                </View>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>JARDÍN</Text></View>
                  <Text style={styles.tableValue}>{jardin}</Text>
                </View>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>TERRAZA</Text></View>
                  <Text style={styles.tableValue}>{terraza}</Text>
                </View>
                <View style={styles.tableCol}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>BALCÓN</Text></View>
                  <Text style={styles.tableValue}>{balcon}</Text>
                </View>
              </View>
            </View>
            
            {/* ROW 6 */}
            <View style={styles.tableGroup}>
              <View style={styles.tableRow}>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>AMUEBLADO</Text></View>
                  <Text style={styles.tableValue}>{amueblado}</Text>
                </View>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>ESTUDIANTES</Text></View>
                  <Text style={styles.tableValue}>{estudiantes}</Text>
                </View>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>MASCOTA</Text></View>
                  <Text style={styles.tableValue}>{mascota}</Text>
                </View>
                <View style={[styles.tableCol, styles.tableColBorderRight]}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>CUARTO SERV</Text></View>
                  <Text style={styles.tableValue}>{cuartoServ}</Text>
                </View>
                <View style={styles.tableCol}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>BAÑO SERV</Text></View>
                  <Text style={styles.tableValue}>{banoServ}</Text>
                </View>
              </View>
            </View>
            
            {/* ROW 7 */}
            <View style={styles.tableGroup}>
              <View style={styles.tableFullWidthContainer}>
                <Text style={styles.tableFullWidthHeader}>CONDICIONES DE VISITA/RESTRICCIONES</Text>
              </View>
              <Text style={styles.tableFullWidthValue}>{rest}</Text>
            </View>
            
            {/* REFERENCE CODE AT BOTTOM */}
            <View style={[styles.tableGroup, { marginTop: "auto", marginBottom: 0 }]}>
              <View style={styles.tableRow}>
                <View style={styles.tableCol}>
                  <View style={styles.tableHeaderContainer}><Text style={styles.tableHeader}>REFERENCIA</Text></View>
                  <Text style={styles.tableValue}>{reference}</Text>
                </View>
              </View>
            </View>

          </View>

          {/* RIGHT COLUMN: DESCRIPCIÓN */}
          <View style={styles.rightColumn}>
            <Text style={[styles.descTitle, {color: "#ffffff"}]}>Descripción de la propiedad:</Text>
            {renderDescription(page1Desc, true)}
          </View>
        </View>
      </Page>

      {/* PÁGINA 2: MAPA Y GALERÍA */}
      {(hasGallery || page2Desc) && (
        <Page size="A4" style={styles.page}>
          <View style={styles.page2Container}>
            
            {page2Desc && (
              <View style={{ marginBottom: 20 }}>
                <Text style={[styles.descTitle, {color: BRAND_RED}]}>Descripción (continuación):</Text>
                {renderDescription(page2Desc, false)}
              </View>
            )}

            {hasGallery && (
              <View style={styles.galleryGrid}>
                {absoluteGallery.slice(0, 10).map((imgUrl: string, i: number) => (
                  <Image key={i} src={imgUrl} style={styles.galleryImage} />
                ))}
              </View>
            )}

          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <View>
              <Text style={styles.footerTitle}>¡AGENDA TU CITA!</Text>
              <View style={styles.footerTextRow}>
                <Svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#ffffff" strokeWidth="2">
                  <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </Svg>
                <Text style={styles.footerText}>Tel. {companyPhone}</Text>
              </View>
              <View style={styles.footerTextRow}>
                <Svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#ffffff" strokeWidth="2">
                  <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                </Svg>
                <Text style={styles.footerText}>{companyAddress}</Text>
              </View>
              {companyTaxId ? (
                <View style={styles.footerTextRow}>
                  <Text style={styles.footerText}>RFC: {companyTaxId}</Text>
                </View>
              ) : null}
            </View>
            <View>
              <View style={styles.footerTextRow}>
                <Text style={styles.footerText}>{companyWebsite}</Text>
              </View>
              <View style={styles.footerTextRow}>
                <Text style={styles.footerText}>viterragrupoinmobiliario</Text>
              </View>
              <View style={styles.footerTextRow}>
                <Text style={styles.footerText}>@viterrainmobiliaria</Text>
              </View>
            </View>
          </View>
        </Page>
      )}
    </Document>
  );
}
