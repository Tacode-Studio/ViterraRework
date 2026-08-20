import type {
  SiteContent,
  ContactInfoIcon,
  ContactSocialPlatform,
  ServiceDetailBlock,
  ServiceIconKey,
  ServiceCardContactLink,
  ServiceCardContent,
  FooterNavLink,
} from "../../../../data/siteContent";
import {
  SERVICE_ICON_KEYS,
  SERVICE_PRIMARY_LISTING_HREFS,
  DEFAULT_SERVICE_CARD_CONTACT_LINKS,
} from "../../../../data/siteContent";
import { HEADER_SOCIAL_PLATFORM_OPTIONS, type HeaderSocialIconId } from "../../../../app/config/socialLinks";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { mergeSiteSection } from "../../../../lib/siteContentMerge";
import { resolveServiceCardPrimaryHref, serviceCardUsesDedicatedPage } from "../../../../lib/serviceCardPrimaryHref";
import {
  FOOTER_INTERNAL_LINK_OPTIONS,
  FOOTER_QUICK_LINK_CUSTOM,
  footerQuickLinkSelectValue,
  footerServiceLinksFromCards,
} from "../../../../lib/footerSiteLinks";
import { EditorSection, ImageUploadField, LabeledField, NumberInput, TextArea, TextInput } from "./editorUi";
import { DetailBlockReorderRow } from "./DetailBlockReorderRow";

function pickSection(activeSectionId: string | null, sectionId: string): boolean {
  return activeSectionId === sectionId;
}

const CONTACT_ICON_OPTIONS: { value: ContactInfoIcon; label: string }[] = [
  { value: "map", label: "Mapa / ubicación" },
  { value: "phone", label: "Teléfono" },
  { value: "mail", label: "Correo" },
  { value: "clock", label: "Horario" },
  { value: "building", label: "Edificio / oficina" },
  { value: "message", label: "Mensaje / otro" },
];

const CONTACT_SOCIAL_PLATFORM_OPTIONS: { value: ContactSocialPlatform; label: string }[] = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "threads", label: "Threads" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Sitio web / otro" },
];

const SERVICE_PANEL_CONTACT_ICON_OPTIONS: { value: ServiceCardContactLink["icon"]; label: string }[] = [
  { value: "messageCircle", label: "Chat / WhatsApp" },
  { value: "mail", label: "Correo" },
  { value: "phone", label: "Teléfono" },
  { value: "link", label: "Enlace genérico" },
];

const DEFAULT_SERVICE_PANEL_PHONE_HREF =
  DEFAULT_SERVICE_CARD_CONTACT_LINKS.find((l) => l.icon === "phone")?.href ?? "tel:+523300000000";

function serviceContactPhoneDisplayFromHref(href: string): string {
  const h = href.trim();
  if (!h.toLowerCase().startsWith("tel:")) return "";
  return h.slice(4).trim();
}

function serviceContactTelHrefFromNumberInput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  let out = "";
  for (let i = 0; i < t.length; i += 1) {
    const ch = t[i]!;
    if (ch === "+" && out === "") out += "+";
    else if (/\d/.test(ch)) out += ch;
  }
  if (!out || out === "+") return "";
  return `tel:${out}`;
}

