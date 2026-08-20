import { useMemo } from "react";
import { Link } from "react-router";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Building2,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useSiteContent } from "../../contexts/SiteContentContext";
import { useLocale } from "../i18n/LocaleContext";
import { localizeInternalHref } from "../i18n/locale";
import { CONTACT_SOCIAL_LABELS, type ContactInfoIcon, type FooterNavLink } from "../../data/siteContent";
import { footerServiceLinksFromCards } from "../../lib/footerSiteLinks";
import { mergeSiteSection } from "../../lib/siteContentMerge";
import { ContactSocialGlyph } from "./ContactSocialGlyph";
import { WhatsAppGlyph } from "./WhatsAppGlyph";
import { usePreviewCanvas, usePreviewLayout } from "../../contexts/PreviewCanvasContext";
import { PreviewSectionChrome } from "./admin/siteEditor/PreviewSectionChrome";
import { PreviewFieldPulse } from "./admin/siteEditor/PreviewFieldPulse";
import { cn } from "./ui/utils";

const CONTACT_ICONS: Record<ContactInfoIcon, LucideIcon> = {
  map: MapPin,
  phone: Phone,
  mail: Mail,
  clock: Clock,
  building: Building2,
  message: MessageCircle,
};

function firstLine(text: string) {
  return text.split("\n")[0]?.trim() ?? "";
}

function telHref(phoneLines: string) {
  const digits = firstLine(phoneLines).replace(/\D/g, "");
  return digits ? `tel:${digits}` : "#";
}

function whatsappHref(phoneLines: string) {
  const digits = firstLine(phoneLines).replace(/\D/g, "");
  if (!digits) return "#";
  const formattedDigits = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${formattedDigits}`;
}

/** Formatea un teléfono MX de 10 dígitos como "(33) 3629-7122"; deja intacto cualquier otro formato. */
function formatPhoneLine(line: string): string {
  const digits = line.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return line;
}

function formatPhoneDisplay(phoneLines: string): string {
  return phoneLines
    .split("\n")
    .map((line) => formatPhoneLine(line.trim()))
    .join("\n");
}

function mailHref(emailLines: string) {
  const line = firstLine(emailLines);
  if (!line) return "#";
  return line.includes("@") ? `mailto:${line}` : "#";
}

export const VITERRA_GOOGLE_MAPS_URL =
  "https://www.google.com/maps/place/Viterra+Grupo+Inmobiliario/@20.6972686,-103.3891484,17z/data=!3m1!4b1!4m6!3m5!1s0x8428ae461eb017bb:0x78bc52b4e33f1f28!8m2!3d20.6972636!4d-103.3865735!16s%2Fg%2F1vzg2k9l?entry=ttu&g_ep=EgoyMDI2MDgxMC4wIKXMDSoASAFQAw%3D%3D";

function mapsHref(addressLines: string) {
  const query = addressLines.replace(/\n+/g, ", ").trim();
  if (!query) return "#";
  return VITERRA_GOOGLE_MAPS_URL;
}

function normalizeExternalHref(raw: string): string {
  const t = raw.trim();
  if (!t || t === "#") return t || "#";
  if (/^https?:\/\//i.test(t) || t.startsWith("/") || t.startsWith("#") || t.startsWith("mailto:") || t.startsWith("tel:"))
    return t;
  return `https://${t}`;
}

function resolveFooterCopyright(line: string) {
  const year = String(new Date().getFullYear());
  if (line.includes("{year}")) return line.replace(/\{year\}/g, year);
  return line;
}

function FooterNavItem({ link }: { link: FooterNavLink }) {
  const { locale } = useLocale();
  const href = link.href.trim() || "#";
  const className =
    "hover:text-white hover:translate-x-1 transition-all duration-200 inline-block";
  const style = { fontWeight: 400 } as const;

  if (href.startsWith("/")) {
    return (
      <Link to={localizeInternalHref(href, locale)} className={className} style={style}>
        {link.label}
      </Link>
    );
  }

  return (
    <a href={normalizeExternalHref(href)} className={className} style={style}>
      {link.label}
    </a>
  );
}

