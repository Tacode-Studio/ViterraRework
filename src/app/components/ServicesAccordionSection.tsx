"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Link2, Mail, MessageCircle, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useSiteContent } from "../../contexts/SiteContentContext";
import { useVisualSiteEditorOptional } from "../../contexts/VisualSiteEditorContext";
import { mergeSiteSection } from "../../lib/siteContentMerge";
import { resolveServiceCardPrimaryHref } from "../../lib/serviceCardPrimaryHref";
import { serviceIconForKey } from "../../lib/serviceIcons";
import type { ServiceCardContactLink } from "../../data/siteContent";
import { PreviewFieldPulse } from "./admin/siteEditor/PreviewFieldPulse";
import { PreviewSectionChrome } from "./admin/siteEditor/PreviewSectionChrome";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { LocaleLink as Link } from "./LocaleLink";
import { useLocale } from "../i18n/LocaleContext";
import { Reveal } from "./Reveal";
import { cn } from "./ui/utils";

function contactIcon(icon: ServiceCardContactLink["icon"]): LucideIcon {
  switch (icon) {
    case "mail":
      return Mail;
    case "phone":
      return Phone;
    case "link":
      return Link2;
    default:
      return MessageCircle;
  }
}

function contactCaption(link: ServiceCardContactLink): string {
  if (link.icon === "phone") {
    const h = (link.href ?? "").trim();
    const n = h.toLowerCase().startsWith("tel:") ? h.slice(4).trim() : "";
    const lab = (link.label ?? "").trim();
    if (lab && n) return `${lab} · ${n}`;
    if (n) return n;
    return lab || "Teléfono";
  }
  return (link.label ?? "").trim() || "Enlace";
}