type H = SiteContent["home"];
export function HomeEditorForm({
  draft,
  onChange,
  activeSectionId,
}: {
  draft: H;
  onChange: (next: H) => void;
  activeSectionId: string | null;
}) {
  const p = (patch: Partial<H>) => onChange({ ...draft, ...patch });
  const s = (id: string) => pickSection(activeSectionId, id);
  return (
    <div className="space-y-6">
      {activeSectionId == null && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Elige un bloque en «Secciones de esta página» (vista previa) para editar sus textos aquí.
        </p>
      )}
      {s("home-hero") && (
      <EditorSection title="Portada principal" sectionId="home-hero">
        <ImageUploadField
          label="Imagen o vídeo de fondo"
          storagePage="home"
          fieldKey="heroImage"
          editorPreviewFieldKey="home-hero-bg"
          value={draft.heroImage}
          onChange={(v) => p({ heroImage: v })}
          allowVideo
          hint="Imagen (JPG, PNG, WebP…) o vídeo (MP4, WebM, MOV). En la web el vídeo se reproduce en bucle y sin sonido."
        />
        <LabeledField label="Línea superior (etiqueta pequeña)" editorFieldKey="home-hero-kicker">
          <TextInput value={draft.heroKicker} onChange={(v) => p({ heroKicker: v })} />
        </LabeledField>
        <LabeledField label="Título principal" editorFieldKey="home-hero-title">
          <TextInput value={draft.heroTitle} onChange={(v) => p({ heroTitle: v })} />
        </LabeledField>
        <LabeledField label="Subtítulo" editorFieldKey="home-hero-subtitle">
          <TextArea value={draft.heroSubtitle} onChange={(v) => p({ heroSubtitle: v })} rows={2} />
        </LabeledField>
        <LabeledField label="Enlace: texto hacia Desarrollos" editorFieldKey="home-hero-devLink">
          <TextInput value={draft.heroLinkDevLabel} onChange={(v) => p({ heroLinkDevLabel: v })} />
        </LabeledField>
        <LabeledField label="Enlace: texto hacia Nosotros" editorFieldKey="home-hero-aboutLink">
          <TextInput value={draft.heroLinkAboutLabel} onChange={(v) => p({ heroLinkAboutLabel: v })} />
        </LabeledField>
        <LabeledField label="Botón principal" editorFieldKey="home-hero-ctaPrimary">
          <TextInput value={draft.heroCtaPrimary} onChange={(v) => p({ heroCtaPrimary: v })} />
        </LabeledField>
        <LabeledField label="Enlace secundario (texto)" editorFieldKey="home-hero-ctaSecondary">
          <TextInput value={draft.heroCtaSecondary} onChange={(v) => p({ heroCtaSecondary: v })} />
        </LabeledField>
      </EditorSection>
      )}

      {s("home-search") && (
      <EditorSection title="Búsqueda" sectionId="home-search">
        <ImageUploadField
          label="Imagen de fondo de la sección"
          storagePage="home"
          fieldKey="searchImage"
          editorPreviewFieldKey="home-search-image"
          value={draft.searchImage}
          onChange={(v) => p({ searchImage: v })}
        />
        <LabeledField label="Etiqueta pequeña" editorFieldKey="home-search-kicker">
          <TextInput value={draft.searchKicker} onChange={(v) => p({ searchKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="home-search-title">
          <TextInput value={draft.searchTitle} onChange={(v) => p({ searchTitle: v })} />
        </LabeledField>
        <LabeledField label="Descripción" editorFieldKey="home-search-subtitle">
          <TextArea value={draft.searchSubtitle} onChange={(v) => p({ searchSubtitle: v })} rows={2} />
        </LabeledField>
      </EditorSection>
      )}

      {s("home-selection") && (
      <EditorSection title="Selección de propiedades" sectionId="home-selection">
        <LabeledField label="Etiqueta" editorFieldKey="home-selection-kicker">
          <TextInput value={draft.selectionKicker} onChange={(v) => p({ selectionKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="home-selection-title">
          <TextInput value={draft.selectionTitle} onChange={(v) => p({ selectionTitle: v })} />
        </LabeledField>
        <LabeledField label="Descripción" editorFieldKey="home-selection-subtitle">
          <TextArea value={draft.selectionSubtitle} onChange={(v) => p({ selectionSubtitle: v })} rows={2} />
        </LabeledField>
        <LabeledField label="Texto del enlace al catálogo" editorFieldKey="home-selection-catalogLink">
          <TextInput value={draft.selectionCatalogLink} onChange={(v) => p({ selectionCatalogLink: v })} />
        </LabeledField>
        <LabeledField label="Texto enlace renta" editorFieldKey="home-selection-rentLabel">
          <TextInput value={draft.selectionRentLabel} onChange={(v) => p({ selectionRentLabel: v })} />
        </LabeledField>
        <LabeledField label="Texto enlace venta" editorFieldKey="home-selection-saleLabel">
          <TextInput value={draft.selectionSaleLabel} onChange={(v) => p({ selectionSaleLabel: v })} />
        </LabeledField>
      </EditorSection>
      )}

      {s("home-social") && (
      <EditorSection title="Síguenos (Instagram)" sectionId="home-social">
        <LabeledField label="Etiqueta" editorFieldKey="home-social-kicker">
          <TextInput value={draft.socialKicker} onChange={(v) => p({ socialKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="home-social-title">
          <TextInput value={draft.socialTitle} onChange={(v) => p({ socialTitle: v })} />
        </LabeledField>
        <LabeledField label="Descripción" editorFieldKey="home-social-subtitle">
          <TextArea value={draft.socialSubtitle} onChange={(v) => p({ socialSubtitle: v })} rows={2} />
        </LabeledField>
        <LabeledField label="Texto del botón" editorFieldKey="home-social-cta">
          <TextInput value={draft.socialCta} onChange={(v) => p({ socialCta: v })} />
        </LabeledField>
        <LabeledField label="Aviso si el feed no carga" editorFieldKey="home-social-empty">
          <TextArea value={draft.socialEmpty} onChange={(v) => p({ socialEmpty: v })} rows={2} />
        </LabeledField>
        <p className="text-xs text-slate-500">
          Las publicaciones se traen de Instagram automáticamente y el enlace al perfil sale de «Mi
          empresa»: aquí solo se edita el texto de la sección.
        </p>
      </EditorSection>
      )}

      {s("home-experience") && (
      <EditorSection title="Bloque Experiencia" sectionId="home-experience">
        <ImageUploadField
          label="Imagen"
          storagePage="home"
          fieldKey="experienceImage"
          editorPreviewFieldKey="home-experience-image"
          value={draft.experienceImage}
          onChange={(v) => p({ experienceImage: v })}
        />
        <LabeledField
          label="Posición de la imagen (escritorio)"
          hint="Solo intercambia columnas en pantallas grandes; en móvil el texto sigue arriba. Variante acotada (izquierda / derecha), sin maquetación libre."
          editorFieldKey="home-experience-mediaPosition"
        >
          <select
            value={draft.experienceMediaPosition ?? "left"}
            onChange={(e) =>
              p({
                experienceMediaPosition: (e.target.value === "left" ? undefined : "right") as "right" | undefined,
              })
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="left">Imagen a la izquierda</option>
            <option value="right">Imagen a la derecha</option>
          </select>
        </LabeledField>
        <LabeledField label="Etiqueta" editorFieldKey="home-experience-kicker">
          <TextInput value={draft.experienceKicker} onChange={(v) => p({ experienceKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="home-experience-title">
          <TextInput value={draft.experienceTitle} onChange={(v) => p({ experienceTitle: v })} />
        </LabeledField>
        <LabeledField label="Texto destacado (cursiva)" editorFieldKey="home-experience-lead">
          <TextArea value={draft.experienceLead} onChange={(v) => p({ experienceLead: v })} rows={2} />
        </LabeledField>
        <LabeledField label="Párrafo" editorFieldKey="home-experience-body">
          <TextArea value={draft.experienceBody} onChange={(v) => p({ experienceBody: v })} rows={3} />
        </LabeledField>
        <LabeledField label="Botón" editorFieldKey="home-experience-cta">
          <TextInput value={draft.experienceCta} onChange={(v) => p({ experienceCta: v })} />
        </LabeledField>
      </EditorSection>
      )}

      {s("home-closing") && (
      <EditorSection title="Cierre (antes del pie de página)" sectionId="home-closing">
        <LabeledField label="Etiqueta pequeña" editorFieldKey="home-closing-kicker">
          <TextInput value={draft.closingKicker} onChange={(v) => p({ closingKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="home-closing-title">
          <TextInput value={draft.closingTitle} onChange={(v) => p({ closingTitle: v })} />
        </LabeledField>
        <LabeledField label="Texto" editorFieldKey="home-closing-subtitle">
          <TextArea value={draft.closingSubtitle} onChange={(v) => p({ closingSubtitle: v })} rows={2} />
        </LabeledField>
        <LabeledField label="Botón principal" editorFieldKey="home-closing-btnPrimary">
          <TextInput value={draft.closingBtnPrimary} onChange={(v) => p({ closingBtnPrimary: v })} />
        </LabeledField>
        <LabeledField label="Botón secundario" editorFieldKey="home-closing-btnSecondary">
          <TextInput value={draft.closingBtnSecondary} onChange={(v) => p({ closingBtnSecondary: v })} />
        </LabeledField>
      </EditorSection>
      )}
    </div>
  );
}

type C = SiteContent["contact"];
export function ContactEditorForm({
  draft,
  onChange,
  activeSectionId,
}: {
  draft: C;
  onChange: (next: C) => void;
  activeSectionId: string | null;
}) {
  const safe = mergeSiteSection("contact", draft);
  const p = (patch: Partial<C>) => onChange(mergeSiteSection("contact", { ...draft, ...patch }));
  const updateInfoItem = (index: number, patch: Partial<C["infoItems"][number]>) => {
    const infoItems = safe.infoItems.map((row, i) => (i === index ? { ...row, ...patch } : row));
    p({ infoItems });
  };
  const addInfoItem = () => {
    p({
      infoItems: [...safe.infoItems, { title: "", body: "", icon: "message" }],
    });
  };
  const removeInfoItem = (index: number) => {
    if (safe.infoItems.length <= 1) return;
    p({ infoItems: safe.infoItems.filter((_, i) => i !== index) });
  };
  const addFaqItem = () => {
    p({ faq: [...safe.faq, { question: "", answer: "" }] });
  };
  const removeFaqItem = (index: number) => {
    if (safe.faq.length <= 1) return;
    p({ faq: safe.faq.filter((_, i) => i !== index) });
  };
  const updateSocialLink = (index: number, patch: Partial<C["socialLinks"][number]>) => {
    const socialLinks = safe.socialLinks.map((row, i) => (i === index ? { ...row, ...patch } : row));
    p({ socialLinks });
  };
  const addSocialLink = () => {
    p({ socialLinks: [...safe.socialLinks, { platform: "instagram", url: "" }] });
  };
  const removeSocialLink = (index: number) => {
    p({ socialLinks: safe.socialLinks.filter((_, i) => i !== index) });
  };
  const s = (id: string) => pickSection(activeSectionId, id);
  return (
    <div className="space-y-6">
      {activeSectionId == null && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Elige un bloque en «Secciones de esta página» para editar sus textos aquí.
        </p>
      )}
      {s("contact-hero") && (
      <EditorSection title="Cabecera" sectionId="contact-hero">
        <ImageUploadField
          label="Imagen o vídeo de fondo"
          storagePage="contact"
          fieldKey="heroImage"
          editorPreviewFieldKey="contact-hero-bg"
          value={safe.heroImage}
          onChange={(v) => p({ heroImage: v })}
          allowVideo
          hint="Imagen o vídeo de cabecera (MP4, WebM, MOV). El vídeo se reproduce en bucle y sin sonido."
        />
        <LabeledField
          label="Etiqueta superior (kicker)"
          hint="Texto pequeño sobre el título (mayúsculas en la web)."
          editorFieldKey="contact-hero-kicker"
        >
          <TextInput value={safe.heroKicker} onChange={(v) => p({ heroKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="contact-hero-title">
          <TextInput value={safe.heroTitle} onChange={(v) => p({ heroTitle: v })} />
        </LabeledField>
        <LabeledField label="Subtítulo" hint="Se muestra bajo el título; no afecta la posición de las flechas." editorFieldKey="contact-hero-subtitle">
          <TextArea value={safe.heroSubtitle} onChange={(v) => p({ heroSubtitle: v })} rows={2} />
        </LabeledField>
      </EditorSection>
      )}

      {s("contact-visit") && (
      <EditorSection title="Visítanos y mapa" sectionId="contact-visit">
        <LabeledField label="Kicker (pequeño arriba)" editorFieldKey="contact-visit-kicker">
          <TextInput value={safe.visitKicker} onChange={(v) => p({ visitKicker: v })} />
        </LabeledField>
        <LabeledField label="Título principal" editorFieldKey="contact-visit-title">
          <TextInput value={safe.visitTitle} onChange={(v) => p({ visitTitle: v })} />
        </LabeledField>
        <LabeledField label="Texto introductorio" editorFieldKey="contact-visit-intro">
          <TextArea value={safe.visitIntro} onChange={(v) => p({ visitIntro: v })} rows={3} />
        </LabeledField>
        <LabeledField label="Título del bloque (lista)" editorFieldKey="contact-visit-infoTitle">
          <TextInput value={safe.infoTitle} onChange={(v) => p({ infoTitle: v })} />
        </LabeledField>
        <p className="text-xs text-slate-500">
          Cada fila aparece numerada en la página. Los enlaces «Llamar» y «Correo» usan el primer bloque con icono
          teléfono y el primero con icono correo, respectivamente.
        </p>
        {safe.infoItems.map((item, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">Contacto {i + 1}</p>
              <button
                type="button"
                disabled={safe.infoItems.length <= 1}
                onClick={() => removeInfoItem(i)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Eliminar
              </button>
            </div>
            <LabeledField label="Icono" editorFieldKey={`contact-visit-info-${i}-icon`}>
              <select
                value={item.icon}
                onChange={(e) => updateInfoItem(i, { icon: e.target.value as ContactInfoIcon })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {CONTACT_ICON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </LabeledField>
            <LabeledField label="Título (ej. Dirección)" editorFieldKey={`contact-visit-info-${i}-title`}>
              <TextInput value={item.title} onChange={(v) => updateInfoItem(i, { title: v })} />
            </LabeledField>
            <LabeledField label="Texto (varias líneas)" hint="Pulsa Enter para nueva línea." editorFieldKey={`contact-visit-info-${i}-body`}>
              <TextArea value={item.body} onChange={(v) => updateInfoItem(i, { body: v })} rows={3} />
            </LabeledField>
          </div>
        ))}
        <button
          type="button"
          onClick={addInfoItem}
          className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/80 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:bg-white hover:text-primary"
        >
          Añadir contacto
        </button>
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledField label="Latitud (mapa)" editorFieldKey="contact-visit-mapLat">
            <NumberInput value={safe.mapLat} onChange={(v) => p({ mapLat: v })} step="any" />
          </LabeledField>
          <LabeledField label="Longitud (mapa)" editorFieldKey="contact-visit-mapLng">
            <NumberInput value={safe.mapLng} onChange={(v) => p({ mapLng: v })} step="any" />
          </LabeledField>
        </div>
        <LabeledField label="Título en el mapa (ventana emergente)" editorFieldKey="contact-visit-mapPopupTitle">
          <TextInput value={safe.mapPopupTitle} onChange={(v) => p({ mapPopupTitle: v })} />
        </LabeledField>
        <LabeledField label="Dirección en el mapa (ventana)" hint="Varias líneas: se respetan en el globo del mapa." editorFieldKey="contact-visit-mapPopupAddress">
          <TextArea value={safe.mapPopupAddress} onChange={(v) => p({ mapPopupAddress: v })} rows={3} />
        </LabeledField>
        <LabeledField label="Etiqueta pequeña (encabezado mapa en página)" editorFieldKey="contact-visit-mapSectionKicker">
          <TextInput value={safe.mapSectionKicker} onChange={(v) => p({ mapSectionKicker: v })} />
        </LabeledField>
        <LabeledField label="Título encabezado mapa en página" editorFieldKey="contact-visit-mapSectionTitle">
          <TextInput value={safe.mapSectionTitle} onChange={(v) => p({ mapSectionTitle: v })} />
        </LabeledField>
      </EditorSection>
      )}

      {s("contact-whatsapp") && (
      <EditorSection title="Caja WhatsApp" sectionId="contact-whatsapp">
        <LabeledField label="Título" editorFieldKey="contact-whatsapp-title">
          <TextInput value={safe.quickTitle} onChange={(v) => p({ quickTitle: v })} />
        </LabeledField>
        <LabeledField label="Texto" editorFieldKey="contact-whatsapp-subtitle">
          <TextArea value={safe.quickSubtitle} onChange={(v) => p({ quickSubtitle: v })} rows={2} />
        </LabeledField>
        <LabeledField label="Texto del botón" editorFieldKey="contact-whatsapp-label">
          <TextInput value={safe.quickWhatsappLabel} onChange={(v) => p({ quickWhatsappLabel: v })} />
        </LabeledField>
        <LabeledField label="Enlace de WhatsApp" hint="Ej: https://wa.me/5213312345678" editorFieldKey="contact-whatsapp-href">
          <TextInput value={safe.quickWhatsappHref} onChange={(v) => p({ quickWhatsappHref: v })} />
        </LabeledField>
      </EditorSection>
      )}

      {s("contact-form") && (
      <EditorSection title="Formulario" sectionId="contact-form">
        <LabeledField label="Kicker (pequeño arriba del título)" editorFieldKey="contact-form-kicker">
          <TextInput value={safe.formKicker} onChange={(v) => p({ formKicker: v })} />
        </LabeledField>
        <LabeledField label="Título del formulario" editorFieldKey="contact-form-title">
          <TextInput value={safe.formTitle} onChange={(v) => p({ formTitle: v })} />
        </LabeledField>
        <LabeledField label="Mensaje de éxito — título" editorFieldKey="contact-form-successTitle">
          <TextInput value={safe.successTitle} onChange={(v) => p({ successTitle: v })} />
        </LabeledField>
        <LabeledField label="Mensaje de éxito — texto" editorFieldKey="contact-form-successSubtitle">
          <TextArea value={safe.successSubtitle} onChange={(v) => p({ successSubtitle: v })} rows={2} />
        </LabeledField>
      </EditorSection>
      )}

      {s("contact-faq") && (
      <EditorSection title="Preguntas frecuentes" sectionId="contact-faq">
        <LabeledField label="Kicker" editorFieldKey="contact-faq-kicker">
          <TextInput value={safe.faqKicker} onChange={(v) => p({ faqKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="contact-faq-title">
          <TextInput value={safe.faqTitle} onChange={(v) => p({ faqTitle: v })} />
        </LabeledField>
        {safe.faq.map((item, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">Pregunta {i + 1}</p>
              <button
                type="button"
                disabled={safe.faq.length <= 1}
                onClick={() => removeFaqItem(i)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Eliminar
              </button>
            </div>
            <LabeledField label="Pregunta" editorFieldKey={`contact-faq-${i}-question`}>
              <TextInput
                value={item.question}
                onChange={(v) => {
                  const faq = safe.faq.map((f, j) => (j === i ? { ...f, question: v } : f));
                  p({ faq });
                }}
              />
            </LabeledField>
            <LabeledField label="Respuesta" editorFieldKey={`contact-faq-${i}-answer`}>
              <TextArea
                value={item.answer}
                onChange={(v) => {
                  const faq = safe.faq.map((f, j) => (j === i ? { ...f, answer: v } : f));
                  p({ faq });
                }}
                rows={3}
              />
            </LabeledField>
          </div>
        ))}
        <button
          type="button"
          onClick={addFaqItem}
          className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/80 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:bg-white hover:text-primary"
        >
          Añadir pregunta
        </button>
      </EditorSection>
      )}

      {s("contact-social") && (
      <EditorSection title="Redes y enlaces" sectionId="contact-social">
        <LabeledField label="Kicker" editorFieldKey="contact-social-kicker">
          <TextInput value={safe.socialKicker} onChange={(v) => p({ socialKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="contact-social-title">
          <TextInput value={safe.socialTitle} onChange={(v) => p({ socialTitle: v })} />
        </LabeledField>
        <LabeledField label="Texto" editorFieldKey="contact-social-intro">
          <TextArea value={safe.socialIntro} onChange={(v) => p({ socialIntro: v })} rows={2} />
        </LabeledField>
        <p className="text-xs text-slate-500">
          Añade solo las redes que quieras mostrar. Si dejas la URL vacía, ese icono no aparece en la web pública. Usa
          enlaces completos (https://…).
        </p>
        {safe.socialLinks.map((link, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">Red {i + 1}</p>
              <button
                type="button"
                onClick={() => removeSocialLink(i)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Eliminar
              </button>
            </div>
            <LabeledField label="Plataforma" editorFieldKey={`contact-social-${i}-platform`}>
              <select
                value={link.platform}
                onChange={(e) => updateSocialLink(i, { platform: e.target.value as ContactSocialPlatform })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {CONTACT_SOCIAL_PLATFORM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </LabeledField>
            <LabeledField label="URL" hint="Ej: https://instagram.com/tu_cuenta" editorFieldKey={`contact-social-${i}-url`}>
              <TextInput value={link.url} onChange={(v) => updateSocialLink(i, { url: v })} />
            </LabeledField>
          </div>
        ))}
        <button
          type="button"
          onClick={addSocialLink}
          className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/80 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:bg-white hover:text-primary"
        >
          Añadir red social
        </button>
        <p className="text-xs text-slate-500">
          Los enlaces «venta / renta / servicios» bajo las redes y el texto para asesores son fijos (rutas base del sitio).
        </p>
      </EditorSection>
      )}

      {s("contact-closing") && (
      <EditorSection title="Cierre" sectionId="contact-closing">
        <LabeledField label="Kicker" editorFieldKey="contact-closing-kicker">
          <TextInput value={safe.closingKicker} onChange={(v) => p({ closingKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="contact-closing-title">
          <TextInput value={safe.closingTitle} onChange={(v) => p({ closingTitle: v })} />
        </LabeledField>
        <LabeledField label="Subtítulo" editorFieldKey="contact-closing-subtitle">
          <TextArea value={safe.closingSubtitle} onChange={(v) => p({ closingSubtitle: v })} rows={2} />
        </LabeledField>
        <LabeledField label="Botón principal — texto" editorFieldKey="contact-closing-btnPrimary">
          <TextInput value={safe.closingBtnPrimary} onChange={(v) => p({ closingBtnPrimary: v })} />
        </LabeledField>
        <LabeledField label="Botón secundario — texto" editorFieldKey="contact-closing-btnSecondary">
          <TextInput value={safe.closingBtnSecondary} onChange={(v) => p({ closingBtnSecondary: v })} />
        </LabeledField>
      </EditorSection>
      )}
    </div>
  );
}

function randomServiceBlockId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

function createDetailBlock(kind: ServiceDetailBlock["type"]): ServiceDetailBlock {
  const id = randomServiceBlockId();
  switch (kind) {
    case "heading":
      return { id, type: "heading", text: "" };
    case "subheading":
      return { id, type: "subheading", text: "" };
    case "paragraph":
      return { id, type: "paragraph", text: "" };
    case "contactParagraph":
      return { id, type: "contactParagraph", text: "", phone: "", email: "" };
    case "quote":
      return { id, type: "quote", text: "", attribution: "" };
    case "callout":
      return { id, type: "callout", text: "" };
    case "bulletList":
      return { id, type: "bulletList", items: [""] };
    case "image":
      return { id, type: "image", src: "", alt: "" };
    case "twoColumn":
      return { id, type: "twoColumn", text: "", imageSrc: "", imageAlt: "" };
    case "embedVideo":
      return { id, type: "embedVideo", url: "", caption: "" };
    case "spacer":
      return { id, type: "spacer", size: "md" };
    case "contact":
      return { id, type: "contact", items: [{ title: "", body: "", icon: "message" }] };
    case "cta":
      return { id, type: "cta", label: "Más información", href: "/contacto", variant: "primary" };
    case "divider":
      return { id, type: "divider" };
    case "faqBlock":
      return { id, type: "faqBlock", items: [{ question: "", answer: "" }] };
    case "gallery":
      return { id, type: "gallery", images: [{ src: "", alt: "" }, { src: "", alt: "" }] };
    case "iconCard":
      return { id, type: "iconCard", iconKey: "building2", title: "", body: "" };
    case "widthBand":
      return { id, type: "widthBand", mode: "content", label: "" };
    default:
      return { id, type: "paragraph", text: "" };
  }
}

const SERVICE_ICON_LABELS: Record<(typeof SERVICE_ICON_KEYS)[number], string> = {
  home: "Casa / renta",
  building2: "Edificio / venta",
  settings2: "Ajustes / administración",
  fileCheck2: "Checklist / desarrollo",
  scale: "Balanza / legal",
  barChart3: "Gráfico / avalúo",
  phone: "Teléfono",
  mail: "Correo",
  messageCircle: "Mensaje",
  landmark: "Monumento / zona",
  key: "Llaves / acceso",
  handshake: "Negociación / acuerdo",
  briefcase: "Negocios / corporativo",
  treePine: "Terreno / naturaleza",
  hardHat: "Obra / construcción",
  hammer: "Reformas / mantenimiento",
  search: "Búsqueda",
  sparkles: "Premium / destacado",
  shieldCheck: "Seguridad / garantía",
  users: "Equipo / clientes",
  clipboardList: "Trámites / documentos",
};

const DETAIL_BLOCK_KINDS: { value: ServiceDetailBlock["type"]; label: string }[] = [
  { value: "heading", label: "Título (H2)" },
  { value: "subheading", label: "Subtítulo (H3)" },
  { value: "paragraph", label: "Párrafo" },
  { value: "contactParagraph", label: "Párrafo de contacto" },
  { value: "quote", label: "Cita / testimonio" },
  { value: "callout", label: "Destacado (aviso)" },
  { value: "bulletList", label: "Lista con viñetas" },
  { value: "image", label: "Imagen" },
  { value: "twoColumn", label: "Dos columnas (texto + imagen)" },
  { value: "embedVideo", label: "Video (YouTube / Vimeo / URL)" },
  { value: "contact", label: "Bloque de contacto" },
  { value: "cta", label: "Botón (CTA)" },
  { value: "spacer", label: "Espacio vertical" },
  { value: "divider", label: "Separador" },
  { value: "faqBlock", label: "FAQ (pregunta / respuesta)" },
  { value: "gallery", label: "Galería (2–4 imágenes)" },
  { value: "iconCard", label: "Tarjeta con icono" },
  { value: "widthBand", label: "Banda de ancho (marcador visual)" },
];

type S = SiteContent["services"];
export function ServicesEditorForm({
  draft,
  onChange,
  activeSectionId,
}: {
  draft: S;
  onChange: (next: S) => void;
  activeSectionId: string | null;
}) {
  const safe = mergeSiteSection("services", draft);
  const p = (patch: Partial<S>) => onChange(mergeSiteSection("services", { ...draft, ...patch }));
  const updateCard = (index: number, patch: Partial<S["cards"][0]>) => {
    const cards = safe.cards.map((c, i) => (i === index ? { ...c, ...patch } : c)) as S["cards"];
    p({ cards });
  };
  const addCard = () => {
    const i = safe.cards.length;
    const next: S["cards"][0] = {
      title: `Nuevo servicio ${i + 1}`,
      description: "",
      bullets: [""],
      linkLabel: "Conocer más",
      slug: `servicio-${i + 1}`,
      tag: "",
      iconKey: SERVICE_ICON_KEYS[i % SERVICE_ICON_KEYS.length]!,
      contactLinks: DEFAULT_SERVICE_CARD_CONTACT_LINKS.map((l) => ({ ...l })),
      detailBlocks: [],
    };
    p({ cards: [...safe.cards, next] });
  };
  const removeCard = (index: number) => {
    if (safe.cards.length <= 1) return;
    p({ cards: safe.cards.filter((_, i) => i !== index) });
  };
  const updateDetailBlocks = (cardIndex: number, blocks: ServiceDetailBlock[]) => {
    updateCard(cardIndex, { detailBlocks: blocks });
  };
  const updateContactLink = (cardIndex: number, linkIndex: number, patch: Partial<ServiceCardContactLink>) => {
    const card = safe.cards[cardIndex];
    if (!card) return;
    const links = [...(card.contactLinks ?? [])];
    const cur = links[linkIndex];
    if (!cur) return;
    links[linkIndex] = { ...cur, ...patch };
    updateCard(cardIndex, { contactLinks: links });
  };
  const addContactLink = (cardIndex: number) => {
    const card = safe.cards[cardIndex];
    if (!card) return;
    updateCard(cardIndex, {
      contactLinks: [...(card.contactLinks ?? []), { label: "Nuevo enlace", href: "#", icon: "link" }],
    });
  };
  const removeContactLink = (cardIndex: number, linkIndex: number) => {
    const card = safe.cards[cardIndex];
    if (!card) return;
    updateCard(cardIndex, {
      contactLinks: (card.contactLinks ?? []).filter((_, j) => j !== linkIndex),
    });
  };
  const moveDetailBlock = (cardIndex: number, blockIndex: number, dir: -1 | 1) => {
    const blocks = [...(safe.cards[cardIndex]?.detailBlocks ?? [])];
    const j = blockIndex + dir;
    if (j < 0 || j >= blocks.length) return;
    const a = blocks[blockIndex];
    const b = blocks[j];
    if (!a || !b) return;
    blocks[blockIndex] = b;
    blocks[j] = a;
    updateDetailBlocks(cardIndex, blocks);
  };
  const reorderDetailBlocks = (cardIndex: number, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const list = [...(safe.cards[cardIndex]?.detailBlocks ?? [])];
    const [moved] = list.splice(fromIndex, 1);
    if (!moved) return;
    list.splice(toIndex, 0, moved);
    updateDetailBlocks(cardIndex, list);
  };
  const s = (id: string) => pickSection(activeSectionId, id);
  return (
    <DndProvider backend={HTML5Backend}>
    <div className="space-y-6">
      {activeSectionId == null && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Elige un bloque en «Secciones de esta página» para editar sus textos aquí.
        </p>
      )}
      {s("services-hero") && (
      <EditorSection title="Cabecera" sectionId="services-hero">
        <ImageUploadField
          label="Imagen o vídeo de fondo"
          storagePage="services"
          fieldKey="heroImage"
          editorPreviewFieldKey="services-hero-bg"
          value={safe.heroImage}
          onChange={(v) => p({ heroImage: v })}
          allowVideo
          hint="Imagen o vídeo de cabecera (MP4, WebM, MOV). El vídeo se reproduce en bucle y sin sonido."
        />
        <LabeledField label="Título" editorFieldKey="services-hero-title">
          <TextInput value={safe.heroTitle} onChange={(v) => p({ heroTitle: v })} />
        </LabeledField>
        <LabeledField label="Subtítulo" hint="Se muestra bajo el título; no afecta la posición de las flechas." editorFieldKey="services-hero-subtitle">
          <TextArea value={safe.heroSubtitle} onChange={(v) => p({ heroSubtitle: v })} rows={2} />
        </LabeledField>
      </EditorSection>
      )}

      {(activeSectionId == null || activeSectionId.startsWith("services-card")) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2">
          <button
            type="button"
            onClick={addCard}
            className="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-burgundy"
          >
            Añadir servicio
          </button>
          <span className="text-xs text-slate-500">Cada tarjeta es un nodo en el grafo y puede tener su propia página de detalle.</span>
        </div>
      )}

      {safe.cards.map((card, index) =>
        s(`services-card-${index}`) ? (
        <EditorSection key={`services-card-${index}`} title={`Tarjeta ${index + 1}`} sectionId={`services-card-${index}`}>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={safe.cards.length <= 1}
              onClick={() => removeCard(index)}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 disabled:opacity-40"
            >
              Eliminar servicio
            </button>
          </div>
          <LabeledField label="Título" editorFieldKey={`services-card-${index}-title`}>
            <TextInput value={card.title} onChange={(v) => updateCard(index, { title: v })} />
          </LabeledField>
          <LabeledField label="Descripción" editorFieldKey={`services-card-${index}-description`}>
            <TextArea value={card.description} onChange={(v) => updateCard(index, { description: v })} rows={3} />
          </LabeledField>
          {!card.primaryListingHref ? (
          <LabeledField label="Slug (URL)" hint="Solo minúsculas, números y guiones. URL: /servicios/d/tu-slug. No aplica si enlazas solo a un listado." editorFieldKey={`services-card-${index}-slug`}>
            <TextInput
              value={card.slug}
              onChange={(v) => {
                const slug = v
                  .toLowerCase()
                  .replace(/[^a-z0-9-]+/g, "-")
                  .replace(/^-+|-+$/g, "");
                updateCard(index, { slug });
              }}
            />
          </LabeledField>
          ) : null}
          <LabeledField
            label="Destino del enlace principal"
            hint="Renta, venta o desarrollos abren el listado existente; el resto suele usar la página dedicada con el slug."
            editorFieldKey={`services-card-${index}-primary`}
          >
            <select
              value={card.primaryListingHref ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  updateCard(index, { primaryListingHref: undefined });
                } else {
                  updateCard(index, {
                    primaryListingHref: v as (typeof SERVICE_PRIMARY_LISTING_HREFS)[number],
                    detailBlocks: [],
                    slug: "",
                  });
                }
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Página dedicada (/servicios/d/…)</option>
              <option value="/renta">Listado — Renta</option>
              <option value="/venta">Listado — Venta</option>
              <option value="/desarrollos">Listado — Desarrollos</option>
            </select>
          </LabeledField>
          <LabeledField label="Icono en el grafo" editorFieldKey={`services-card-${index}-icon`}>
            <select
              value={card.iconKey}
              onChange={(e) => updateCard(index, { iconKey: e.target.value as (typeof SERVICE_ICON_KEYS)[number] })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {SERVICE_ICON_KEYS.map((k) => (
                <option key={k} value={k}>
                  {SERVICE_ICON_LABELS[k]}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="Viñetas (lista en el panel)" editorFieldKey={`services-card-${index}-bullets`}>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            {card.bullets.map((b, bi) => (
              <div key={`b-${index}-${bi}`} className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <TextInput
                    value={b}
                    onChange={(v) => {
                      const bullets = card.bullets.map((x, j) => (j === bi ? v : x));
                      updateCard(index, { bullets });
                    }}
                  />
                </div>
                <button
                  type="button"
                  disabled={card.bullets.length <= 1}
                  className="shrink-0 rounded border border-slate-200 px-2 text-xs text-slate-600 disabled:opacity-40"
                  onClick={() => updateCard(index, { bullets: card.bullets.filter((_, j) => j !== bi) })}
                >
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => updateCard(index, { bullets: [...card.bullets, ""] })}
            >
              + Añadir viñeta
            </button>
          </div>
          </LabeledField>
          <LabeledField label="Texto del enlace al detalle" hint="El enlace lleva siempre a la página dedicada de este servicio." editorFieldKey={`services-card-${index}-linkLabel`}>
            <TextInput value={card.linkLabel} onChange={(v) => updateCard(index, { linkLabel: v })} />
          </LabeledField>

          <LabeledField
            label="Enlaces rápidos (panel del grafo)"
            hint="Con icono Teléfono solo indicas número (enlace tel: automático). El resto: URL https://, mailto:, etc. Hasta 12."
          >
            <div className="space-y-3">
              {(card.contactLinks ?? []).map((link, li) => (
                <div key={li} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/90 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-600">Enlace {li + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeContactLink(index, li)}
                      className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-800 hover:bg-red-100"
                    >
                      Eliminar
                    </button>
                  </div>
                  <LabeledField label="Texto visible" editorFieldKey={`services-card-${index}-contact-${li}`}>
                    <TextInput value={link.label} onChange={(v) => updateContactLink(index, li, { label: v })} />
                  </LabeledField>
                  <LabeledField label="Icono" editorFieldKey={`services-card-${index}-contact-${li}`}>
                    <select
                      value={link.icon}
                      onChange={(e) => {
                        const nextIcon = e.target.value as ServiceCardContactLink["icon"];
                        const cur = (card.contactLinks ?? [])[li];
                        if (!cur) return;
                        if (nextIcon === "phone") {
                          const fromTel = serviceContactPhoneDisplayFromHref(cur.href);
                          const href =
                            serviceContactTelHrefFromNumberInput(fromTel) || DEFAULT_SERVICE_PANEL_PHONE_HREF;
                          updateContactLink(index, li, { icon: "phone", href });
                        } else if (cur.icon === "phone") {
                          updateContactLink(index, li, {
                            icon: nextIcon,
                            href: cur.href.toLowerCase().startsWith("tel:") ? "#" : cur.href,
                          });
                        } else {
                          updateContactLink(index, li, { icon: nextIcon });
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      {SERVICE_PANEL_CONTACT_ICON_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </LabeledField>
                  {link.icon === "phone" ? (
                    <LabeledField
                      label="Número telefónico"
                      hint="Solo dígitos; opcional + al inicio (ej. +52…). Se usa como enlace de llamada."
                      editorFieldKey={`services-card-${index}-contact-${li}`}
                    >
                      <TextInput
                        value={serviceContactPhoneDisplayFromHref(link.href)}
                        onChange={(v) =>
                          updateContactLink(
                            index,
                            li,
                            {
                              href: serviceContactTelHrefFromNumberInput(v) || DEFAULT_SERVICE_PANEL_PHONE_HREF,
                            },
                          )
                        }
                        placeholder="+52 33 1234 5678"
                      />
                    </LabeledField>
                  ) : (
                    <LabeledField label="URL" editorFieldKey={`services-card-${index}-contact-${li}`}>
                      <TextInput
                        value={link.href}
                        onChange={(v) => updateContactLink(index, li, { href: v })}
                        placeholder="https://… · mailto:…"
                      />
                    </LabeledField>
                  )}
                </div>
              ))}
              <button
                type="button"
                disabled={(card.contactLinks ?? []).length >= 12}
                onClick={() => addContactLink(index)}
                className="text-xs font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Añadir enlace de contacto
              </button>
            </div>
          </LabeledField>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-900 p-4 text-slate-100 shadow-inner ring-1 ring-white/10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Vista previa — panel del grafo</p>
            <p className="font-heading text-lg font-light leading-snug text-white">{card.title || "Título"}</p>
            <ul className="mt-2 space-y-1.5 text-xs text-white/75">
              {(card.bullets ?? []).filter(Boolean).slice(0, 5).map((b, li) => (
                <li key={`${li}-${b}`} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" aria-hidden />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-white/50 underline decoration-white/30">
              {(card.linkLabel ?? "").trim() || "Conocer más"} →{" "}
              <span className="font-mono normal-case no-underline opacity-80">
                {resolveServiceCardPrimaryHref(card) ?? "—"}
              </span>
            </p>
          </div>

          <div
            className="pointer-events-none my-14 flex flex-col items-center justify-center gap-6 select-none sm:my-20"
            aria-hidden
          >
            <div className="h-px w-full max-w-2xl bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
            <div className="h-2 w-2 shrink-0 rounded-full bg-slate-400/80 shadow-sm ring-4 ring-slate-200/60" />
            <div className="h-px w-full max-w-2xl bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          </div>

          {serviceCardUsesDedicatedPage(card) ? (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-800">Página dedicada (bloques)</p>
            <p className="text-xs text-slate-500">
              {card.slug?.trim() ? (
                <>
                  Contenido de <code className="rounded bg-white px-1">/servicios/d/{card.slug}</code>
                </>
              ) : (
                <>Define un slug arriba para publicar en <code className="rounded bg-white px-1">/servicios/d/…</code></>
              )}
            </p>
            <p className="text-[11px] leading-relaxed text-slate-500/90">
              <span className="font-semibold text-slate-600">Sugerencia:</span> combina título (H2), subtítulo (H3) y párrafos; usa cita,
              destacado o dos columnas para variar el ritmo, y espacio vertical entre secciones. La página dedicada se muestra siempre en columna (orden de los bloques).
            </p>
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300/80 bg-white/80 p-3">
              <div className="min-w-[200px] flex-1">
                <LabeledField label="Tipo de bloque a añadir">
                  <select
                    id={`add-block-kind-${index}`}
                    key={(card.detailBlocks ?? []).length}
                    defaultValue="paragraph"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs text-slate-900"
                  >
                    {DETAIL_BLOCK_KINDS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </LabeledField>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-brand-navy px-3 py-2 text-xs font-semibold text-white hover:bg-brand-burgundy"
                onClick={() => {
                  const el = document.getElementById(`add-block-kind-${index}`) as HTMLSelectElement | null;
                  const kind = (el?.value ?? "paragraph") as ServiceDetailBlock["type"];
                  updateDetailBlocks(index, [...(card.detailBlocks ?? []), createDetailBlock(kind)]);
                }}
              >
                Añadir bloque
              </button>
            </div>
            {(card.detailBlocks ?? []).map((block, bi) => (
              <DetailBlockReorderRow
                key={block.id}
                index={bi}
                moveRow={(from, to) => reorderDetailBlocks(index, from, to)}
              >
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={block.type}
                    onChange={(e) => {
                      const kind = e.target.value as ServiceDetailBlock["type"];
                      const nb = createDetailBlock(kind);
                      const blocks = (card.detailBlocks ?? []).map((b, j) => (j === bi ? { ...nb, id: b.id } : b));
                      updateDetailBlocks(index, blocks);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                  >
                    {DETAIL_BLOCK_KINDS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600"
                    onClick={() => moveDetailBlock(index, bi, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600"
                    onClick={() => moveDetailBlock(index, bi, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="ml-auto text-[11px] font-semibold text-red-700"
                    onClick={() =>
                      updateDetailBlocks(
                        index,
                        (card.detailBlocks ?? []).filter((_, j) => j !== bi),
                      )
                    }
                  >
                    Quitar bloque
                  </button>
                </div>
                {block.type === "heading" ? (
                  <LabeledField label="Texto del título">
                    <TextInput
                      value={block.text}
                      onChange={(v) => {
                        const blocks = (card.detailBlocks ?? []).map((b, j) =>
                          j === bi && b.type === "heading" ? { ...b, text: v } : b,
                        );
                        updateDetailBlocks(index, blocks);
                      }}
                    />
                  </LabeledField>
                ) : null}
                {block.type === "subheading" ? (
                  <LabeledField label="Texto del subtítulo">
                    <TextInput
                      value={block.text}
                      onChange={(v) => {
                        const blocks = (card.detailBlocks ?? []).map((b, j) =>
                          j === bi && b.type === "subheading" ? { ...b, text: v } : b,
                        );
                        updateDetailBlocks(index, blocks);
                      }}
                    />
                  </LabeledField>
                ) : null}
                {block.type === "paragraph" ? (
                  <LabeledField label="Párrafo">
                    <TextArea
                      value={block.text}
                      onChange={(v) => {
                        const blocks = (card.detailBlocks ?? []).map((b, j) =>
                          j === bi && b.type === "paragraph" ? { ...b, text: v } : b,
                        );
                        updateDetailBlocks(index, blocks);
                      }}
                      rows={4}
                    />
                  </LabeledField>
                ) : null}
                {block.type === "contactParagraph" ? (
                  <>
                    <LabeledField label="Texto del párrafo">
                      <TextArea
                        value={block.text}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "contactParagraph" ? { ...b, text: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                        rows={4}
                      />
                    </LabeledField>
                    <LabeledField
                      label="Teléfono"
                      hint="Dígitos y + opcional; el enlace tel: se genera solo (puedes escribir el número como lo muestras al público)."
                    >
                      <TextInput
                        value={block.phone}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "contactParagraph" ? { ...b, phone: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                      />
                    </LabeledField>
                    <LabeledField label="Correo electrónico" hint="Solo la dirección; se usa mailto: automáticamente.">
                      <TextInput
                        value={block.email}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "contactParagraph" ? { ...b, email: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                      />
                    </LabeledField>
                  </>
                ) : null}
                {block.type === "quote" ? (
                  <>
                    <LabeledField label="Cita o testimonio">
                      <TextArea
                        value={block.text}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "quote" ? { ...b, text: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                        rows={3}
                      />
                    </LabeledField>
                    <LabeledField label="Atribución (opcional)" hint="Nombre, cargo o fuente.">
                      <TextInput
                        value={block.attribution ?? ""}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "quote" ? { ...b, attribution: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                      />
                    </LabeledField>
                  </>
                ) : null}
                {block.type === "callout" ? (
                  <LabeledField label="Texto del destacado">
                    <TextArea
                      value={block.text}
                      onChange={(v) => {
                        const blocks = (card.detailBlocks ?? []).map((b, j) =>
                          j === bi && b.type === "callout" ? { ...b, text: v } : b,
                        );
                        updateDetailBlocks(index, blocks);
                      }}
                      rows={3}
                    />
                  </LabeledField>
                ) : null}
                {block.type === "bulletList" ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">Ítems de la lista</p>
                    {(block.items ?? []).map((item, ii) => (
                      <div key={`${block.id}-li-${ii}`} className="flex gap-2">
                        <TextInput
                          value={item}
                          onChange={(v) => {
                            const blocks = (card.detailBlocks ?? []).map((b, j) => {
                              if (j !== bi || b.type !== "bulletList") return b;
                              const items = b.items.map((row, jj) => (jj === ii ? v : row));
                              return { ...b, items };
                            });
                            updateDetailBlocks(index, blocks);
                          }}
                        />
                        <button
                          type="button"
                          disabled={(block.items?.length ?? 0) <= 1}
                          className="shrink-0 rounded border border-slate-200 px-2 text-xs text-slate-600 disabled:opacity-40"
                          onClick={() => {
                            const blocks = (card.detailBlocks ?? []).map((b, j) => {
                              if (j !== bi || b.type !== "bulletList") return b;
                              return { ...b, items: b.items.filter((_, jj) => jj !== ii) };
                            });
                            updateDetailBlocks(index, blocks);
                          }}
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary hover:underline"
                      onClick={() => {
                        const blocks = (card.detailBlocks ?? []).map((b, j) => {
                          if (j !== bi || b.type !== "bulletList") return b;
                          return { ...b, items: [...b.items, ""] };
                        });
                        updateDetailBlocks(index, blocks);
                      }}
                    >
                      + Añadir ítem
                    </button>
                  </div>
                ) : null}
                {block.type === "image" ? (
                  <>
                    <ImageUploadField
                      label="Imagen"
                      storagePage="services"
                      fieldKey={`svc-${index}-b-${block.id}-img`}
                      value={block.src}
                      onChange={(v) => {
                        const blocks = (card.detailBlocks ?? []).map((b, j) =>
                          j === bi && b.type === "image" ? { ...b, src: v } : b,
                        );
                        updateDetailBlocks(index, blocks);
                      }}
                    />
                    <LabeledField label="Texto alternativo">
                      <TextInput
                        value={block.alt}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "image" ? { ...b, alt: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                      />
                    </LabeledField>
                  </>
                ) : null}
                {block.type === "twoColumn" ? (
                  <>
                    <LabeledField label="Texto (columna izquierda)">
                      <TextArea
                        value={block.text}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "twoColumn" ? { ...b, text: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                        rows={4}
                      />
                    </LabeledField>
                    <ImageUploadField
                      label="Imagen (columna derecha)"
                      storagePage="services"
                      fieldKey={`svc-${index}-b-${block.id}-2col`}
                      value={block.imageSrc}
                      onChange={(v) => {
                        const blocks = (card.detailBlocks ?? []).map((b, j) =>
                          j === bi && b.type === "twoColumn" ? { ...b, imageSrc: v } : b,
                        );
                        updateDetailBlocks(index, blocks);
                      }}
                    />
                    <LabeledField label="Texto alternativo de la imagen">
                      <TextInput
                        value={block.imageAlt}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "twoColumn" ? { ...b, imageAlt: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                      />
                    </LabeledField>
                  </>
                ) : null}
                {block.type === "embedVideo" ? (
                  <>
                    <LabeledField
                      label="URL del video"
                      hint="Enlace de YouTube/Vimeo o URL completa de un iframe (embed)."
                    >
                      <TextInput
                        value={block.url}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "embedVideo" ? { ...b, url: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                      />
                    </LabeledField>
                    <LabeledField label="Pie de video (opcional)">
                      <TextInput
                        value={block.caption ?? ""}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "embedVideo" ? { ...b, caption: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                      />
                    </LabeledField>
                  </>
                ) : null}
                {block.type === "spacer" ? (
                  <LabeledField label="Altura del espacio">
                    <select
                      value={block.size}
                      onChange={(e) => {
                        const size = (e.target.value === "sm" || e.target.value === "lg" ? e.target.value : "md") as
                          | "sm"
                          | "md"
                          | "lg";
                        const blocks = (card.detailBlocks ?? []).map((b, j) =>
                          j === bi && b.type === "spacer" ? { ...b, size } : b,
                        );
                        updateDetailBlocks(index, blocks);
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="sm">Pequeño</option>
                      <option value="md">Mediano</option>
                      <option value="lg">Grande</option>
                    </select>
                  </LabeledField>
                ) : null}
                {block.type === "contact" ? (
                  <div className="space-y-3">
                    {(block.items ?? []).map((it, ii) => (
                      <div key={`${block.id}-c-${ii}`} className="rounded border border-slate-100 p-2">
                        <LabeledField label="Icono">
                          <select
                            value={it.icon}
                            onChange={(e) => {
                              const icon = e.target.value as ContactInfoIcon;
                              const blocks = (card.detailBlocks ?? []).map((b, j) => {
                                if (j !== bi || b.type !== "contact") return b;
                                const items = b.items.map((row, jj) => (jj === ii ? { ...row, icon } : row));
                                return { ...b, items };
                              });
                              updateDetailBlocks(index, blocks);
                            }}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                          >
                            {CONTACT_ICON_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </LabeledField>
                        <LabeledField label="Título">
                          <TextInput
                            value={it.title}
                            onChange={(v) => {
                              const blocks = (card.detailBlocks ?? []).map((b, j) => {
                                if (j !== bi || b.type !== "contact") return b;
                                const items = b.items.map((row, jj) => (jj === ii ? { ...row, title: v } : row));
                                return { ...b, items };
                              });
                              updateDetailBlocks(index, blocks);
                            }}
                          />
                        </LabeledField>
                        <LabeledField label="Contenido (Enter = nueva línea)">
                          <TextArea
                            value={it.body}
                            onChange={(v) => {
                              const blocks = (card.detailBlocks ?? []).map((b, j) => {
                                if (j !== bi || b.type !== "contact") return b;
                                const items = b.items.map((row, jj) => (jj === ii ? { ...row, body: v } : row));
                                return { ...b, items };
                              });
                              updateDetailBlocks(index, blocks);
                            }}
                            rows={2}
                          />
                        </LabeledField>
                        <button
                          type="button"
                          className="mt-1 text-[11px] text-red-700"
                          disabled={(block.items?.length ?? 0) <= 1}
                          onClick={() => {
                            const blocks = (card.detailBlocks ?? []).map((b, j) => {
                              if (j !== bi || b.type !== "contact") return b;
                              return { ...b, items: b.items.filter((_, jj) => jj !== ii) };
                            });
                            updateDetailBlocks(index, blocks);
                          }}
                        >
                          Quitar fila
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary hover:underline"
                      onClick={() => {
                        const blocks = (card.detailBlocks ?? []).map((b, j) => {
                          if (j !== bi || b.type !== "contact") return b;
                          return {
                            ...b,
                            items: [...b.items, { title: "", body: "", icon: "message" as ContactInfoIcon }],
                          };
                        });
                        updateDetailBlocks(index, blocks);
                      }}
                    >
                      + Añadir fila de contacto
                    </button>
                  </div>
                ) : null}
                {block.type === "cta" ? (
                  <>
                    <LabeledField label="Texto del botón">
                      <TextInput
                        value={block.label}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "cta" ? { ...b, label: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                      />
                    </LabeledField>
                    <LabeledField label="Enlace (ruta o URL absoluta)">
                      <TextInput
                        value={block.href}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "cta" ? { ...b, href: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                      />
                    </LabeledField>
                    <LabeledField label="Estilo">
                      <select
                        value={block.variant ?? "primary"}
                        onChange={(e) => {
                          const variant = (e.target.value === "secondary" ? "secondary" : "primary") as
                            | "primary"
                            | "secondary";
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "cta" ? { ...b, variant } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="primary">Principal</option>
                        <option value="secondary">Secundario</option>
                      </select>
                    </LabeledField>
                  </>
                ) : null}
                {block.type === "faqBlock" ? (
                  <div className="space-y-3">
                    {(block.items ?? []).map((it, ii) => (
                      <div key={`${block.id}-faq-${ii}`} className="space-y-2 rounded border border-slate-100 p-2">
                        <LabeledField label="Pregunta">
                          <TextInput
                            value={it.question}
                            onChange={(v) => {
                              const blocks = (card.detailBlocks ?? []).map((b, j) => {
                                if (j !== bi || b.type !== "faqBlock") return b;
                                const items = b.items.map((row, jj) => (jj === ii ? { ...row, question: v } : row));
                                return { ...b, items };
                              });
                              updateDetailBlocks(index, blocks);
                            }}
                          />
                        </LabeledField>
                        <LabeledField label="Respuesta">
                          <TextArea
                            value={it.answer}
                            rows={3}
                            onChange={(v) => {
                              const blocks = (card.detailBlocks ?? []).map((b, j) => {
                                if (j !== bi || b.type !== "faqBlock") return b;
                                const items = b.items.map((row, jj) => (jj === ii ? { ...row, answer: v } : row));
                                return { ...b, items };
                              });
                              updateDetailBlocks(index, blocks);
                            }}
                          />
                        </LabeledField>
                        <button
                          type="button"
                          className="text-[11px] text-red-700"
                          disabled={(block.items?.length ?? 0) <= 1}
                          onClick={() => {
                            const blocks = (card.detailBlocks ?? []).map((b, j) => {
                              if (j !== bi || b.type !== "faqBlock") return b;
                              return { ...b, items: b.items.filter((_, jj) => jj !== ii) };
                            });
                            updateDetailBlocks(index, blocks);
                          }}
                        >
                          Quitar fila
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary hover:underline"
                      onClick={() => {
                        const blocks = (card.detailBlocks ?? []).map((b, j) => {
                          if (j !== bi || b.type !== "faqBlock") return b;
                          return { ...b, items: [...b.items, { question: "", answer: "" }] };
                        });
                        updateDetailBlocks(index, blocks);
                      }}
                    >
                      + Añadir pregunta
                    </button>
                  </div>
                ) : null}
                {block.type === "gallery" ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">Entre 2 y 4 imágenes con URL (sube en Storage y pega el enlace).</p>
                    {(block.images ?? []).map((im, ii) => (
                      <div key={`${block.id}-gal-${ii}`} className="space-y-2 rounded border border-slate-100 p-2">
                        <ImageUploadField
                          label={`Imagen ${ii + 1}`}
                          storagePage="services"
                          fieldKey={`svc-${index}-gal-${block.id}-${ii}`}
                          value={im.src}
                          onChange={(v) => {
                            const blocks = (card.detailBlocks ?? []).map((b, j) => {
                              if (j !== bi || b.type !== "gallery") return b;
                              const images = b.images.map((row, jj) => (jj === ii ? { ...row, src: v } : row));
                              return { ...b, images };
                            });
                            updateDetailBlocks(index, blocks);
                          }}
                        />
                        <LabeledField label="Texto alternativo">
                          <TextInput
                            value={im.alt}
                            onChange={(v) => {
                              const blocks = (card.detailBlocks ?? []).map((b, j) => {
                                if (j !== bi || b.type !== "gallery") return b;
                                const images = b.images.map((row, jj) => (jj === ii ? { ...row, alt: v } : row));
                                return { ...b, images };
                              });
                              updateDetailBlocks(index, blocks);
                            }}
                          />
                        </LabeledField>
                        <button
                          type="button"
                          className="text-[11px] text-red-700"
                          disabled={(block.images?.length ?? 0) <= 2}
                          onClick={() => {
                            const blocks = (card.detailBlocks ?? []).map((b, j) => {
                              if (j !== bi || b.type !== "gallery") return b;
                              return { ...b, images: b.images.filter((_, jj) => jj !== ii) };
                            });
                            updateDetailBlocks(index, blocks);
                          }}
                        >
                          Quitar imagen
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={(block.images?.length ?? 0) >= 4}
                      className="text-xs font-semibold text-primary hover:underline disabled:opacity-40"
                      onClick={() => {
                        const blocks = (card.detailBlocks ?? []).map((b, j) => {
                          if (j !== bi || b.type !== "gallery") return b;
                          if (b.images.length >= 4) return b;
                          return { ...b, images: [...b.images, { src: "", alt: "" }] };
                        });
                        updateDetailBlocks(index, blocks);
                      }}
                    >
                      + Añadir imagen (máx. 4)
                    </button>
                  </div>
                ) : null}
                {block.type === "iconCard" ? (
                  <>
                    <LabeledField label="Icono">
                      <select
                        value={block.iconKey}
                        onChange={(e) => {
                          const iconKey = e.target.value as ServiceIconKey;
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "iconCard" ? { ...b, iconKey } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                      >
                        {SERVICE_ICON_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {SERVICE_ICON_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </LabeledField>
                    <LabeledField label="Título">
                      <TextInput
                        value={block.title}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "iconCard" ? { ...b, title: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                      />
                    </LabeledField>
                    <LabeledField label="Texto">
                      <TextArea
                        value={block.body}
                        rows={4}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "iconCard" ? { ...b, body: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                      />
                    </LabeledField>
                  </>
                ) : null}
                {block.type === "widthBand" ? (
                  <>
                    <LabeledField label="Modo">
                      <select
                        value={block.mode}
                        onChange={(e) => {
                          const mode = (e.target.value === "full" ? "full" : "content") as "full" | "content";
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "widthBand" ? { ...b, mode } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="content">Ancho contenido</option>
                        <option value="full">Ancho completo (banda)</option>
                      </select>
                    </LabeledField>
                    <LabeledField label="Etiqueta (opcional)" hint="Texto pequeño sobre la banda; si queda vacío se usa un texto por defecto.">
                      <TextInput
                        value={block.label ?? ""}
                        onChange={(v) => {
                          const blocks = (card.detailBlocks ?? []).map((b, j) =>
                            j === bi && b.type === "widthBand" ? { ...b, label: v } : b,
                          );
                          updateDetailBlocks(index, blocks);
                        }}
                      />
                    </LabeledField>
                  </>
                ) : null}
                {block.type === "divider" ? (
                  <p className="text-xs text-slate-500">Separador visual (sin campos).</p>
                ) : null}
              </div>
              </DetailBlockReorderRow>
            ))}
          </div>
          ) : (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-100/90 px-4 py-4 text-sm text-slate-700 shadow-sm">
            <p className="font-semibold text-slate-800">Sin página dedicada</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Esta tarjeta enlaza al listado: no hay página dedicada ni slug. El contenido por bloques se ha vaciado. Elige «Página dedicada» y un slug para volver a editar la página.
            </p>
          </div>
          )}

        </EditorSection>
        ) : null
      )}

      {s("services-cta") && (
      <EditorSection title="Llamado a la acción (final)" sectionId="services-cta">
        <LabeledField label="Título" editorFieldKey="services-cta-title">
          <TextInput value={safe.ctaTitle} onChange={(v) => p({ ctaTitle: v })} />
        </LabeledField>
        <LabeledField label="Subtítulo" editorFieldKey="services-cta-subtitle">
          <TextArea value={safe.ctaSubtitle} onChange={(v) => p({ ctaSubtitle: v })} rows={2} />
        </LabeledField>
        <LabeledField label="Texto del botón" editorFieldKey="services-cta-button">
          <TextInput value={safe.ctaButton} onChange={(v) => p({ ctaButton: v })} />
        </LabeledField>
      </EditorSection>
      )}
    </div>
    </DndProvider>
  );
}

type ListingHero = SiteContent["rent"];

export function RentEditorForm({
  draft,
  onChange,
  activeSectionId,
}: {
  draft: ListingHero;
  onChange: (next: ListingHero) => void;
  activeSectionId: string | null;
}) {
  const safe = mergeSiteSection("rent", draft);
  const p = (patch: Partial<ListingHero>) => onChange(mergeSiteSection("rent", { ...draft, ...patch }));
  const s = (id: string) => pickSection(activeSectionId, id);
  return (
    <div className="space-y-6">
      {activeSectionId == null && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Elige un bloque en «Secciones de esta página» para editar sus textos aquí.
        </p>
      )}
      {s("rent-hero") && (
        <EditorSection title="Cabecera" sectionId="rent-hero">
          <ImageUploadField
            label="Imagen o vídeo de fondo"
            storagePage="rent"
            fieldKey="heroImage"
            editorPreviewFieldKey="rent-hero-bg"
            value={safe.heroImage}
            onChange={(v) => p({ heroImage: v })}
            allowVideo
            hint="Imagen o vídeo de cabecera; el listado de propiedades sigue viniendo del catálogo. El vídeo se reproduce en bucle y sin sonido."
          />
          <LabeledField label="Etiqueta superior (kicker)" editorFieldKey="rent-hero-kicker">
            <TextInput value={safe.heroKicker} onChange={(v) => p({ heroKicker: v })} />
          </LabeledField>
          <LabeledField label="Título" editorFieldKey="rent-hero-title">
            <TextInput value={safe.heroTitle} onChange={(v) => p({ heroTitle: v })} />
          </LabeledField>
          <LabeledField label="Subtítulo" editorFieldKey="rent-hero-subtitle">
            <TextArea value={safe.heroSubtitle} onChange={(v) => p({ heroSubtitle: v })} rows={2} />
          </LabeledField>
        </EditorSection>
      )}
    </div>
  );
}

export function SaleEditorForm({
  draft,
  onChange,
  activeSectionId,
}: {
  draft: SiteContent["sale"];
  onChange: (next: SiteContent["sale"]) => void;
  activeSectionId: string | null;
}) {
  const safe = mergeSiteSection("sale", draft);
  const p = (patch: Partial<SiteContent["sale"]>) => onChange(mergeSiteSection("sale", { ...draft, ...patch }));
  const s = (id: string) => pickSection(activeSectionId, id);
  return (
    <div className="space-y-6">
      {activeSectionId == null && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Elige un bloque en «Secciones de esta página» para editar sus textos aquí.
        </p>
      )}
      {s("sale-hero") && (
        <EditorSection title="Cabecera" sectionId="sale-hero">
          <ImageUploadField
            label="Imagen o vídeo de fondo"
            storagePage="sale"
            fieldKey="heroImage"
            editorPreviewFieldKey="sale-hero-bg"
            value={safe.heroImage}
            onChange={(v) => p({ heroImage: v })}
            allowVideo
            hint="Imagen o vídeo de cabecera; el listado de propiedades sigue viniendo del catálogo. El vídeo se reproduce en bucle y sin sonido."
          />
          <LabeledField label="Etiqueta superior (kicker)" editorFieldKey="sale-hero-kicker">
            <TextInput value={safe.heroKicker} onChange={(v) => p({ heroKicker: v })} />
          </LabeledField>
          <LabeledField label="Título" editorFieldKey="sale-hero-title">
            <TextInput value={safe.heroTitle} onChange={(v) => p({ heroTitle: v })} />
          </LabeledField>
          <LabeledField label="Subtítulo" editorFieldKey="sale-hero-subtitle">
            <TextArea value={safe.heroSubtitle} onChange={(v) => p({ heroSubtitle: v })} rows={2} />
          </LabeledField>
        </EditorSection>
      )}
    </div>
  );
}

type A = SiteContent["about"];
export function AboutEditorForm({
  draft,
  onChange,
  activeSectionId,
}: {
  draft: A;
  onChange: (next: A) => void;
  activeSectionId: string | null;
}) {
  const p = (patch: Partial<A>) => onChange({ ...draft, ...patch });
  const s = (id: string) => pickSection(activeSectionId, id);
  const aboutSafe = mergeSiteSection("about", draft);
  const addValue = () => {
    const i = aboutSafe.values.length;
    p({
      values: [
        ...aboutSafe.values,
        {
          title: `Nuevo valor ${i + 1}`,
          text: "",
          iconKey: SERVICE_ICON_KEYS[i % SERVICE_ICON_KEYS.length]!,
        },
      ],
    });
  };
  const removeValue = (index: number) => {
    if (aboutSafe.values.length <= 1) return;
    p({ values: aboutSafe.values.filter((_, i) => i !== index) });
  };
  const addStat = () => {
    p({
      stats: [...aboutSafe.stats, { value: "0+", label: "Nueva cifra" }],
    });
  };
  const removeStat = (index: number) => {
    if (aboutSafe.stats.length <= 1) return;
    p({ stats: aboutSafe.stats.filter((_, i) => i !== index) });
  };
  const addMilestone = () => {
    const lastYear = aboutSafe.milestones[aboutSafe.milestones.length - 1]?.year ?? "";
    const parsed = parseInt(lastYear, 10);
    const nextYear = Number.isFinite(parsed) ? String(parsed + 1) : new Date().getFullYear().toString();
    p({
      milestones: [
        ...aboutSafe.milestones,
        { year: nextYear, title: "Nuevo hito", description: "" },
      ],
    });
  };
  const removeMilestone = (index: number) => {
    if (aboutSafe.milestones.length <= 1) return;
    p({ milestones: aboutSafe.milestones.filter((_, i) => i !== index) });
  };
  const addMember = () => {
    p({
      team: [
        ...aboutSafe.team,
        { name: "Nuevo miembro", role: "Cargo", initials: "NM" },
      ],
    });
  };
  const removeMember = (index: number) => {
    if (aboutSafe.team.length <= 1) return;
    p({ team: aboutSafe.team.filter((_, i) => i !== index) });
  };
  return (
    <div className="space-y-6">
      {activeSectionId == null && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Elige un bloque en «Secciones de esta página» para editar sus textos aquí.
        </p>
      )}
      {s("about-hero") && (
      <EditorSection title="Cabecera" sectionId="about-hero">
        <ImageUploadField
          label="Imagen o vídeo de fondo"
          storagePage="about"
          fieldKey="aboutHeroImage"
          editorPreviewFieldKey="about-hero-bg"
          value={aboutSafe.heroImage}
          onChange={(v) => p({ heroImage: v })}
          allowVideo
          hint="Imagen o vídeo de cabecera (MP4, WebM, MOV). El vídeo se reproduce en bucle y sin sonido."
        />
        <LabeledField label="Etiqueta superior (kicker)" editorFieldKey="about-hero-kicker">
          <TextInput value={aboutSafe.heroKicker} onChange={(v) => p({ heroKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="about-hero-title">
          <TextInput value={aboutSafe.heroTitle} onChange={(v) => p({ heroTitle: v })} />
        </LabeledField>
        <LabeledField label="Subtítulo" hint="Se muestra bajo el título; no afecta la posición de las flechas." editorFieldKey="about-hero-subtitle">
          <TextArea value={aboutSafe.heroSubtitle} onChange={(v) => p({ heroSubtitle: v })} rows={2} />
        </LabeledField>
      </EditorSection>
      )}

      {s("about-story") && (
      <EditorSection title="Historia" sectionId="about-story">
        <LabeledField label="Etiqueta" editorFieldKey="about-story-kicker">
          <TextInput value={draft.storyKicker} onChange={(v) => p({ storyKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="about-story-title">
          <TextInput value={draft.storyTitle} onChange={(v) => p({ storyTitle: v })} />
        </LabeledField>
        <LabeledField label="Párrafo 1" editorFieldKey="about-story-p1">
          <TextArea value={draft.storyP1} onChange={(v) => p({ storyP1: v })} rows={4} />
        </LabeledField>
        <LabeledField label="Párrafo 2" editorFieldKey="about-story-p2">
          <TextArea value={draft.storyP2} onChange={(v) => p({ storyP2: v })} rows={4} />
        </LabeledField>
        <LabeledField label="Párrafo 3" editorFieldKey="about-story-p3">
          <TextArea value={draft.storyP3} onChange={(v) => p({ storyP3: v })} rows={4} />
        </LabeledField>
        <ImageUploadField
          label="Imagen"
          storagePage="about"
          fieldKey="storyImage"
          editorPreviewFieldKey="about-story-image"
          value={draft.storyImage}
          onChange={(v) => p({ storyImage: v })}
        />
      </EditorSection>
      )}

      {s("about-mission") && (
      <EditorSection title="Misión y visión" sectionId="about-mission">
        <LabeledField label="Misión — título" editorFieldKey="about-mission-missionTitle">
          <TextInput value={draft.missionTitle} onChange={(v) => p({ missionTitle: v })} />
        </LabeledField>
        <LabeledField label="Misión — texto" editorFieldKey="about-mission-missionText">
          <TextArea value={draft.missionText} onChange={(v) => p({ missionText: v })} rows={4} />
        </LabeledField>
        <LabeledField label="Visión — título" editorFieldKey="about-mission-visionTitle">
          <TextInput value={draft.visionTitle} onChange={(v) => p({ visionTitle: v })} />
        </LabeledField>
        <LabeledField label="Visión — texto" editorFieldKey="about-mission-visionText">
          <TextArea value={draft.visionText} onChange={(v) => p({ visionText: v })} rows={4} />
        </LabeledField>
      </EditorSection>
      )}

      {s("about-values") && (
      <EditorSection title="Valores" sectionId="about-values">
        <LabeledField label="Etiqueta pequeña" editorFieldKey="about-values-kicker">
          <TextInput value={draft.valuesKicker} onChange={(v) => p({ valuesKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="about-values-title">
          <TextInput value={draft.valuesTitle} onChange={(v) => p({ valuesTitle: v })} />
        </LabeledField>
        <LabeledField label="Introducción" editorFieldKey="about-values-intro">
          <TextArea value={draft.valuesIntro} onChange={(v) => p({ valuesIntro: v })} rows={2} />
        </LabeledField>
        {aboutSafe.values.map((val, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">Valor {i + 1}</p>
              <button
                type="button"
                disabled={aboutSafe.values.length <= 1}
                onClick={() => removeValue(i)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Eliminar
              </button>
            </div>
            <LabeledField label="Icono" editorFieldKey={`about-values-${i}-icon`}>
              <select
                value={val.iconKey}
                onChange={(e) => {
                  const iconKey = e.target.value as (typeof SERVICE_ICON_KEYS)[number];
                  const values = aboutSafe.values.map((x, j) => (j === i ? { ...x, iconKey } : x));
                  p({ values });
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {SERVICE_ICON_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {SERVICE_ICON_LABELS[k]}
                  </option>
                ))}
              </select>
            </LabeledField>
            <LabeledField label="Título" editorFieldKey={`about-values-${i}-title`}>
              <TextInput
                value={val.title}
                onChange={(v) => {
                  const values = aboutSafe.values.map((x, j) => (j === i ? { ...x, title: v } : x));
                  p({ values });
                }}
              />
            </LabeledField>
            <LabeledField label="Texto" editorFieldKey={`about-values-${i}-text`}>
              <TextArea
                value={val.text}
                onChange={(v) => {
                  const values = aboutSafe.values.map((x, j) => (j === i ? { ...x, text: v } : x));
                  p({ values });
                }}
                rows={2}
              />
            </LabeledField>
          </div>
        ))}
        <button
          type="button"
          onClick={addValue}
          className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/80 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:bg-white hover:text-primary"
        >
          Añadir valor
        </button>
      </EditorSection>
      )}

      {s("about-stats") && (
      <EditorSection title="Cifras" sectionId="about-stats">
        {aboutSafe.stats.map((st, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">Cifra {i + 1}</p>
              <button
                type="button"
                disabled={aboutSafe.stats.length <= 1}
                onClick={() => removeStat(i)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Eliminar
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledField label="Cifra" hint='Ej.: "15+", "1,200+", "$2M"' editorFieldKey={`about-stats-${i}-value`}>
                <TextInput
                  value={st.value}
                  onChange={(v) => {
                    const stats = aboutSafe.stats.map((x, j) => (j === i ? { ...x, value: v } : x));
                    p({ stats });
                  }}
                />
              </LabeledField>
              <LabeledField label="Etiqueta" editorFieldKey={`about-stats-${i}-label`}>
                <TextInput
                  value={st.label}
                  onChange={(v) => {
                    const stats = aboutSafe.stats.map((x, j) => (j === i ? { ...x, label: v } : x));
                    p({ stats });
                  }}
                />
              </LabeledField>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addStat}
          className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/80 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:bg-white hover:text-primary"
        >
          Añadir cifra
        </button>
      </EditorSection>
      )}

      {s("about-timeline") && (
      <EditorSection title="Línea de tiempo" sectionId="about-timeline">
        <LabeledField label="Etiqueta" editorFieldKey="about-timeline-kicker">
          <TextInput value={draft.timelineKicker} onChange={(v) => p({ timelineKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="about-timeline-title">
          <TextInput value={draft.timelineTitle} onChange={(v) => p({ timelineTitle: v })} />
        </LabeledField>
        <LabeledField label="Introducción" editorFieldKey="about-timeline-intro">
          <TextArea value={draft.timelineIntro} onChange={(v) => p({ timelineIntro: v })} rows={2} />
        </LabeledField>
        {aboutSafe.milestones.map((m, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">Hito {i + 1}</p>
              <button
                type="button"
                disabled={aboutSafe.milestones.length <= 1}
                onClick={() => removeMilestone(i)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Eliminar
              </button>
            </div>
            <LabeledField label="Año" editorFieldKey={`about-timeline-${i}-year`}>
              <TextInput
                value={m.year}
                onChange={(v) => {
                  const milestones = aboutSafe.milestones.map((x, j) => (j === i ? { ...x, year: v } : x));
                  p({ milestones });
                }}
              />
            </LabeledField>
            <LabeledField label="Título" editorFieldKey={`about-timeline-${i}-title`}>
              <TextInput
                value={m.title}
                onChange={(v) => {
                  const milestones = aboutSafe.milestones.map((x, j) => (j === i ? { ...x, title: v } : x));
                  p({ milestones });
                }}
              />
            </LabeledField>
            <LabeledField label="Descripción" editorFieldKey={`about-timeline-${i}-description`}>
              <TextArea
                value={m.description}
                onChange={(v) => {
                  const milestones = aboutSafe.milestones.map((x, j) => (j === i ? { ...x, description: v } : x));
                  p({ milestones });
                }}
                rows={3}
              />
            </LabeledField>
          </div>
        ))}
        <button
          type="button"
          onClick={addMilestone}
          className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/80 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:bg-white hover:text-primary"
        >
          Añadir hito
        </button>
      </EditorSection>
      )}

      {s("about-team") && (
      <EditorSection title="Equipo" sectionId="about-team">
        <LabeledField label="Etiqueta" editorFieldKey="about-team-kicker">
          <TextInput value={draft.teamKicker} onChange={(v) => p({ teamKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="about-team-title">
          <TextInput value={draft.teamTitle} onChange={(v) => p({ teamTitle: v })} />
        </LabeledField>
        <LabeledField label="Introducción" editorFieldKey="about-team-intro">
          <TextArea value={draft.teamIntro} onChange={(v) => p({ teamIntro: v })} rows={2} />
        </LabeledField>
        {aboutSafe.team.map((member, i) => (
          <div key={i} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">Persona {i + 1}</p>
              <button
                type="button"
                disabled={aboutSafe.team.length <= 1}
                onClick={() => removeMember(i)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Eliminar
              </button>
            </div>
            <LabeledField label="Nombre" editorFieldKey={`about-team-${i}-name`}>
              <TextInput
                value={member.name}
                onChange={(v) => {
                  const team = aboutSafe.team.map((x, j) => (j === i ? { ...x, name: v } : x));
                  p({ team });
                }}
              />
            </LabeledField>
            <LabeledField label="Cargo" editorFieldKey={`about-team-${i}-role`}>
              <TextInput
                value={member.role}
                onChange={(v) => {
                  const team = aboutSafe.team.map((x, j) => (j === i ? { ...x, role: v } : x));
                  p({ team });
                }}
              />
            </LabeledField>
            <LabeledField label="Iniciales (2 letras)" editorFieldKey={`about-team-${i}-initials`}>
              <TextInput
                value={member.initials}
                onChange={(v) => {
                  const team = aboutSafe.team.map((x, j) => (j === i ? { ...x, initials: v } : x));
                  p({ team });
                }}
              />
            </LabeledField>
            <ImageUploadField
              label="Foto (cuadrada)"
              storagePage="about"
              fieldKey={`team-${i}-photo`}
              editorPreviewFieldKey={`about-team-${i}-image`}
              value={member.image ?? ""}
              onChange={(v) => {
                const team = aboutSafe.team.map((x, j) =>
                  j === i ? { ...x, image: v.trim() || undefined } : x
                );
                p({ team });
              }}
              hint="Sube una imagen; se muestra en recorte cuadrado. Si está vacío, se usan las iniciales."
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addMember}
          className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/80 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:bg-white hover:text-primary"
        >
          Añadir miembro
        </button>
      </EditorSection>
      )}
    </div>
  );
}

type D = SiteContent["developments"];
export function DevelopmentsEditorForm({
  draft,
  onChange,
  activeSectionId,
}: {
  draft: D;
  onChange: (next: D) => void;
  activeSectionId: string | null;
}) {
  const p = (patch: Partial<D>) => onChange({ ...draft, ...patch });
  const s = (id: string) => pickSection(activeSectionId, id);
  const devSafe = mergeSiteSection("developments", draft);
  return (
    <div className="space-y-6">
      {activeSectionId == null && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Elige un bloque en «Secciones de esta página» para editar sus textos aquí.
        </p>
      )}
      {s("dev-hero") && (
      <EditorSection title="Cabecera de la página" sectionId="dev-hero">
        <ImageUploadField
          label="Imagen o vídeo de fondo"
          storagePage="developments"
          fieldKey="heroImage"
          editorPreviewFieldKey="dev-hero-bg"
          value={devSafe.heroImage}
          onChange={(v) => p({ heroImage: v })}
          allowVideo
          hint="Imagen o vídeo de cabecera; la lista de proyectos sigue viniendo del catálogo de desarrollos. El vídeo se reproduce en bucle y sin sonido."
        />
        <LabeledField label="Etiqueta superior (kicker)" editorFieldKey="dev-hero-kicker">
          <TextInput value={devSafe.heroKicker} onChange={(v) => p({ heroKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="dev-hero-title">
          <TextInput value={devSafe.heroTitle} onChange={(v) => p({ heroTitle: v })} />
        </LabeledField>
        <LabeledField label="Subtítulo" hint="Se muestra bajo el título; no afecta la posición de las flechas." editorFieldKey="dev-hero-subtitle">
          <TextArea value={devSafe.heroSubtitle} onChange={(v) => p({ heroSubtitle: v })} rows={3} />
        </LabeledField>
      </EditorSection>
      )}

      {s("dev-featured") && (
      <EditorSection title="Sección proyectos destacados (títulos)" sectionId="dev-featured">
        <LabeledField label="Etiqueta pequeña" editorFieldKey="dev-featured-kicker">
          <TextInput value={draft.featuredKicker} onChange={(v) => p({ featuredKicker: v })} />
        </LabeledField>
        <LabeledField label="Título" editorFieldKey="dev-featured-title">
          <TextInput value={draft.featuredTitle} onChange={(v) => p({ featuredTitle: v })} />
        </LabeledField>
      </EditorSection>
      )}

      {s("dev-cta") && (
      <EditorSection title="Llamado a la acción" sectionId="dev-cta">
        <LabeledField label="Título" editorFieldKey="dev-cta-title">
          <TextInput value={draft.ctaTitle} onChange={(v) => p({ ctaTitle: v })} />
        </LabeledField>
        <LabeledField label="Descripción" editorFieldKey="dev-cta-subtitle">
          <TextArea value={draft.ctaSubtitle} onChange={(v) => p({ ctaSubtitle: v })} rows={3} />
        </LabeledField>
        <LabeledField label="Botón principal" editorFieldKey="dev-cta-primary">
          <TextInput value={draft.ctaPrimaryLabel} onChange={(v) => p({ ctaPrimaryLabel: v })} />
        </LabeledField>
        <LabeledField label="Botón secundario" editorFieldKey="dev-cta-secondary">
          <TextInput value={draft.ctaSecondaryLabel} onChange={(v) => p({ ctaSecondaryLabel: v })} />
        </LabeledField>
        <LabeledField label="Teléfono del botón «Llamar ahora»" editorFieldKey="dev-cta-phone">
          <TextInput value={draft.ctaPhone} onChange={(v) => p({ ctaPhone: v })} />
        </LabeledField>
        <p className="text-xs text-slate-500">
          El botón principal siempre lleva a /contacto. El teléfono se usa tal cual en el enlace de
          llamada: escríbelo con lada internacional, por ejemplo +523314457122.
        </p>
      </EditorSection>
      )}
    </div>
  );
}

type He = SiteContent["header"];
export function HeaderEditorForm({
  draft,
  onChange,
  activeSectionId,
}: {
  draft: He;
  onChange: (next: He) => void;
  activeSectionId: string | null;
}) {
  const p = (patch: Partial<He>) => onChange(mergeSiteSection("header", { ...draft, ...patch }));
  const safe = mergeSiteSection("header", draft);
  const s = (id: string) => pickSection(activeSectionId, id);

  const updateLink = (index: number, patch: Partial<He["navSocial"][number]>) => {
    const navSocial = safe.navSocial.map((row, i) => (i === index ? { ...row, ...patch } : row));
    p({ navSocial });
  };

  const removeLink = (index: number) => {
    p({ navSocial: safe.navSocial.filter((_, i) => i !== index) });
  };

  const addLink = () => {
    const used = new Set(safe.navSocial.map((r) => r.id));
    const next = HEADER_SOCIAL_PLATFORM_OPTIONS.find((o) => !used.has(o.id));
    if (!next) return;
    p({
      navSocial: [...safe.navSocial, { id: next.id, label: next.label, href: "" }],
    });
  };

  const canAdd = HEADER_SOCIAL_PLATFORM_OPTIONS.some((o) => !safe.navSocial.some((r) => r.id === o.id));

  return (
    <div className="space-y-6">
      {activeSectionId == null && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Elige un bloque en «Secciones de esta página» para editar sus textos aquí.
        </p>
      )}
      {s("header-social") && (
        <EditorSection title="Redes del encabezado" sectionId="header-social">
          <p className="mb-4 text-xs text-slate-600">
            Añade o quita redes con los botones. Solo se muestran en la web las que tengan URL (https://…). Puedes dejar la
            lista vacía y añadir solo las que uses.
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addLink}
              disabled={!canAdd}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Añadir red
            </button>
            {!canAdd ? (
              <span className="text-xs text-slate-500">Ya están todas las plataformas disponibles.</span>
            ) : null}
          </div>
          {safe.navSocial.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No hay enlaces en el encabezado. Pulsa «Añadir red» para empezar.
            </p>
          ) : null}
          {safe.navSocial.map((link, i) => (
            <div key={`${link.id}-${i}`} className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3 last:mb-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-600">Red {i + 1}</p>
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Quitar de la lista
                </button>
              </div>
              <LabeledField label="Plataforma" editorFieldKey={`header-social-${i}-platform`}>
                <select
                  value={link.id}
                  onChange={(e) => {
                    const newId = e.target.value as HeaderSocialIconId;
                    const opt = HEADER_SOCIAL_PLATFORM_OPTIONS.find((o) => o.id === newId);
                    updateLink(i, { id: newId, label: opt?.label ?? newId });
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy/25"
                >
                  {HEADER_SOCIAL_PLATFORM_OPTIONS.filter((o) => {
                    const takenByOther = safe.navSocial.some((r, j) => j !== i && r.id === o.id);
                    return !takenByOther || o.id === link.id;
                  }).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </LabeledField>
              <LabeledField label="Etiqueta (accesibilidad)" editorFieldKey={`header-social-${i}-label`}>
                <TextInput value={link.label} onChange={(v) => updateLink(i, { label: v })} />
              </LabeledField>
              <LabeledField
                label="URL"
                hint="Ej.: https://instagram.com/tu_cuenta. Vacío: no se muestra el icono en la barra."
                editorFieldKey={`header-social-${i}-href`}
              >
                <TextInput
                  value={link.href === "#" ? "" : link.href}
                  onChange={(v) => updateLink(i, { href: v.trim() })}
                />
              </LabeledField>
            </div>
          ))}
        </EditorSection>
      )}
    </div>
  );
}

type F = SiteContent["footer"];

function FooterQuickLinksEditor({
  links,
  onChange,
}: {
  links: FooterNavLink[];
  onChange: (next: FooterNavLink[]) => void;
}) {
  const update = (index: number, patch: Partial<FooterNavLink>) => {
    onChange(links.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  const remove = (index: number) => onChange(links.filter((_, i) => i !== index));
  const add = () => onChange([...links, { label: "Inicio", href: "/" }]);

  const setRoute = (index: number, routeValue: string) => {
    const link = links[index];
    if (!link) return;
    if (routeValue === FOOTER_QUICK_LINK_CUSTOM) {
      update(index, { href: link.href.startsWith("/") ? "https://" : link.href });
      return;
    }
    const opt = FOOTER_INTERNAL_LINK_OPTIONS.find((o) => o.href === routeValue);
    update(index, {
      href: routeValue,
      label: link.label.trim() || opt?.suggestedLabel || link.label,
    });
  };

  return (
    <EditorSection title="Lista de enlaces" sectionId="footer-quick">
      <p className="mb-3 text-xs text-slate-500">
        Elige una página del sitio o un enlace personalizado (URL externa). El texto es el que verá el visitante en el
        pie.
      </p>
      {links.map((link, i) => {
        const routeValue = footerQuickLinkSelectValue(link.href);
        const isCustom = routeValue === FOOTER_QUICK_LINK_CUSTOM;
        return (
          <div key={i} className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 last:mb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-600">Enlace {i + 1}</p>
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Eliminar
              </button>
            </div>
            <LabeledField label="Texto en el pie" editorFieldKey={`footer-quick-${i}-label`}>
              <TextInput value={link.label} onChange={(v) => update(i, { label: v })} />
            </LabeledField>
            <LabeledField label="Página del sitio" editorFieldKey={`footer-quick-${i}-route`}>
              <select
                value={routeValue}
                onChange={(e) => setRoute(i, e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {FOOTER_INTERNAL_LINK_OPTIONS.map((o) => (
                  <option key={o.href} value={o.href}>
                    {o.suggestedLabel} ({o.href})
                  </option>
                ))}
                <option value={FOOTER_QUICK_LINK_CUSTOM}>Enlace personalizado (URL externa)…</option>
              </select>
            </LabeledField>
            {isCustom ? (
              <LabeledField
                label="URL del enlace"
                hint="https://…, mailto:… o tel:…"
                editorFieldKey={`footer-quick-${i}-href`}
              >
                <TextInput value={link.href} onChange={(v) => update(i, { href: v })} />
              </LabeledField>
            ) : (
              <p className="text-xs text-slate-500">
                Destino: <span className="font-mono text-slate-700">{link.href}</span>
              </p>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={add}
        className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/80 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:bg-white hover:text-primary"
      >
        Añadir enlace
      </button>
    </EditorSection>
  );
}

export function FooterEditorForm({
  draft,
  onChange,
  activeSectionId,
  serviceCards,
}: {
  draft: F;
  onChange: (next: F) => void;
  activeSectionId: string | null;
  /** Tarjetas de Sitio web → Servicios (lista automática del pie). */
  serviceCards: ServiceCardContent[];
}) {
  const safe = mergeSiteSection("footer", draft);
  const p = (patch: Partial<F>) => onChange(mergeSiteSection("footer", { ...draft, ...patch }));
  const s = (id: string) => pickSection(activeSectionId, id);
  const autoServiceLinks = footerServiceLinksFromCards(serviceCards);

  const updateContactItem = (index: number, patch: Partial<F["contactItems"][number]>) => {
    const contactItems = safe.contactItems.map((row, i) => (i === index ? { ...row, ...patch } : row));
    p({ contactItems });
  };
  const addContactItem = () => {
    p({ contactItems: [...safe.contactItems, { icon: "message", body: "" }] });
  };
  const removeContactItem = (index: number) => {
    p({ contactItems: safe.contactItems.filter((_, i) => i !== index) });
  };
  const updateSocialLink = (index: number, patch: Partial<F["socialLinks"][number]>) => {
    const socialLinks = safe.socialLinks.map((row, i) => (i === index ? { ...row, ...patch } : row));
    p({ socialLinks });
  };
  const addSocialLink = () => {
    p({ socialLinks: [...safe.socialLinks, { platform: "instagram", url: "" }] });
  };
  const removeSocialLink = (index: number) => {
    p({ socialLinks: safe.socialLinks.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      {activeSectionId == null && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Elige un bloque en «Secciones de esta página» para editar el pie de página.
        </p>
      )}

      {s("footer-brand") && (
        <EditorSection title="Marca e introducción" sectionId="footer-brand">
          <LabeledField label="Nombre (marca)" editorFieldKey="footer-brand-title">
            <TextInput value={safe.brandTitle} onChange={(v) => p({ brandTitle: v })} />
          </LabeledField>
          <LabeledField label="Subtítulo" editorFieldKey="footer-brand-subtitle">
            <TextInput value={safe.brandSubtitle} onChange={(v) => p({ brandSubtitle: v })} />
          </LabeledField>
          <LabeledField label="Descripción" editorFieldKey="footer-brand-description">
            <TextArea value={safe.brandDescription} onChange={(v) => p({ brandDescription: v })} rows={3} />
          </LabeledField>
        </EditorSection>
      )}

      {s("footer-quick") && (
        <>
          <EditorSection title="Enlaces rápidos" sectionId="footer-quick">
            <LabeledField label="Título de columna" editorFieldKey="footer-quick-title">
              <TextInput value={safe.quickLinksTitle} onChange={(v) => p({ quickLinksTitle: v })} />
            </LabeledField>
          </EditorSection>
          <FooterQuickLinksEditor links={safe.quickLinks} onChange={(quickLinks) => p({ quickLinks })} />
        </>
      )}

      {s("footer-services") && (
        <EditorSection title="Servicios (automático)" sectionId="footer-services">
          <LabeledField label="Título de columna" editorFieldKey="footer-services-title">
            <TextInput value={safe.servicesTitle} onChange={(v) => p({ servicesTitle: v })} />
          </LabeledField>
          <p className="text-xs text-slate-600">
            Los enlaces de esta columna se generan solos desde{" "}
            <strong className="font-medium text-slate-800">Sitio web → Servicios</strong> (cada tarjeta del grafo). Al
            guardar o editar allí, el pie se actualiza sin volver a escribir la lista aquí.
          </p>
          {autoServiceLinks.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No hay tarjetas con enlace válido. Revisa la pestaña Servicios.
            </p>
          ) : (
            <ul className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
              {autoServiceLinks.map((link, i) => (
                <li key={`${link.href}-${i}`} className="flex flex-wrap gap-x-2">
                  <span className="font-medium text-slate-900">{link.label}</span>
                  <span className="font-mono text-xs text-slate-500">{link.href}</span>
                </li>
              ))}
            </ul>
          )}
        </EditorSection>
      )}

      {s("footer-contact") && (
        <EditorSection title="Contacto" sectionId="footer-contact">
          <LabeledField label="Título de columna" editorFieldKey="footer-contact-title">
            <TextInput value={safe.contactTitle} onChange={(v) => p({ contactTitle: v })} />
          </LabeledField>
          <p className="text-xs text-slate-500">
            Teléfono y correo generan enlaces automáticos. La dirección y otros textos se muestran tal cual.
          </p>
          {safe.contactItems.map((item, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-500">Contacto {i + 1}</p>
                <button
                  type="button"
                  onClick={() => removeContactItem(i)}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Eliminar
                </button>
              </div>
              <LabeledField label="Icono" editorFieldKey={`footer-contact-${i}-icon`}>
                <select
                  value={item.icon}
                  onChange={(e) => updateContactItem(i, { icon: e.target.value as ContactInfoIcon })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {CONTACT_ICON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </LabeledField>
              <LabeledField
                label="Texto visible"
                hint="Pulsa Enter para varias líneas."
                editorFieldKey={`footer-contact-${i}-body`}
              >
                <TextArea value={item.body} onChange={(v) => updateContactItem(i, { body: v })} rows={3} />
              </LabeledField>
            </div>
          ))}
          <button
            type="button"
            onClick={addContactItem}
            className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/80 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:bg-white hover:text-primary"
          >
            Añadir contacto
          </button>
          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="mb-3 text-sm font-medium text-slate-800">Redes sociales</p>
            <p className="mb-4 text-xs text-slate-500">
              Iconos bajo la dirección y teléfono. Solo se muestran las que tengan URL (https://…).
            </p>
            {safe.socialLinks.map((link, i) => (
              <div key={i} className="mb-4 space-y-3 rounded-lg border border-slate-200 p-4 last:mb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-500">Red {i + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeSocialLink(i)}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Eliminar
                  </button>
                </div>
                <LabeledField label="Plataforma" editorFieldKey={`footer-social-${i}-platform`}>
                  <select
                    value={link.platform}
                    onChange={(e) => updateSocialLink(i, { platform: e.target.value as ContactSocialPlatform })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {CONTACT_SOCIAL_PLATFORM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </LabeledField>
                <LabeledField label="URL" hint="Ej.: https://instagram.com/tu_cuenta" editorFieldKey={`footer-social-${i}-url`}>
                  <TextInput value={link.url} onChange={(v) => updateSocialLink(i, { url: v })} />
                </LabeledField>
              </div>
            ))}
            <button
              type="button"
              onClick={addSocialLink}
              className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/80 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:bg-white hover:text-primary"
            >
              Añadir red social
            </button>
          </div>
        </EditorSection>
      )}

      {s("footer-legal") && (
        <EditorSection title="Copyright" sectionId="footer-legal">
          <LabeledField
            label="Línea de copyright"
            hint="Usa {year} para el año actual automático."
            editorFieldKey="footer-legal-copyright"
          >
            <TextInput value={safe.copyrightLine} onChange={(v) => p({ copyrightLine: v })} />
          </LabeledField>
        </EditorSection>
      )}
    </div>
  );
}