function FooterContactRow({
  icon,
  body,
  fieldKey,
}: {
  icon: ContactInfoIcon;
  body: string;
  fieldKey: string;
}) {
  const Icon = CONTACT_ICONS[icon] ?? MessageCircle;
  const display = body.trim();
  if (!display) return null;

  const isPhone = icon === "phone";
  const isMail = icon === "mail";
  const isMap = icon === "map";

  const iconElement = isPhone ? (
    <WhatsAppGlyph className="w-5 h-5 text-[#25D366] flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110" />
  ) : isMap ? (
    <MapPin className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110" strokeWidth={1.75} />
  ) : isMail ? (
    <Mail className="w-5 h-5 text-[#3B82F6] flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110" strokeWidth={1.75} />
  ) : (
    <Icon className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110" strokeWidth={1.75} />
  );

  const inner = (
    <span
      className="group-hover:text-white transition-colors whitespace-pre-line leading-relaxed"
      style={{ fontWeight: 400, letterSpacing: isPhone ? "0.03em" : undefined }}
    >
      {isPhone ? formatPhoneDisplay(display) : display}
    </span>
  );

  return (
    <li className={cn("flex gap-3 group", isPhone ? "items-center" : "items-start")}>
      {iconElement}
      <PreviewFieldPulse blockId="footer-contact" fieldKey={fieldKey}>
        {isPhone ? (
          <a
            href={whatsappHref(body)}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            {inner}
          </a>
        ) : isMail ? (
          <a href={mailHref(body)} className="hover:text-white transition-colors">
            {inner}
          </a>
        ) : isMap ? (
          <a
            href={mapsHref(body)}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            {inner}
          </a>
        ) : (
          inner
        )}
      </PreviewFieldPulse>
    </li>
  );
}

