import type { ReactNode } from "react";
import { LocaleLink as Link } from "../LocaleLink";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Building2,
  MessageCircle,
} from "lucide-react";
import type { ContactInfoIcon, ServiceDetailBlock } from "@/data/siteContent";
import { serviceIconForKey } from "@/lib/serviceIcons";
import { embeddableVideoSrc } from "../../lib/embeddableVideo";
import { IFRAME_SANDBOX_ATTR } from "../../lib/safeEmbed";
import { cn } from "../ui/utils";
import { PreviewFieldPulse } from "../admin/siteEditor/PreviewFieldPulse";

const CONTACT_ICON_COMPONENT: Record<ContactInfoIcon, typeof MapPin> = {
  map: MapPin,
  phone: Phone,
  mail: Mail,
  clock: Clock,
  building: Building2,
  message: MessageCircle,
};

function normalizeExternalHref(raw: string): string {
  const t = raw.trim();
  if (!t || t === "#") return t || "#";
  if (/^https?:\/\//i.test(t) || t.startsWith("/") || t.startsWith("#") || t.startsWith("mailto:") || t.startsWith("tel:"))
    return t;
  return `https://${t}`;
}

/** Misma lógica que el panel de servicios: solo dígitos y un `+` inicial → `tel:…`. */
function telHrefFromNumberLikeInput(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^tel:/i.test(t)) return normalizeExternalHref(t);
  let out = "";
  for (let i = 0; i < t.length; i += 1) {
    const ch = t[i]!;
    if (ch === "+" && out === "") out += "+";
    else if (/\d/.test(ch)) out += ch;
  }
  if (!out || out === "+") return null;
  return `tel:${out}`;
}

function blockShell(children: ReactNode, className?: string) {
  return <div className={cn("relative", className)}>{children}</div>;
}

