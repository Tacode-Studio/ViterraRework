import { motion, useReducedMotion } from "motion/react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { LocaleLink as Link } from "../components/LocaleLink";
import { ArrowRight } from "lucide-react";
import { useSiteContent } from "../../contexts/SiteContentContext";
import { usePreviewLayout } from "../../contexts/PreviewCanvasContext";
import { mergeSiteSection } from "../../lib/siteContentMerge";
import { PreviewFieldPulse } from "../components/admin/siteEditor/PreviewFieldPulse";
import { PreviewSectionChrome } from "../components/admin/siteEditor/PreviewSectionChrome";
import { HeroBackdropMedia } from "../components/HeroBackdropMedia";
import { ViterraHeroTopClusterAnimated } from "../components/ViterraHeroTopClusterAnimated";
import { ServicesAccordionSection } from "../components/ServicesAccordionSection";
import { Reveal } from "../components/Reveal";
import {
  viterraHeroSectionClass,
  viterraHeroCenteredStackClass,
  viterraHeroCenteredInnerClass,
  viterraHeroMainClass,
  viterraHeroSubtitleClass,
} from "../config/heroLayout";

export function ServicesPage() {
  const reduceMotion = useReducedMotion();
  const pl = usePreviewLayout();
  const { content } = useSiteContent();
  const s = mergeSiteSection("services", content.services);

  const heroContainerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.1,
        delayChildren: reduceMotion ? 0 : 0.06,
      },
    },
  } as const;

  const heroItemVariants = {
    hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 22 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduceMotion ? 0 : 0.52, ease: [0.22, 1, 0.36, 1] as const },
    },
  } as const;

  return (
    <div className="viterra-page flex min-h-screen flex-col bg-white">
      <Header />

      <main className="flex min-h-0 flex-1 flex-col">
      <PreviewSectionChrome blockId="services-hero" label="Cabecera">
      <section className={viterraHeroSectionClass}>
        <div className="absolute inset-0 z-0 overflow-hidden">
          <PreviewFieldPulse blockId="services-hero" fieldKey="services-hero-bg" layout="cover" className="h-full w-full">
            <HeroBackdropMedia
              src={s.heroImage ?? ""}
              fallbackSrc="https://wallpapers.com/images/hd/4k-office-background-silapjkl0bkxakj4.jpg"
              reduceMotion={!!reduceMotion}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-brand-navy/78 via-black/48 to-black/60" />
          </PreviewFieldPulse>
        </div>

        <div className={viterraHeroCenteredStackClass}>
          <motion.div
            className={viterraHeroCenteredInnerClass}
            variants={heroContainerVariants}
            initial="hidden"
            animate="visible"
          >
            <ViterraHeroTopClusterAnimated
              kicker="Viterra · Servicios"
              itemVariants={heroItemVariants}
              reduceMotion={!!reduceMotion}
            />
            <motion.div variants={heroItemVariants} className={viterraHeroMainClass}>
              <h1 className={pl.heroTitleClass()}>
                <PreviewFieldPulse blockId="services-hero" fieldKey="services-hero-title" className="block">
                  {s.heroTitle}
                </PreviewFieldPulse>
              </h1>
            </motion.div>
            <motion.p variants={heroItemVariants} className={viterraHeroSubtitleClass}>
              <PreviewFieldPulse blockId="services-hero" fieldKey="services-hero-subtitle" className="block w-full">
                {s.heroSubtitle}
              </PreviewFieldPulse>
            </motion.p>
          </motion.div>
        </div>
      </section>
      </PreviewSectionChrome>

      <ServicesAccordionSection />

      <PreviewSectionChrome blockId="services-cta" label="Llamado a la acción">
      <section className="border-t border-brand-navy/10 bg-brand-canvas py-10 sm:py-12 md:py-14">
        <Reveal className="mx-auto max-w-3xl px-6 text-center lg:px-8" y={16}>
          <div>
            <h2 className="font-heading mb-3 text-2xl font-light tracking-tight text-brand-navy sm:mb-4 sm:text-3xl md:text-4xl">
              <PreviewFieldPulse blockId="services-cta" fieldKey="services-cta-title" className="block">
                {s.ctaTitle}
              </PreviewFieldPulse>
            </h2>
            <p className="font-heading mb-6 text-base font-light not-italic text-brand-navy/72 sm:mb-7 sm:text-lg">
              <PreviewFieldPulse blockId="services-cta" fieldKey="services-cta-subtitle" className="block">
                {s.ctaSubtitle}
              </PreviewFieldPulse>
            </p>
            <motion.div whileHover={reduceMotion ? undefined : { y: -2 }} transition={{ type: "spring", stiffness: 380, damping: 24 }}>
              <Link
                to="/contacto"
                className="font-heading inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-8 py-3 text-sm font-medium text-white transition-all hover:bg-brand-burgundy"
              >
                <PreviewFieldPulse blockId="services-cta" fieldKey="services-cta-button" className="inline-flex items-center gap-2">
                  {s.ctaButton}
                  <ArrowRight className="h-4 w-4" />
                </PreviewFieldPulse>
              </Link>
            </motion.div>
          </div>
        </Reveal>
      </section>
      </PreviewSectionChrome>

      </main>

      <Footer />
    </div>
  );
}
