import { Link, useLocation } from "react-router";
import { useState, useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { VITERRA_NAV_ITEMS, isActiveNavPath } from "../config/siteNav";
import { SocialNavIcons } from "./SocialNavIcons";
import { LanguageToggle } from "./LanguageToggle";
import { useLocale } from "../i18n/LocaleContext";
import { cn } from "./ui/utils";

const NAVY = { r: 20, g: 28, b: 46 } as const;

/** Misma marca que el header móvil (`Header.tsx`). */
const MARK_ICON_MONO = "/images/branding/viterra-mark-mono-alpha.png";
const MAP_HEADER_MARK_BOX_W = 104;
const MAP_HEADER_MARK_BOX_H = 26;
const MAP_HEADER_MARK_SCALE = 0.92 * 0.88;

/** Misma curva que `viterra-reveal-in` (animations.css). */
const REVEAL_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Cada fila: duración parecida al reveal del inicio (~0.58s). */
const LINE_REVEAL_MS = 580;
/** Retraso entre filas consecutivas (efecto cascada arriba → abajo). */
const LINE_STAGGER_MS = 95;
const LINE_START_DELAY_MS = 55;
/** Desplazamiento inicial de cada línea (viene de arriba). */
const LINE_OFFSET_Y = "-0.75rem";
/** Duración del panel sólido que “baja” (scaleY desde arriba), alineada al ritmo del texto. */
const PANEL_BG_REVEAL_MS = 620;

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
}

function lineRevealStyle(
  lineIndex: number,
  open: boolean,
  reduced: boolean
): CSSProperties {
  if (reduced) {
    return {
      opacity: open ? 1 : 0,
      transition: open ? "opacity 0.4s ease" : "opacity 0.18s ease",
    };
  }
  const delayMs = LINE_START_DELAY_MS + lineIndex * LINE_STAGGER_MS;
  if (open) {
    return {
      opacity: 1,
      transform: "translate3d(0, 0, 0)",
      transition: `opacity ${LINE_REVEAL_MS}ms ${REVEAL_EASING} ${delayMs}ms, transform ${LINE_REVEAL_MS}ms ${REVEAL_EASING} ${delayMs}ms`,
    };
  }
  return {
    opacity: 0,
    transform: `translate3d(0, ${LINE_OFFSET_Y}, 0)`,
    transition: "opacity 0.16s ease, transform 0.16s ease",
  };
}

export function MapSearchHeaderBar() {
  const location = useLocation();
  const { t, localePath } = useLocale();
  const [open, setOpen] = useState(false);
  /** Sigue en DOM unos ms al cerrar para que el fondo termine scaleY(0). */
  const [panelMounted, setPanelMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const close = () => setOpen(false);

  const toggle = () => setOpen((prev) => !prev);

  useEffect(() => {
    if (open) {
      setPanelMounted(true);
      return;
    }
    const id = window.setTimeout(() => setPanelMounted(false), PANEL_BG_REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative z-[1200] shrink-0 border-b border-white/10 pt-0 lg:pt-[env(safe-area-inset-top,0px)]"
      style={{
        fontFamily: "Poppins, sans-serif",
        backgroundColor: `rgba(${NAVY.r},${NAVY.g},${NAVY.b},0.98)`,
        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 100%)`,
      }}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2 sm:px-4 lg:px-6">
        <Link
          to="/"
          className="group inline-flex min-w-0 max-w-full flex-col items-start gap-0.5 justify-self-start"
          onClick={close}
        >
          <span className="font-heading text-[12px] font-medium tracking-[0.22em] text-white sm:text-[13px]">VITERRA</span>
          <span className="h-px w-7 bg-[#C8102E] sm:w-8" aria-hidden />
        </Link>
        <div className="flex flex-col items-center justify-center gap-1 justify-self-center sm:gap-1.5">
          <Link
            to="/"
            className="flex shrink-0 items-center justify-center"
            onClick={close}
            aria-label="Viterra Grupo Inmobiliario — Inicio"
          >
            <span
              className="inline-flex shrink-0 items-end justify-center overflow-visible"
              style={{ width: MAP_HEADER_MARK_BOX_W, height: MAP_HEADER_MARK_BOX_H }}
              aria-hidden
            >
              <img
                src={MARK_ICON_MONO}
                alt=""
                width={1024}
                height={264}
                decoding="async"
                className="block max-h-full object-contain"
                style={{
                  width: "100%",
                  height: MAP_HEADER_MARK_BOX_H,
                  maxHeight: MAP_HEADER_MARK_BOX_H,
                  objectPosition: "bottom center",
                  transform: `scale(${MAP_HEADER_MARK_SCALE})`,
                  transformOrigin: "bottom center",
                  opacity: 0.96,
                }}
              />
            </span>
          </Link>
          <SocialNavIcons iconSize="sm" className="justify-center" />
        </div>
        <div className="flex min-w-0 items-center justify-end gap-0.5 justify-self-end sm:gap-1">
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/90 hover:bg-white/10 sm:text-xs"
            aria-expanded={open}
            aria-controls="map-search-nav-panel"
            id="map-search-nav-toggle"
            onClick={toggle}
          >
            <span className="hidden sm:inline">Menú</span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
              style={{ transitionDuration: `${LINE_REVEAL_MS}ms`, transitionTimingFunction: REVEAL_EASING }}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {/* Fondo: capa aparte con scaleY desde arriba (sin fundido difuso por opacity en el contenedor). */}
      <div
        id="map-search-nav-panel"
        role="region"
        aria-labelledby="map-search-nav-toggle"
        aria-hidden={!open}
        className="absolute left-0 right-0 top-full max-h-[min(55vh,28rem)] overflow-y-auto overscroll-contain"
        style={{
          visibility: open || panelMounted ? "visible" : "hidden",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div className="relative rounded-b-xl">
          <div
            aria-hidden
            className="absolute inset-0 z-0 origin-top rounded-b-xl border-b border-white/10 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.55)]"
            style={{
              backgroundColor: `rgba(${NAVY.r},${NAVY.g},${NAVY.b},0.98)`,
              backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 100%)`,
              transform: open ? "scaleY(1)" : "scaleY(0)",
              transformOrigin: "top center",
              transition: reducedMotion
                ? undefined
                : `transform ${PANEL_BG_REVEAL_MS}ms ${REVEAL_EASING}`,
              pointerEvents: "none",
            }}
          />
          <div className="relative z-10 px-4 pb-4 pt-2">
            <p
              className="mb-3 text-center text-[10px] font-normal uppercase tracking-[0.22em] text-white/65"
              style={lineRevealStyle(0, open, reducedMotion)}
            >
              Grupo Inmobiliario
            </p>
            <nav className="flex flex-col gap-0.5">
              {VITERRA_NAV_ITEMS.map(([to, labelKey], i) => {
                const active = isActiveNavPath(location.pathname, to);
                return (
                  <Link
                    key={to}
                    to={localePath(to)}
                    onClick={close}
                    className={cn(
                      "rounded-lg border-l-[3px] px-3 py-2.5 text-xs uppercase tracking-[0.12em] sm:text-sm",
                      active
                        ? "border-primary bg-white/10 font-semibold text-white"
                        : "border-transparent text-white/90 hover:bg-white/10"
                    )}
                    style={lineRevealStyle(1 + i, open, reducedMotion)}
                    aria-current={active ? "page" : undefined}
                  >
                    {t(labelKey)}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-3 flex justify-center border-t border-white/10 pt-3">
              <LanguageToggle />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