export function ServiceDetailBlockRenderer({
  block,
  disableInteractive,
}: {
  block: ServiceDetailBlock;
  /** En vista previa del admin: los CTA no navegan. */
  disableInteractive?: boolean;
}) {
  switch (block.type) {
    case "heading":
      return blockShell(
        <div className="space-y-1">
          <div className="h-1 w-12 rounded-full bg-gradient-to-r from-primary to-primary/40" aria-hidden />
          <h2 className="font-heading text-balance text-2xl font-light tracking-tight text-brand-navy md:text-3xl lg:text-[2rem]">
            {block.text}
          </h2>
        </div>,
      );
    case "subheading":
      return blockShell(
        <h3 className="font-heading text-balance text-lg font-medium tracking-tight text-brand-navy/95 md:text-xl">
          {block.text}
        </h3>,
      );
    case "paragraph":
      return blockShell(
        <p className="font-heading max-w-prose whitespace-pre-wrap text-pretty text-base font-light leading-[1.75] text-brand-navy/78 md:text-lg">
          {block.text}
        </p>,
      );
    case "contactParagraph": {
      const telHref = telHrefFromNumberLikeInput(block.phone);
      const emailRaw = block.email.trim().replace(/^mailto:/i, "");
      const hasMail = Boolean(emailRaw.includes("@"));
      const mailHref = hasMail ? normalizeExternalHref(`mailto:${emailRaw}`) : null;
      const hasText = Boolean(block.text?.trim());
      const phoneLabel = block.phone.trim();
      const hasPhone = Boolean(telHref && phoneLabel);
      if (!hasText && !hasPhone && !hasMail) return null;
      const contactLinkClass =
        "font-heading inline-flex min-w-0 items-center gap-2.5 text-sm font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:text-brand-burgundy hover:decoration-brand-burgundy/50 md:text-base";
      const contactStaticClass =
        "font-heading inline-flex min-w-0 items-center gap-2.5 text-sm font-medium text-brand-navy/85 md:text-base";
      return blockShell(
        <div className="rounded-2xl border border-brand-navy/[0.08] bg-gradient-to-br from-white to-brand-canvas/50 px-6 py-6 shadow-sm ring-1 ring-black/[0.02] md:px-7 md:py-7">
          {hasText ? (
            <p className="font-heading max-w-prose whitespace-pre-wrap text-pretty text-base font-light leading-[1.75] text-brand-navy/78 md:text-lg">
              {block.text}
            </p>
          ) : null}
          {(hasPhone || hasMail) && (
            <div
              className={cn(
                "flex flex-wrap gap-x-10 gap-y-4",
                hasText && "mt-6 border-t border-brand-navy/10 pt-6",
              )}
            >
              {hasPhone ? (
                disableInteractive ? (
                  <span className={contactStaticClass} title="Vista previa: enlace no activo">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/12">
                      <Phone className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                    </span>
                    <span className="min-w-0 break-words">{phoneLabel}</span>
                  </span>
                ) : (
                  <a href={telHref!} className={contactLinkClass}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/12">
                      <Phone className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                    </span>
                    <span className="min-w-0 break-words">{phoneLabel}</span>
                  </a>
                )
              ) : null}
              {hasMail ? (
                disableInteractive ? (
                  <span className={contactStaticClass} title="Vista previa: enlace no activo">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/12">
                      <Mail className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                    </span>
                    <span className="min-w-0 break-all">{emailRaw}</span>
                  </span>
                ) : (
                  <a href={mailHref!} className={contactLinkClass}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/12">
                      <Mail className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                    </span>
                    <span className="min-w-0 break-all">{emailRaw}</span>
                  </a>
                )
              ) : null}
            </div>
          )}
        </div>,
      );
    }
    case "quote":
      if (!block.text?.trim()) return null;
      return blockShell(
        <blockquote className="relative overflow-hidden rounded-2xl border border-brand-navy/[0.08] bg-gradient-to-br from-white via-brand-canvas/90 to-primary/[0.04] px-6 py-7 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.2)] md:px-8 md:py-8">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/[0.06] blur-2xl" aria-hidden />
          <p className="font-heading relative text-pretty text-lg font-light italic leading-relaxed text-brand-navy/88 md:text-xl">
            {block.text}
          </p>
          {block.attribution?.trim() ? (
            <footer className="relative mt-5 border-t border-brand-navy/10 pt-4 text-sm font-medium tracking-wide text-primary/90">
              {block.attribution}
            </footer>
          ) : null}
        </blockquote>,
      );
    case "callout":
      if (!block.text?.trim()) return null;
      return blockShell(
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] to-transparent px-6 py-5 shadow-sm ring-1 ring-primary/10 md:px-7 md:py-6">
          <p className="font-heading whitespace-pre-wrap text-pretty text-base font-light leading-relaxed text-brand-navy/86 md:text-lg">
            {block.text}
          </p>
        </div>,
      );
    case "bulletList": {
      const items = (block.items ?? []).filter((it) => it.trim());
      if (!items.length) return null;
      return blockShell(
        <ul className="grid gap-0 overflow-hidden rounded-2xl border border-brand-navy/[0.08] bg-white/80 shadow-sm ring-1 ring-black/[0.02]">
          {items.map((it, i) => (
            <li
              key={`${i}-${it.slice(0, 24)}`}
              className="flex gap-4 border-b border-brand-navy/[0.06] px-5 py-4 last:border-b-0 md:px-6 md:py-5"
            >
              <span
                className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary"
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="font-heading min-w-0 text-pretty text-base font-light leading-relaxed text-brand-navy/82 md:text-[1.05rem]">
                {it}
              </span>
            </li>
          ))}
        </ul>,
      );
    }
    case "image":
      if (!block.src?.trim()) return null;
      return blockShell(
        <figure className="overflow-hidden rounded-2xl border border-brand-navy/10 bg-brand-navy/[0.03] shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.04]">
          <img src={block.src} alt={block.alt || ""} className="h-auto w-full object-cover" loading="lazy" />
        </figure>,
      );
    case "twoColumn":
      return blockShell(
        <div className="grid gap-8 rounded-2xl border border-brand-navy/[0.07] bg-gradient-to-br from-white to-brand-canvas/50 p-6 shadow-sm ring-1 ring-black/[0.03] md:grid-cols-2 md:items-center md:gap-10 md:p-8">
          <p className="font-heading whitespace-pre-wrap text-pretty text-base font-light leading-relaxed text-brand-navy/80 md:text-lg">
            {block.text}
          </p>
          {block.imageSrc?.trim() ? (
            <div className="overflow-hidden rounded-xl border border-brand-navy/10 shadow-md">
              <img src={block.imageSrc} alt={block.imageAlt || ""} className="h-full w-full object-cover" loading="lazy" />
            </div>
          ) : null}
        </div>,
      );
    case "embedVideo": {
      const src = embeddableVideoSrc(block.url);
      if (!src) {
        return blockShell(
          <p className="rounded-xl border border-dashed border-brand-navy/15 bg-brand-canvas/40 px-4 py-3 text-sm text-brand-navy/55">
            Añade una URL de YouTube, Vimeo o un enlace <code className="text-xs">embed</code> válido.
          </p>,
        );
      }
      return blockShell(
        <figure className="space-y-3">
          <div className="aspect-video overflow-hidden rounded-2xl border border-brand-navy/10 bg-black/[0.06] shadow-[0_20px_50px_-24px_rgba(15,23,42,0.4)] ring-1 ring-black/[0.05]">
            <iframe
              title={block.caption?.trim() || "Video"}
              src={src}
              sandbox={IFRAME_SANDBOX_ATTR}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            />
          </div>
          {block.caption?.trim() ? (
            <figcaption className="text-center text-xs font-medium text-brand-navy/55">{block.caption}</figcaption>
          ) : null}
        </figure>,
      );
    }
    case "spacer": {
      const h = block.size === "sm" ? "h-6" : block.size === "lg" ? "h-20" : "h-12";
      return <div className={cn(h, "shrink-0")} aria-hidden />;
    }
    case "contact":
      if (!block.items?.length) return null;
      return blockShell(
        <div className="grid gap-4 sm:grid-cols-2">
          {block.items.map((it) => {
            const Icon = CONTACT_ICON_COMPONENT[it.icon] ?? MessageCircle;
            return (
              <div
                key={`${it.title}-${it.body.slice(0, 20)}`}
                className="flex gap-4 rounded-2xl border border-brand-navy/[0.08] bg-gradient-to-br from-white to-brand-canvas/70 p-5 shadow-sm ring-1 ring-black/[0.02] transition-shadow duration-300 hover:shadow-md md:p-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-inner ring-1 ring-primary/15">
                  <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="font-heading text-sm font-semibold text-brand-navy">{it.title}</p>
                  <p className="font-heading mt-1.5 whitespace-pre-line text-sm font-light leading-relaxed text-brand-navy/72">
                    {it.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>,
      );
    case "cta": {
      const href = normalizeExternalHref(block.href);
      const isPrimary = block.variant !== "secondary";
      const cls = cn(
        "font-heading inline-flex w-full items-center justify-center gap-2 rounded-xl px-8 py-4 text-sm font-medium shadow-md transition-all duration-200 sm:w-auto sm:min-w-[12rem]",
        isPrimary
          ? "bg-gradient-to-br from-brand-navy to-brand-navy text-white shadow-[0_12px_32px_-12px_rgba(20,28,46,0.4)] hover:from-brand-burgundy hover:to-brand-burgundy hover:shadow-lg"
          : "border-2 border-brand-navy/18 bg-white/90 text-brand-navy shadow-none hover:border-brand-navy/30 hover:bg-white",
      );
      if (disableInteractive) {
        return blockShell(
          <div className="flex justify-center sm:justify-start">
            <span className={cn(cls, "cursor-default opacity-90")} title="Vista previa: enlace no activo">
              {block.label || "Continuar"}
            </span>
          </div>,
        );
      }
      return blockShell(
        <div className="flex justify-center sm:justify-start">
          <Link to={href} className={cls}>
            {block.label || "Continuar"}
          </Link>
        </div>,
      );
    }
    case "divider":
      return (
        <div className="flex items-center gap-4 py-2" aria-hidden>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-brand-navy/18 to-brand-navy/5" />
          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40 shadow-[0_0_10px_rgba(200,16,46,0.35)]" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-brand-navy/18 to-brand-navy/5" />
        </div>
      );
    case "faqBlock": {
      const items = (block.items ?? []).filter((it) => it.question?.trim() || it.answer?.trim());
      if (!items.length) return null;
      return blockShell(
        <div className="divide-y divide-brand-navy/[0.08] overflow-hidden rounded-2xl border border-brand-navy/[0.08] bg-white/90 shadow-sm">
          {items.map((it, i) => (
            <div key={`faq-${i}`} className="px-5 py-4 md:px-6 md:py-5">
              <p className="font-heading text-sm font-semibold text-brand-navy">{it.question}</p>
              <p className="font-heading mt-2 whitespace-pre-wrap text-sm font-light leading-relaxed text-brand-navy/75">
                {it.answer}
              </p>
            </div>
          ))}
        </div>,
      );
    }
    case "gallery": {
      const imgs = (block.images ?? []).filter((im) => im.src?.trim());
      if (!imgs.length) return null;
      const n = imgs.length;
      return blockShell(
        <div
          className={cn("grid gap-3", n === 1 ? "grid-cols-1" : "sm:grid-cols-2")}
        >
          {imgs.map((im, i) => (
            <figure
              key={`g-${i}-${im.src.slice(0, 32)}`}
              className={cn(
                "overflow-hidden rounded-xl border border-brand-navy/10 bg-brand-canvas/40 shadow-sm",
                n === 3 && i === 2 && "sm:col-span-2",
              )}
            >
              <img src={im.src} alt={im.alt || ""} className="aspect-[4/3] h-full w-full object-cover" loading="lazy" />
            </figure>
          ))}
        </div>,
      );
    }
    case "iconCard": {
      const Icon = serviceIconForKey(block.iconKey);
      return blockShell(
        <div className="flex gap-5 rounded-2xl border border-brand-navy/[0.08] bg-gradient-to-br from-white to-brand-canvas/60 p-6 shadow-sm md:p-7">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Icon className="h-7 w-7" strokeWidth={1.5} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-lg font-medium text-brand-navy">{block.title}</p>
            <p className="font-heading mt-2 whitespace-pre-wrap text-sm font-light leading-relaxed text-brand-navy/75">
              {block.body}
            </p>
          </div>
        </div>,
      );
    }
    case "widthBand":
      return blockShell(
        <div
          className={cn(
            "rounded-xl border border-brand-navy/[0.06] bg-brand-navy/[0.03] px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-brand-navy/50",
            block.mode === "full" &&
              "relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 border-x-0 border-y-brand-navy/[0.06] py-4",
          )}
        >
          {block.label?.trim() || (block.mode === "full" ? "Banda ancho completo" : "Contenedor contenido")}
        </div>,
      );
    default:
      return null;
  }
}

function ServiceDetailBlockStack({
  blocks,
  previewMode,
  gapClass,
}: {
  blocks: ServiceDetailBlock[];
  previewMode?: boolean;
  gapClass: string;
}) {
  return (
    <div className={cn("flex flex-col border-t border-transparent", gapClass)}>
      {blocks.map((block) => (
        <ServiceDetailBlockRenderer key={block.id} block={block} disableInteractive={previewMode} />
      ))}
    </div>
  );
}

/** Contenido central de `/servicios/d/:slug` (reutilizable en vista previa del editor). */
export function ServiceDetailArticle({
  title,
  description,
  blocks,
  previewMode,
  /** Índice de tarjeta en `content.services.cards` (vista previa admin): resaltes por campo. */
  previewCardIndex,
}: {
  title: string;
  description: string;
  blocks: ServiceDetailBlock[];
  previewMode?: boolean;
  previewCardIndex?: number;
}) {
  const stackGapClass = cn(
    "border-t border-transparent pt-8 md:pt-10",
    previewMode ? "gap-8 md:gap-9" : "gap-11 md:gap-14",
  );

  const pulseBlock =
    previewMode && previewCardIndex !== undefined && previewCardIndex >= 0
      ? (`services-card-${previewCardIndex}` as const)
      : null;

  const titleInner =
    pulseBlock != null ? (
      <PreviewFieldPulse blockId={pulseBlock} fieldKey={`${pulseBlock}-title`} className="block">
        {title}
      </PreviewFieldPulse>
    ) : (
      title
    );

  const descriptionInner =
    pulseBlock != null ? (
      <PreviewFieldPulse blockId={pulseBlock} fieldKey={`${pulseBlock}-description`} className="block">
        {description}
      </PreviewFieldPulse>
    ) : (
      description
    );

  return (
    <article className={cn("relative", previewMode && "text-[0.97em]")}>
      <header
        className={cn(
          "relative mb-10 text-center md:mb-12 md:text-left",
          previewMode && "mb-6 md:mb-8",
        )}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-gradient-to-r from-primary/[0.08] to-transparent px-4 py-1.5 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(200,16,46,0.6)]" aria-hidden />
          <p className="font-heading text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Servicio</p>
        </div>
        <h1
          className={cn(
            "font-heading mt-5 text-balance text-4xl font-light tracking-tight text-brand-navy md:mt-6 md:text-5xl lg:text-[3.35rem] lg:leading-[1.08]",
            previewMode && "mt-3 text-3xl md:text-4xl",
          )}
        >
          {titleInner}
        </h1>
        <div className="mx-auto mt-5 h-px w-24 bg-gradient-to-r from-transparent via-primary/50 to-transparent md:mx-0" aria-hidden />
        <p
          className={cn(
            "font-heading mx-auto mt-6 max-w-2xl text-pretty text-lg font-light leading-relaxed text-brand-navy/72 md:mx-0 md:text-xl",
            previewMode && "mt-4 text-base md:text-lg",
          )}
        >
          {descriptionInner}
        </p>
      </header>

      <div
        className={cn(
          "relative rounded-[1.75rem] border border-brand-navy/[0.08] bg-white/[0.94] shadow-[0_28px_80px_-36px_rgba(15,23,42,0.28)] ring-1 ring-black/[0.03] backdrop-blur-[2px]",
          previewMode ? "p-6 md:p-8" : "p-8 md:p-11 lg:p-14",
        )}
      >
        <div
          className="pointer-events-none absolute left-6 right-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent md:left-10 md:right-10"
          aria-hidden
        />
        <ServiceDetailBlockStack blocks={blocks} previewMode={previewMode} gapClass={stackGapClass} />
      </div>
    </article>
  );
}
