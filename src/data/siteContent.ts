/**
 * Contenido editable del sitio (excepto listados Renta/Compra que siguen en sus rutas).
 * Persistencia: tabla `site_content_sections` en Supabase (JSON por página); imágenes en Storage bucket `site`.
 */

import { SOCIAL_LINKS, type HeaderSocialIconId } from "../app/config/socialLinks";

/** Enlaces de redes en la barra superior (lista ordenada; URL vacía = no se muestra). */
export type HeaderNavSocialLink = {
  id: HeaderSocialIconId;
  label: string;
  href: string;
};

/** Enlace de navegación en el pie del sitio (columnas rápidas / servicios). */
export type FooterNavLink = {
  label: string;
  href: string;
};

/** Fila de contacto en el pie (solo icono + texto visible). */
export type FooterContactItem = {
  icon: ContactInfoIcon;
  /** Varias líneas: separar con Enter (\n). */
  body: string;
};

/** Claves de icono Lucide usadas en el grafo de servicios y en el editor. */
export const SERVICE_ICON_KEYS = [
  "home",
  "building2",
  "settings2",
  "fileCheck2",
  "scale",
  "barChart3",
  "phone",
  "mail",
  "messageCircle",
  "landmark",
  "key",
  "handshake",
  "briefcase",
  "treePine",
  "hardHat",
  "hammer",
  "search",
  "sparkles",
  "shieldCheck",
  "users",
  "clipboardList",
] as const;
export type ServiceIconKey = (typeof SERVICE_ICON_KEYS)[number];

/** Posición en % (opcional, legado). La web muestra los bloques en columna; el campo puede seguir en JSON antiguo. */
export type ServiceDetailCanvasLayout = { x: number; y: number; w: number; h: number };

type DL = { layout?: ServiceDetailCanvasLayout };

export type ServiceDetailBlock =
  | (DL & { id: string; type: "heading"; text: string })
  | (DL & { id: string; type: "subheading"; text: string })
  | (DL & { id: string; type: "paragraph"; text: string })
  /** Párrafo con línea de contacto (tel. + correo); el enlace `tel:` se arma a partir de dígitos y `+`. */
  | (DL & { id: string; type: "contactParagraph"; text: string; phone: string; email: string })
  | (DL & { id: string; type: "quote"; text: string; attribution?: string })
  | (DL & { id: string; type: "callout"; text: string })
  | (DL & { id: string; type: "bulletList"; items: string[] })
  | (DL & { id: string; type: "image"; src: string; alt: string })
  | (DL & { id: string; type: "twoColumn"; text: string; imageSrc: string; imageAlt: string })
  | (DL & { id: string; type: "embedVideo"; url: string; caption?: string })
  | (DL & { id: string; type: "spacer"; size: "sm" | "md" | "lg" })
  | (DL & { id: string; type: "contact"; items: ContactInfoItem[] })
  | (DL & { id: string; type: "cta"; label: string; href: string; variant?: "primary" | "secondary" })
  | (DL & { id: string; type: "divider" })
  | (DL & { id: string; type: "faqBlock"; items: { question: string; answer: string }[] })
  | (DL & { id: string; type: "gallery"; images: { src: string; alt: string }[] })
  | (DL & { id: string; type: "iconCard"; iconKey: ServiceIconKey; title: string; body: string })
  | (DL & { id: string; type: "widthBand"; mode: "full" | "content"; label?: string });

/** Listados existentes a los que puede enlazar el CTA principal del nodo (en lugar de la página dedicada). */
export const SERVICE_PRIMARY_LISTING_HREFS = ["/renta", "/venta", "/desarrollos"] as const;
export type ServicePrimaryListingHref = (typeof SERVICE_PRIMARY_LISTING_HREFS)[number];

/** Icono de cada enlace rápido en el panel lateral del grafo de servicios (Lucide). */
export const SERVICE_CARD_CONTACT_LINK_ICONS = ["messageCircle", "mail", "phone", "link"] as const;
export type ServiceCardContactLinkIcon = (typeof SERVICE_CARD_CONTACT_LINK_ICONS)[number];