export function Footer() {
  const reduceMotion = useReducedMotion();
  const inPreview = usePreviewCanvas();
  const pl = usePreviewLayout();
  const { content } = useSiteContent();
  const f = mergeSiteSection("footer", content.footer);
  const services = mergeSiteSection("services", content.services);
  const serviceLinks = useMemo(
    () => footerServiceLinksFromCards(services.cards),
    [services.cards]
  );

  return (
    <motion.footer
      initial={inPreview || reduceMotion ? false : { opacity: 0, y: 28 }}
      whileInView={inPreview || reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -32px 0px" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="bg-brand-navy pb-[env(safe-area-inset-bottom,0px)] text-slate-300"
    >
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className={cn("grid gap-12", pl.gridCols("grid-cols-1 md:grid-cols-2 lg:grid-cols-4"))}>
          <PreviewSectionChrome blockId="footer-brand" label="Marca" hideLabel hideStripe surface="dark">
            <div>
              <div className="inline-flex flex-col items-stretch self-start min-w-[11rem] mb-6">
                <PreviewFieldPulse blockId="footer-brand" fieldKey="footer-brand-title">
                  <h3 className="font-semibold text-lg text-white tracking-tight" style={{ fontWeight: 600 }}>
                    {f.brandTitle}
                  </h3>
                </PreviewFieldPulse>
                <span className="h-px w-full bg-primary shrink-0 my-2.5" aria-hidden />
                <PreviewFieldPulse blockId="footer-brand" fieldKey="footer-brand-subtitle">
                  <p
                    className="text-xs text-primary uppercase tracking-widest font-medium"
                    style={{ letterSpacing: "0.12em" }}
                  >
                    {f.brandSubtitle}
                  </p>
                </PreviewFieldPulse>
              </div>
              <PreviewFieldPulse blockId="footer-brand" fieldKey="footer-brand-description">
                <p className="text-sm leading-relaxed not-italic" style={{ fontWeight: 400 }}>
                  {f.brandDescription}
                </p>
              </PreviewFieldPulse>
            </div>
          </PreviewSectionChrome>

          <PreviewSectionChrome blockId="footer-quick" label="Enlaces rápidos" hideLabel hideStripe surface="dark">
            <div>
              <PreviewFieldPulse blockId="footer-quick" fieldKey="footer-quick-title">
                <h4 className="text-[10px] uppercase tracking-[0.28em] text-white/90 mb-6 font-heading font-medium">
                  {f.quickLinksTitle}
                </h4>
              </PreviewFieldPulse>
              <ul className="space-y-3 text-sm">
                {f.quickLinks.map((link, i) => (
                  <li key={`quick-${i}-${link.label}`}>
                    <PreviewFieldPulse blockId="footer-quick" fieldKey={`footer-quick-${i}-label`} layout="inline">
                      <FooterNavItem link={link} />
                    </PreviewFieldPulse>
                  </li>
                ))}
              </ul>
            </div>
          </PreviewSectionChrome>

          <PreviewSectionChrome blockId="footer-services" label="Servicios" hideLabel hideStripe surface="dark">
            <div>
              <PreviewFieldPulse blockId="footer-services" fieldKey="footer-services-title">
                <h4 className="text-[10px] uppercase tracking-[0.28em] text-white/90 mb-6 font-heading font-medium">
                  {f.servicesTitle}
                </h4>
              </PreviewFieldPulse>
              <ul className="space-y-3 text-sm">
                {serviceLinks.map((link, i) => (
                  <li key={`svc-${i}-${link.href}-${link.label}`}>
                    <FooterNavItem link={link} />
                  </li>
                ))}
              </ul>
            </div>
          </PreviewSectionChrome>

          <PreviewSectionChrome blockId="footer-contact" label="Contacto" hideLabel hideStripe surface="dark">
            <div>
              <PreviewFieldPulse blockId="footer-contact" fieldKey="footer-contact-title">
                <h4 className="text-[10px] uppercase tracking-[0.28em] text-white/90 mb-6 font-heading font-medium">
                  {f.contactTitle}
                </h4>
              </PreviewFieldPulse>
              <ul className="space-y-4 text-sm">
                {f.contactItems.map((item, i) => (
                  <FooterContactRow
                    key={`contact-${i}-${item.icon}`}
                    icon={item.icon}
                    body={item.body}
                    fieldKey={`footer-contact-${i}-body`}
                  />
                ))}
              </ul>
              {f.socialLinks.some((item) => item.url.trim()) ? (
                <ul
                  className="mt-6 flex flex-wrap items-center gap-2"
                  role="list"
                  aria-label="Redes sociales"
                >
                  {f.socialLinks.map((item, i) => {
                    if (!item.url.trim()) return null;
                    const href = normalizeExternalHref(item.url);
                    const label = CONTACT_SOCIAL_LABELS[item.platform];
                    const isInternal = href.startsWith("/") && !href.startsWith("//");
                    const isHttp = /^https?:\/\//i.test(href);
                    const ringClass =
                      "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/90 transition-colors hover:border-primary hover:bg-white/[0.06] hover:text-white";
                    return (
                      <li key={`${item.platform}-${i}`}>
                        <PreviewFieldPulse
                          blockId="footer-contact"
                          fieldKey={`footer-social-${i}-url`}
                          layout="inline"
                          className="inline-flex"
                        >
                          {isInternal ? (
                            <Link to={href} aria-label={label} title={label} className={ringClass}>
                              <ContactSocialGlyph platform={item.platform} className="h-4 w-4" />
                            </Link>
                          ) : (
                            <a
                              href={href}
                              target={isHttp ? "_blank" : undefined}
                              rel={isHttp ? "noopener noreferrer" : undefined}
                              aria-label={label}
                              title={label}
                              className={ringClass}
                            >
                              <ContactSocialGlyph platform={item.platform} className="h-4 w-4" />
                            </a>
                          )}
                        </PreviewFieldPulse>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </PreviewSectionChrome>
        </div>

        <PreviewSectionChrome blockId="footer-legal" label="Copyright" hideLabel hideStripe surface="dark">
          <div className="border-t border-white/10 mt-12 pt-8 text-sm text-center">
            <PreviewFieldPulse blockId="footer-legal" fieldKey="footer-legal-copyright">
              <p className="text-slate-400 not-italic" style={{ fontWeight: 400 }}>
                {resolveFooterCopyright(f.copyrightLine)}
              </p>
            </PreviewFieldPulse>
          </div>
        </PreviewSectionChrome>
      </div>
    </motion.footer>
  );
}