export function ServicesAccordionSection() {
  const { content } = useSiteContent();
  const { t, localePath } = useLocale();
  const reduceMotion = useReducedMotion();
  const merged = useMemo(() => mergeSiteSection("services", content.services), [content.services]);
  const visualEditor = useVisualSiteEditorOptional();

  const editorCardIndex = useMemo(() => {
    if (!visualEditor?.enabled || !visualEditor.activeBlockId) return null;
    const m = /^services-card-(\d+)$/.exec(visualEditor.activeBlockId);
    return m ? Number(m[1]) : null;
  }, [visualEditor?.enabled, visualEditor?.activeBlockId]);

  const [openValue, setOpenValue] = useState<string>("");

  useEffect(() => {
    if (editorCardIndex != null && editorCardIndex >= 0) {
      setOpenValue(`services-card-${editorCardIndex}`);
    }
  }, [editorCardIndex]);

  const handleValueChange = (value: string) => {
    setOpenValue(value);
    if (!visualEditor?.enabled || !value) return;
    visualEditor.setActiveBlockId?.(value);
  };

  if (merged.cards.length === 0) {
    return null;
  }

  return (
    <section className="relative overflow-hidden border-y border-brand-navy/10 bg-brand-canvas py-14 sm:py-16 md:py-24">
      {/* Atmósfera suave — ancla visual sin competir con el contenido */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 8% 12%, rgba(196,30,58,0.07), transparent 55%), radial-gradient(ellipse 55% 40% at 92% 88%, rgba(15,23,42,0.06), transparent 50%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-navy/20 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Accordion
          type="single"
          collapsible
          value={openValue}
          onValueChange={handleValueChange}
          className="w-full space-y-3 md:space-y-4"
        >
          {merged.cards.map((card, index) => {
            const blockId = `services-card-${index}`;
            const Icon = serviceIconForKey(card.iconKey);
            const ctaHref = resolveServiceCardPrimaryHref(card);
            const tag = (card.tag ?? "").trim();
            const bullets = (card.bullets ?? []).filter((b) => b.trim().length > 0);
            const contactLinks = card.contactLinks ?? [];
            const isOpen = openValue === blockId;
            const indexLabel = String(index + 1).padStart(2, "0");

            return (
              <Reveal key={blockId} y={18} delay={Math.min(index * 0.045, 0.22)}>
                <PreviewSectionChrome blockId={blockId} label={`Servicio ${index + 1}`}>
                  <AccordionItem
                    value={blockId}
                    className={cn(
                      "group relative overflow-hidden border border-brand-navy/10 bg-white/90 backdrop-blur-[2px] transition-all duration-300",
                      "hover:border-brand-navy/25",
                      isOpen && "border-brand-navy/20 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)]",
                      editorCardIndex === index && "ring-1 ring-primary/30",
                    )}
                  >
                    {/* Acento lateral al abrir / hover */}
                    <span
                      className={cn(
                        "pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-primary transition-opacity duration-300",
                        isOpen ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                      )}
                      aria-hidden
                    />

                    <AccordionTrigger
                      className={cn(
                        "font-heading gap-4 px-4 py-5 text-left hover:no-underline sm:gap-5 sm:px-6 sm:py-6 md:px-8 md:py-7",
                        "[&[data-state=open]]:pb-3",
                      )}
                      onClick={() => visualEditor?.setActiveBlockId?.(blockId)}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-5 md:gap-6">
                        <span
                          className={cn(
                            "font-heading hidden w-11 shrink-0 text-sm tracking-[0.14em] transition-colors sm:block md:w-12 md:text-base",
                            isOpen ? "font-medium text-primary" : "font-light text-brand-navy/30",
                          )}
                        >
                          {indexLabel}
                        </span>

                        <PreviewFieldPulse blockId={blockId} fieldKey={`${blockId}-icon`} layout="inline">
                          <motion.span
                            className={cn(
                              "relative flex h-12 w-12 shrink-0 items-center justify-center transition-colors duration-300 sm:h-14 sm:w-14",
                              isOpen
                                ? "bg-brand-navy text-white"
                                : "bg-brand-canvas text-brand-navy group-hover:bg-brand-navy/5",
                            )}
                            whileHover={reduceMotion ? undefined : { scale: 1.04 }}
                            transition={{ type: "spring", stiffness: 420, damping: 28 }}
                          >
                            <span
                              className={cn(
                                "absolute inset-0 border transition-colors duration-300",
                                isOpen ? "border-brand-navy" : "border-brand-navy/12 group-hover:border-brand-navy/25",
                              )}
                              aria-hidden
                            />
                            <Icon className="relative h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.5} aria-hidden />
                          </motion.span>
                        </PreviewFieldPulse>

                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <PreviewFieldPulse
                              blockId={blockId}
                              fieldKey={`${blockId}-title`}
                              layout="inline"
                            >
                              <span className="font-heading text-lg font-semibold tracking-tight text-brand-navy transition-colors group-hover:text-brand-navy sm:text-xl md:text-2xl">
                                {card.title}
                              </span>
                            </PreviewFieldPulse>
                            {tag ? (
                              <PreviewFieldPulse
                                blockId={blockId}
                                fieldKey={`${blockId}-tag`}
                                layout="inline"
                              >
                                <span className="font-heading inline-flex items-center gap-1.5 border border-primary/20 bg-primary/[0.07] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary sm:text-[11px]">
                                  <span className="h-1 w-1 bg-primary" aria-hidden />
                                  {tag}
                                </span>
                              </PreviewFieldPulse>
                            ) : null}
                          </span>
                          {!isOpen && card.description ? (
                            <p className="font-heading mt-1.5 hidden max-w-2xl truncate text-sm font-light text-brand-navy/55 not-italic md:block">
                              {card.description}
                            </p>
                          ) : null}
                        </span>
                      </span>
                    </AccordionTrigger>

                    <AccordionContent className="px-4 pb-5 sm:px-6 sm:pb-6 md:px-8 md:pb-7">
                      <div className="border-t border-brand-navy/10 pt-5 sm:pt-6 md:ml-[4.75rem] lg:ml-[5.75rem]">
                        <div className="grid overflow-hidden border border-brand-navy/10 lg:grid-cols-12">
                          {/* Contenido editorial */}
                          <div className="relative space-y-5 bg-brand-canvas/50 p-5 sm:space-y-6 sm:p-6 lg:col-span-7 lg:p-7">
                            <span
                              className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary via-primary/50 to-transparent"
                              aria-hidden
                            />

                            {card.description ? (
                              <div className="relative pl-1">
                                <p className="font-heading text-[15px] font-light leading-[1.7] text-brand-navy/80 not-italic sm:text-base md:text-lg md:leading-[1.65]">
                                  <PreviewFieldPulse
                                    blockId={blockId}
                                    fieldKey={`${blockId}-description`}
                                    className="block"
                                  >
                                    {card.description}
                                  </PreviewFieldPulse>
                                </p>
                              </div>
                            ) : null}

                            {bullets.length > 0 ? (
                              <PreviewFieldPulse
                                blockId={blockId}
                                fieldKey={`${blockId}-bullets`}
                                className="block"
                              >
                                <ul className="divide-y divide-brand-navy/10 border-y border-brand-navy/10">
                                  {bullets.map((bullet, bi) => (
                                    <li
                                      key={`${blockId}-bullet-${bi}`}
                                      className="font-heading flex items-center gap-3.5 py-3 text-sm font-medium text-brand-navy sm:gap-4 sm:text-[15px]"
                                    >
                                      <span
                                        className="font-heading w-7 shrink-0 text-[11px] font-semibold tracking-[0.08em] text-primary"
                                        aria-hidden
                                      >
                                        {String(bi + 1).padStart(2, "0")}
                                      </span>
                                      <span className="min-w-0 leading-snug">{bullet}</span>
                                    </li>
                                  ))}
                                </ul>
                              </PreviewFieldPulse>
                            ) : null}
                          </div>

                          {/* Panel de acción */}
                          <div className="relative flex flex-col justify-between gap-6 bg-brand-navy p-5 text-white sm:p-6 lg:col-span-5 lg:p-7">
                            <div
                              className="pointer-events-none absolute inset-0 opacity-[0.14]"
                              aria-hidden
                              style={{
                                background:
                                  "radial-gradient(ellipse 80% 60% at 100% 0%, #C41E3A, transparent 55%)",
                              }}
                            />

                            {contactLinks.length > 0 ? (
                              <div className="relative">
                                <p className="font-heading mb-3.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                                  {t("services.quickContact")}
                                </p>
                                <div className="flex flex-col gap-1.5">
                                  {contactLinks.map((link, li) => {
                                    const ContactIcon = contactIcon(link.icon);
                                    const href = (link.href ?? "").trim();
                                    if (!href) return null;
                                    return (
                                      <PreviewFieldPulse
                                        key={`${blockId}-contact-${li}`}
                                        blockId={blockId}
                                        fieldKey={`${blockId}-contact-${li}`}
                                        layout="inline"
                                      >
                                        <a
                                          href={href}
                                          className="font-heading group/link inline-flex w-full cursor-pointer items-center gap-3 border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-medium text-white/90 transition-colors hover:border-white/30 hover:bg-white/12"
                                          target={href.startsWith("http") ? "_blank" : undefined}
                                          rel={
                                            href.startsWith("http")
                                              ? "noopener noreferrer"
                                              : undefined
                                          }
                                        >
                                          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-white/10 text-white transition-colors group-hover/link:bg-primary group-hover/link:text-white">
                                            <ContactIcon
                                              className="h-3.5 w-3.5"
                                              strokeWidth={1.5}
                                              aria-hidden
                                            />
                                          </span>
                                          <span className="min-w-0 flex-1 truncate underline-offset-2 group-hover/link:underline">
                                            {contactCaption(link)}
                                          </span>
                                          <ArrowRight
                                            className="h-3.5 w-3.5 shrink-0 text-white/35 transition-all group-hover/link:translate-x-0.5 group-hover/link:text-white"
                                            aria-hidden
                                          />
                                        </a>
                                      </PreviewFieldPulse>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="relative" />
                            )}

                            {ctaHref ? (
                              <PreviewFieldPulse
                                blockId={blockId}
                                fieldKey={`${blockId}-linkLabel`}
                                className="relative"
                                layout="inline"
                              >
                                <Link
                                  to={localePath(ctaHref)}
                                  className="font-heading group/cta inline-flex w-full cursor-pointer items-center justify-between gap-3 bg-white px-5 py-3.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-brand-navy shadow-[0_0_0_1px_rgba(255,255,255,0.2)] transition-all hover:bg-primary hover:text-white hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)]"
                                  onClick={() => visualEditor?.setActiveBlockId?.(blockId)}
                                >
                                  <span className="min-w-0 truncate text-left">
                                    {(card.linkLabel ?? "").trim() || t("common.seeMore")}
                                  </span>
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-brand-navy text-white transition-colors group-hover/cta:bg-white group-hover/cta:text-primary">
                                    <ArrowRight
                                      className="h-4 w-4 transition-transform group-hover/cta:translate-x-0.5"
                                      aria-hidden
                                    />
                                  </span>
                                </Link>
                              </PreviewFieldPulse>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </PreviewSectionChrome>
              </Reveal>
            );
          })}
        </Accordion>
      </div>
    </section>
  );
}