export type ServiceCardContactLink = {
  label: string;
  href: string;
  icon: ServiceCardContactLinkIcon;
};

/** Enlaces por defecto bajo las viñetas del panel (sustituibles por tarjeta). */
export const DEFAULT_SERVICE_CARD_CONTACT_LINKS: ServiceCardContactLink[] = [
  {
    label: "WhatsApp",
    href: "https://wa.me/523331991774?text=Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20sus%20servicios.",
    icon: "messageCircle",
  },
  { label: "Correo", href: "mailto:contacto@viterrainmobiliaria.com", icon: "mail" },
  { label: "Llamada", href: "tel:+523331991774", icon: "phone" },
];

function cloneDefaultServiceCardContactLinks(): ServiceCardContactLink[] {
  return DEFAULT_SERVICE_CARD_CONTACT_LINKS.map((l) => ({ ...l }));
}

export interface ServiceCardContent {
  title: string;
  description: string;
  bullets: string[];
  /** Texto del enlace principal hacia la página dedicada (`/servicios/d/:slug`) o al listado si `primaryListingHref` está definido. */
  linkLabel: string;
  /** Slug para `/servicios/d/:slug`. Vacío si la tarjeta solo enlaza a un listado (`primaryListingHref`). */
  slug: string;
  /** Si se define, el CTA del grafo/panel enlaza a este listado en lugar de `/servicios/d/:slug`. */
  primaryListingHref?: ServicePrimaryListingHref;
  /** Controla si la tarjeta aparece en la columna de servicios del pie de página. Por defecto: true. */
  showInFooter?: boolean;
  /** Etiqueta corta en el panel del grafo (p. ej. «ADQUISICIÓN»). */
  tag?: string;
  iconKey: ServiceIconKey;
  /** Enlaces rápidos bajo las viñetas (WhatsApp, correo, tel., enlaces personalizados). */
  contactLinks: ServiceCardContactLink[];
  /** Contenido de la página `/servicios/d/:slug`. */
  detailBlocks: ServiceDetailBlock[];
}

export type ContactFaqItem = { question: string; answer: string };

/** Icono de cada fila en «Información de contacto» (mapeado a Lucide en la página). */
export type ContactInfoIcon = "map" | "phone" | "mail" | "clock" | "building" | "message";

export type ContactInfoItem = {
  title: string;
  /** Varias líneas: separar con Enter (\n). */
  body: string;
  icon: ContactInfoIcon;
};

/** Plataformas disponibles para enlaces en el bloque «Redes» de contacto. */
export const CONTACT_SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "youtube",
  "tiktok",
  "threads",
  "whatsapp",
  "website",
] as const;

export type ContactSocialPlatform = (typeof CONTACT_SOCIAL_PLATFORMS)[number];

export type ContactSocialLinkItem = {
  platform: ContactSocialPlatform;
  /** URL completa (https://…). Vacío: no se muestra el icono en la web. */
  url: string;
};

export const CONTACT_SOCIAL_LABELS: Record<ContactSocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  threads: "Threads",
  whatsapp: "WhatsApp",
  website: "Sitio web",
};

export interface SiteContent {
  home: {
    heroImage: string;
    heroKicker: string;
    heroTitle: string;
    heroSubtitle: string;
    heroLinkDevLabel: string;
    heroLinkAboutLabel: string;
    heroCtaPrimary: string;
    heroCtaSecondary: string;
    searchImage: string;
    searchKicker: string;
    searchTitle: string;
    searchSubtitle: string;
    selectionKicker: string;
    selectionTitle: string;
    selectionSubtitle: string;
    selectionCatalogLink: string;
    selectionRentLabel: string;
    selectionSaleLabel: string;
    /**
     * Encabezado de la sección del feed de Instagram. Solo el texto: las
     * publicaciones se traen de la API y el enlace al perfil sale de la
     * configuración de la empresa, así que no hay nada más que editar aquí.
     */
    socialKicker: string;
    socialTitle: string;
    socialSubtitle: string;
    socialCta: string;
    socialEmpty: string;
    experienceImage: string;
    experienceKicker: string;
    experienceTitle: string;
    experienceLead: string;
    experienceBody: string;
    experienceCta: string;
    /** Imagen a la izquierda (por defecto) o a la derecha en escritorio. */
    experienceMediaPosition?: "left" | "right";
    closingKicker: string;
    closingTitle: string;
    closingSubtitle: string;
    closingBtnPrimary: string;
    closingBtnSecondary: string;
  };
  /** Redes sociales del encabezado global (iconos junto al logo en escritorio / móvil). */
  header: {
    navSocial: HeaderNavSocialLink[];
  };
  /** Pie de página global (marca, enlaces, contacto, copyright). */
  footer: {
    brandTitle: string;
    brandSubtitle: string;
    brandDescription: string;
    quickLinksTitle: string;
    quickLinks: FooterNavLink[];
    /** Título de la columna; los ítems salen de Sitio web → Servicios. */
    servicesTitle: string;
    contactTitle: string;
    contactItems: FooterContactItem[];
    socialLinks: ContactSocialLinkItem[];
    /** Texto legal; `{year}` se sustituye por el año actual. */
    copyrightLine: string;
  };
  contact: {
    /** Ritmo vertical del hero (cabecera contacto). */
    heroSectionDensity?: "default" | "compact" | "airy";
    /** Fondo de la cabecera (imagen o vídeo MP4/WebM/MOV; misma URL que en otras páginas). */
    heroImage: string;
    /** Línea pequeña encima del título (p. ej. «Viterra · Contacto»). */
    heroKicker: string;
    heroTitle: string;
    heroSubtitle: string;
    infoTitle: string;
    infoItems: ContactInfoItem[];
    quickTitle: string;
    quickSubtitle: string;
    quickWhatsappLabel: string;
    quickWhatsappHref: string;
    formTitle: string;
    formKicker: string;
    successTitle: string;
    successSubtitle: string;
    mapLat: number;
    mapLng: number;
    mapPopupTitle: string;
    mapPopupAddress: string;
    mapSectionKicker: string;
    mapSectionTitle: string;
    visitKicker: string;
    visitTitle: string;
    visitIntro: string;
    faqKicker: string;
    faqTitle: string;
    faq: ContactFaqItem[];
    socialKicker: string;
    socialTitle: string;
    socialIntro: string;
    socialLinks: ContactSocialLinkItem[];
    advisorCta: string;
    closingKicker: string;
    closingTitle: string;
    closingSubtitle: string;
    closingBtnPrimary: string;
    closingBtnPrimaryHref: string;
    closingBtnSecondary: string;
    closingBtnSecondaryHref: string;
  };
  services: {
    heroImage: string;
    heroTitle: string;
    heroSubtitle: string;
    cards: ServiceCardContent[];
    ctaTitle: string;
    ctaSubtitle: string;
    ctaButton: string;
  };
  about: {
    heroImage: string;
    heroKicker: string;
    heroTitle: string;
    heroSubtitle: string;
    storyKicker: string;
    storyTitle: string;
    storyP1: string;
    storyP2: string;
    storyP3: string;
    storyImage: string;
    missionTitle: string;
    missionText: string;
    visionTitle: string;
    visionText: string;
    valuesKicker: string;
    valuesTitle: string;
    valuesIntro: string;
    values: { title: string; text: string; iconKey: ServiceIconKey }[];
    stats: { value: string; label: string }[];
    statsSectionTitle: string;
    timelineKicker: string;
    timelineTitle: string;
    timelineIntro: string;
    milestones: { year: string; title: string; description: string }[];
    teamKicker: string;
    teamTitle: string;
    teamIntro: string;
    team: { name: string; role: string; initials: string; image?: string }[];
  };
  developments: {
    heroImage: string;
    heroKicker: string;
    heroTitle: string;
    heroSubtitle: string;
    featuredKicker: string;
    featuredTitle: string;
    ctaTitle: string;
    ctaSubtitle: string;
    ctaPrimaryLabel: string;
    ctaSecondaryLabel: string;
    /** Teléfono del botón «Llamar ahora»; se usa tal cual en el `tel:`. */
    ctaPhone: string;
  };
  /** Cabecera de `/renta` (listado; el catálogo sigue en Supabase). */
  rent: {
    heroImage: string;
    heroKicker: string;
    heroTitle: string;
    heroSubtitle: string;
  };
  /** Cabecera de `/venta` (listado). */
  sale: {
    heroImage: string;
    heroKicker: string;
    heroTitle: string;
    heroSubtitle: string;
  };
}

export const DEFAULT_SITE_CONTENT: SiteContent = {
  home: {
    heroImage:
      "https://images.unsplash.com/photo-1774685110718-c5b4fe026144?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBtb2Rlcm4lMjBob21lJTIwZXh0ZXJpb3IlMjBhcmNoaXRlY3R1cmV8ZW58MXx8fHwxNzc2MDk1NzU3fDA&ixlib=rb-4.1.0&q=80&w=1920",
    heroKicker: "Inmuebles y residencias de lujo",
    heroTitle: "¿A dónde quiere ir?",
    heroSubtitle: "Somos líderes en propiedades de lujo.",
    heroLinkDevLabel: "Nuevo desarrollo",
    heroLinkAboutLabel: "El mundo de Viterra",
    heroCtaPrimary: "Comience su búsqueda",
    heroCtaSecondary: "Ver nuestras exclusivas",
    searchImage:
      "https://images.unsplash.com/photo-1758448511322-8bfc73daf606?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBwZW50aG91c2UlMjBpbnRlcmlvciUyMGxpdmluZyUyMHJvb218ZW58MXx8fHwxNzc2MDk1NzU3fDA&ixlib=rb-4.1.0&q=80&w=1920",
    searchKicker: "Búsqueda",
    searchTitle: "Encuentre su próxima propiedad",
    searchSubtitle: "Indique criterios o explore el catálogo completo.",
    selectionKicker: "Selección",
    selectionTitle: "Lo último en propiedades de lujo",
    selectionSubtitle: "Estilo de vida y ubicaciones excepcionales, elegidas para usted.",
    selectionCatalogLink: "Ver catálogo",
    selectionRentLabel: "Propiedades en renta",
    selectionSaleLabel: "Propiedades en venta",
    socialKicker: "Síguenos",
    socialTitle: "Lo último en redes",
    socialSubtitle:
      "Mantente al día con nuestras publicaciones más recientes, proyectos y estilo de vida.",
    socialCta: "Síguenos en Instagram",
    socialEmpty:
      "No pudimos cargar las 3 publicaciones ahora. Reintenta en unos segundos o ábrelo en Instagram.",
    experienceImage:
      "https://images.unsplash.com/photo-1758448511322-8bfc73daf606?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBwZW50aG91c2UlMjBpbnRlcmlvciUyMGxpdmluZyUyMHJvb218ZW58MXx8fHwxNzc2MDk1NzU3fDA&ixlib=rb-4.1.0&q=80&w=1600",
    experienceKicker: "Experiencia",
    experienceTitle: "Un estándar distinto en corretaje residencial",
    experienceLead: "Asesoría discreta y rigor en cada etapa.",
    experienceBody:
      "Acceso a cartera off-market y acompañamiento integral, con la exigencia que merece el segmento premium.",
    experienceCta: "Conozca Viterra",
    closingKicker: "Contacto",
    closingTitle: "¿Hablamos de su próximo hogar?",
    closingSubtitle: "Un asesor puede orientarle en venta, renta o inversión en desarrollo.",
    closingBtnPrimary: "Contacto",
    closingBtnSecondary: "Ver listados",
  },
  header: {
    navSocial: SOCIAL_LINKS.map((l) => ({ id: l.id, label: l.label, href: l.href })),
  },
  footer: {
    brandTitle: "VITERRA",
    brandSubtitle: "Grupo Inmobiliario",
    brandDescription:
      "Tu socio de confianza en bienes raíces. Más de 15 años ayudando a personas a encontrar su hogar ideal.",
    quickLinksTitle: "Enlaces rápidos",
    quickLinks: [
      { label: "Inicio", href: "/" },
      { label: "Propiedades", href: "/renta" },
      { label: "Desarrollos", href: "/desarrollos" },
      { label: "Nosotros", href: "/nosotros" },
      { label: "Contacto", href: "/contacto" },
      { label: "Aviso de Privacidad", href: "/aviso-de-privacidad" },
    ],
    servicesTitle: "Servicios",
    contactTitle: "Contacto",
    contactItems: [
      {
        icon: "map",
        body: "Av Terranova 1455 local 102, Providencia 4a Secc., 44639 Zapopan, Jal.",
      },
      { icon: "phone", body: "3336297122" },
      { icon: "mail", body: "contacto@viterrainmobiliaria.com" },
    ],
    socialLinks: [],
    copyrightLine: "© {year} Viterra Inmobiliaria. Todos los derechos reservados.",
  },
  contact: {
    heroImage: "https://blog.grupoguia.mx/hubfs/DJI_20241206140245_0034_D.jpg",
    heroKicker: "Viterra · Contacto",
    heroTitle: "Contáctanos",
    heroSubtitle: "Estamos aquí para ayudarte a encontrar tu hogar ideal",
    infoTitle: "Información de Contacto",
    infoItems: [
      {
        icon: "map",
        title: "Dirección",
        body: "Av Terranova 1455 local 102\nProvidencia 4a Secc., 44639 Zapopan, Jal.",
      },
      {
        icon: "phone",
        title: "Teléfono",
        body: "(33) 3629-7122\n(33) 3199-1774",
      },
      {
        icon: "mail",
        title: "Email",
        body: "contacto@viterrainmobiliaria.com",
      },
      {
        icon: "clock",
        title: "Horario",
        body: "Lunes - Viernes: 9:00 - 18:00\nSábados: 10:00 - 14:00\nDomingos: Cerrado",
      },
    ],
    quickTitle: "¿Necesitas ayuda inmediata?",
    quickSubtitle: "Nuestro equipo está disponible para atenderte por WhatsApp",
    quickWhatsappLabel: "Chatear por WhatsApp",
    quickWhatsappHref: "https://wa.me/523331991774",
    formTitle: "Envíanos un Mensaje",
    formKicker: "Escríbenos",
    successTitle: "¡Mensaje enviado con éxito!",
    successSubtitle: "Nos pondremos en contacto contigo pronto.",
    mapLat: 20.697312,
    mapLng: -103.386476,
    mapPopupTitle: "Viterra Inmobiliaria",
    mapPopupAddress: "Av Terranova 1455 local 102<br/>Providencia 4a Secc., 44639 Zapopan, Jal.",
    mapSectionKicker: "Visítanos",
    mapSectionTitle: "Nuestra Ubicación",
    visitKicker: "Sede principal",
    visitTitle: "Visítanos en Zapopan",
    visitIntro:
      "Agenda una cita o pásate por nuestras oficinas. Un asesor te orientará con la misma discreción y rigor que aplicamos a cada operación.",
    faqKicker: "Preguntas frecuentes",
    faqTitle: "Antes de escribirnos",
    faq: [
      {
        question: "¿En cuánto tiempo responden?",
        answer:
          "Normalmente respondemos el mismo día hábil. En picos de demanda puede tomar hasta 24–48 horas; si es urgente, usa WhatsApp.",
      },
      {
        question: "¿Puedo agendar una visita a la oficina?",
        answer: "Sí. Escríbenos con tu horario preferido y un asesor confirmará la cita por correo o teléfono.",
      },
      {
        question: "¿Cómo preparo una valuación o avalúo?",
        answer:
          "Indica en el mensaje tipo de inmueble, colonia y si buscas avalúo certificado o una estimación orientativa. Te diremos el siguiente paso.",
      },
      {
        question: "¿Qué métodos de pago aceptan?",
        answer: "Depende del servicio. En la primera respuesta te explicamos opciones y documentación requerida.",
      },
      {
        question: "Soy asesor o colaborador",
        answer: "Si ya tienes cuenta, inicia sesión en el panel. Si no, cuéntanos en el mensaje y te contactamos.",
      },
    ],
    socialKicker: "Redes",
    socialTitle: "Encuéntranos en línea",
    socialIntro: "Síguenos para novedades, propiedades destacadas y contenido del sector.",
    socialLinks: [
      { platform: "facebook", url: "https://www.facebook.com/ViterraGrupoInmobiliario/" },
      { platform: "instagram", url: "https://www.instagram.com/viterrainmobiliaria/" },
      { platform: "youtube", url: "https://www.youtube.com/@ViterraGrupoInmobiliario" },
    ],
    advisorCta: "¿Prefieres hablar con un asesor? Te respondemos por teléfono o WhatsApp con la misma rapidez.",
    closingKicker: "Siguiente paso",
    closingTitle: "¿Listo para hablar con un asesor?",
    closingSubtitle: "Cuéntanos qué buscas: venta, renta, desarrollo o asesoría. Respondemos con propuesta clara y sin compromiso.",
    closingBtnPrimary: "Enviar otro mensaje",
    closingBtnPrimaryHref: "#contacto-formulario",
    closingBtnSecondary: "Ver propiedades en venta",
    closingBtnSecondaryHref: "/venta",
  },
  services: {
    heroImage:
      "https://wallpapers.com/images/hd/4k-office-background-silapjkl0bkxakj4.jpg",
    heroTitle: "Nuestros servicios",
    heroSubtitle: "Soluciones integrales para todas tus necesidades inmobiliarias",
    cards: [
      {
        title: "Renta de Propiedades",
        description:
          "Encuentra el hogar perfecto para ti. Contamos con una amplia selección de propiedades en renta en las mejores zonas de Guadalajara.",
        bullets: ["Propiedades verificadas y de calidad", "Asesoría personalizada", "Proceso rápido y seguro"],
        linkLabel: "Ver propiedades en renta",
        slug: "",
        primaryListingHref: "/renta",
        tag: "ARRENDAMIENTO",
        iconKey: "home",
        contactLinks: cloneDefaultServiceCardContactLinks(),
        detailBlocks: [],
      },
      {
        title: "Venta de Propiedades",
        description:
          "Invierte en tu patrimonio con las mejores opciones del mercado. Te ayudamos a encontrar la propiedad ideal.",
        bullets: ["Análisis de inversión", "Financiamiento disponible", "Trámites legales incluidos"],
        linkLabel: "Ver propiedades en venta",
        slug: "",
        primaryListingHref: "/venta",
        tag: "ADQUISICIÓN",
        iconKey: "building2",
        contactLinks: cloneDefaultServiceCardContactLinks(),
        detailBlocks: [],
      },
      {
        title: "Desarrollos Inmobiliarios",
        description:
          "Proyectos exclusivos en preventa y construcción. Asegura tu inversión con las mejores plusvalías.",
        bullets: ["Precios de preventa", "Seguimiento de obra", "Garantía de desarrolladora"],
        linkLabel: "Ver desarrollos",
        slug: "",
        primaryListingHref: "/desarrollos",
        tag: "DESARROLLO",
        iconKey: "fileCheck2",
        contactLinks: cloneDefaultServiceCardContactLinks(),
        detailBlocks: [],
      },
      {
        title: "Asesoría Legal",
        description:
          "Acompañamiento legal completo en todas tus transacciones inmobiliarias para garantizar tu seguridad.",
        bullets: ["Revisión de contratos", "Trámites notariales", "Escrituración segura"],
        linkLabel: "Conocer más",
        slug: "asesoria-legal",
        showInFooter: false,
        tag: "JURÍDICO",
        iconKey: "scale",
        contactLinks: cloneDefaultServiceCardContactLinks(),
        detailBlocks: [],
      },
      {
        title: "Avalúos y Valuación",
        description: "Conoce el valor real de tu propiedad con nuestros avalúos profesionales certificados.",
        bullets: ["Avalúos certificados", "Análisis de mercado", "Reporte detallado"],
        linkLabel: "Conocer más",
        slug: "avaluos-y-valuacion",
        tag: "VALORACIÓN",
        iconKey: "barChart3",
        contactLinks: cloneDefaultServiceCardContactLinks(),
        detailBlocks: [],
      },
      {
        title: "Administración de Propiedades",
        description: "Despreocúpate y deja la gestión de tu propiedad en manos de expertos profesionales.",
        bullets: ["Cobranza de rentas", "Mantenimiento preventivo", "Atención a inquilinos"],
        linkLabel: "Conocer más",
        slug: "administracion-propiedades",
        tag: "GESTIÓN",
        iconKey: "settings2",
        contactLinks: cloneDefaultServiceCardContactLinks(),
        detailBlocks: [],
      },
    ],
    ctaTitle: "¿Necesitas ayuda con tu proyecto inmobiliario?",
    ctaSubtitle: "Nuestro equipo de expertos está listo para asesorarte",
    ctaButton: "Contactar Ahora",
  },
  about: {
    heroImage: "/images/about-nosotros-hero.png",
    heroKicker: "Viterra · Nosotros",
    heroTitle: "Sobre nosotros",
    heroSubtitle: "Conoce nuestra trayectoria y compromiso con la excelencia inmobiliaria",
    storyKicker: "Nuestra Trayectoria",
    storyTitle: "Una Historia de Excelencia",
    storyP1:
      "Viterra Inmobiliaria nació en 2009 con una visión clara: revolucionar la forma en que las personas buscan y encuentran propiedades. Fundada por un equipo de expertos en bienes raíces, comenzamos con un pequeño equipo apasionado por hacer la diferencia.",
    storyP2:
      "A lo largo de los años, hemos crecido hasta convertirnos en una de las inmobiliarias más confiables y respetadas del país. Nuestro compromiso con la excelencia, la transparencia y el servicio personalizado nos ha permitido ayudar a más de 1,200 familias a encontrar su hogar ideal.",
    storyP3:
      "Hoy, con más de 50 asesores expertos y una cartera de más de 500 propiedades, continuamos innovando y mejorando nuestros servicios para ofrecer la mejor experiencia en bienes raíces.",
    storyImage:
      "https://images.unsplash.com/photo-1774192620890-f61475279725?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsdXh1cnklMjBvZmZpY2UlMjBidWlsZGluZyUyMGFyY2hpdGVjdHVyZXxlbnwxfHx8fDE3NzQ0MDE1MTF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    missionTitle: "Nuestra Misión",
    missionText:
      "Proporcionar servicios inmobiliarios excepcionales que superen las expectativas de nuestros clientes, facilitando transacciones seguras y transparentes mientras construimos relaciones de confianza a largo plazo. Nos comprometemos a ofrecer asesoramiento experto y soluciones personalizadas para cada necesidad.",
    visionTitle: "Nuestra Visión",
    visionText:
      "Ser la inmobiliaria líder y más confiable del país, reconocida por nuestra innovación, integridad y excelencia en el servicio al cliente. Aspiramos a transformar la industria inmobiliaria mediante tecnología de vanguardia y un enfoque centrado en las personas.",
    valuesKicker: "Principios",
    valuesTitle: "Nuestros Valores",
    valuesIntro: "Los principios que guían cada decisión y acción en Viterra Inmobiliaria",
    values: [
      { title: "Excelencia", text: "Nos esforzamos por la perfección en cada detalle de nuestro servicio.", iconKey: "sparkles" },
      { title: "Integridad", text: "Actuamos con honestidad y transparencia en todas nuestras relaciones.", iconKey: "shieldCheck" },
      { title: "Compromiso", text: "Dedicados al éxito y satisfacción de cada uno de nuestros clientes.", iconKey: "handshake" },
      { title: "Innovación", text: "Constantemente mejorando y adoptando nuevas tecnologías y métodos.", iconKey: "settings2" },
    ],
    stats: [
      { value: "15+", label: "Años de Experiencia" },
      { value: "1,200+", label: "Clientes Satisfechos" },
      { value: "500+", label: "Propiedades" },
      { value: "50+", label: "Asesores Expertos" },
    ],
    statsSectionTitle: "",
    timelineKicker: "Trayectoria",
    timelineTitle: "Hitos Importantes",
    timelineIntro: "Los momentos clave que han marcado nuestra historia",
    milestones: [
      { year: "2009", title: "Fundación de Viterra", description: "Iniciamos operaciones con un equipo apasionado de 5 personas y la visión de transformar el mercado inmobiliario." },
      { year: "2012", title: "Expansión Regional", description: "Abrimos nuestra segunda oficina y alcanzamos las 100 propiedades en cartera." },
      { year: "2015", title: "Certificación ISO 9001", description: "Obtuvimos la certificación de calidad internacional, respaldando nuestros procesos y compromiso con la excelencia." },
      { year: "2018", title: "Plataforma Digital", description: "Lanzamos nuestra plataforma web moderna, facilitando la búsqueda de propiedades para miles de clientes." },
      { year: "2021", title: "1000+ Familias", description: "Alcanzamos el hito de ayudar a más de mil familias a encontrar su hogar ideal." },
      { year: "2024", title: "Líder del Mercado", description: "Nos consolidamos como una de las inmobiliarias más confiables con 500+ propiedades activas y 50 asesores expertos." },
    ],
    teamKicker: "Equipo",
    teamTitle: "Nuestro Equipo",
    teamIntro: "Profesionales dedicados con años de experiencia en el mercado inmobiliario",
    team: [
      {
        name: "María González",
        role: "CEO & Fundadora",
        initials: "MG",
        image:
          "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&h=600&q=80",
      },
      {
        name: "Carlos Rodríguez",
        role: "Director de Ventas",
        initials: "CR",
        image:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=600&h=600&q=80",
      },
      {
        name: "Ana Martínez",
        role: "Gerente de Operaciones",
        initials: "AM",
        image:
          "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&h=600&q=80",
      },
    ],
  },
  developments: {
    heroImage:
      "https://images.adsttc.com/media/images/5ef2/f7ce/b357/6589/8c00/019a/large_jpg/847A0737.jpg?1592981436",
    heroKicker: "Viterra · Desarrollos",
    heroTitle: "Proyectos Excepcionales",
    heroSubtitle:
      "Descubre nuestros desarrollos inmobiliarios exclusivos con arquitectura vanguardista y amenidades de clase mundial.",
    featuredKicker: "Destacados",
    featuredTitle: "Proyectos Exclusivos",
    ctaTitle: "Contáctanos",
    ctaSubtitle:
      "Agenda una visita o escríbenos: con gusto te orientamos sobre disponibilidad, precios y opciones en nuestros desarrollos exclusivos.",
    ctaPrimaryLabel: "Agendar cita",
    ctaSecondaryLabel: "Llamar ahora",
    ctaPhone: "+523314457122",
  },
  rent: {
    heroImage:
      "https://media.admagazine.com/photos/686d8644af6250fff2506526/16:9/w_2560%2Cc_limit/departamento-tipo-loft-forma-optima-aprovechar-espacios-pequenos.jpg",
    heroKicker: "Viterra · Listados",
    heroTitle: "Propiedades en Renta",
    heroSubtitle: "Encuentra tu hogar ideal en las mejores ubicaciones de Guadalajara",
  },
  sale: {
    heroImage:
      "https://plus.unsplash.com/premium_photo-1661954372617-15780178eb2e?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8bHV4dXJ5JTIwaG91c2V8ZW58MHx8MHx8fDA%3D",
    heroKicker: "Viterra · Listados",
    heroTitle: "Propiedades en Venta",
    heroSubtitle: "Invierte en tu patrimonio con las mejores opciones del mercado",
  },
};
