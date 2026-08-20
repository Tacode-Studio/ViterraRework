import { Link, useLocation } from "react-router";
import { Menu, X, Heart } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePreviewCanvas } from "../../contexts/PreviewCanvasContext";
import { useSitePreviewVirtualPath } from "../../contexts/SitePreviewVirtualPathContext";
import { useSitePreviewSuppressHeader } from "../../contexts/SitePreviewSuppressHeaderContext";
import { PreviewSectionChrome } from "./admin/siteEditor/PreviewSectionChrome";
import { SocialNavIcons } from "./SocialNavIcons";
import { cn } from "./ui/utils";
import { VITERRA_NAV_ITEMS, isActiveNavPath } from "../config/siteNav";
import { useWishlist } from "../contexts/WishlistContext";
import { stripLocaleFromPathname } from "../i18n/locale";
import { useLocale } from "../i18n/LocaleContext";
import { LanguageToggle } from "./LanguageToggle";

/** Recorrido de scroll (px) para interpolar header (home e internas) */
const SCROLL_RANGE = 200;

const NAVY = { r: 20, g: 28, b: 46 } as const;

/** Opacidad máxima del fondo navy: <1 deja traslucir el fondo bajo el header */
const BG_ALPHA_MAX = 0.94;
/** Opacidad mínima del fondo navy (arriba del todo, sin scroll): fondo oscuro en vez de transparente para que el logo destaque. */
const BG_ALPHA_MIN = 0.55;
/** Panel del menú hamburguesa (< lg): cristal arriba del todo; con scroll → mismo cuerpo que la barra. */
const MOBILE_MENU_BG_ALPHA_TOP = 0.48;

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

function smoothstep01(t: number, e0: number, e1: number) {
  const u = clamp01((t - e0) / (e1 - e0));
  return u * u * (3 - 2 * u);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Íconos oficiales solo-marca (~1024×265); variantes `-alpha` = negro→transparente (script en repo). */
const MARK_ICON_MONO = "/images/branding/viterra-mark-mono-alpha.png";
const MARK_ICON_RED = "/images/branding/viterra-mark-red-alpha.png";

/** Marca blanca (hero) un poco más pequeña que la roja al hacer scroll */
const MARK_MONO_SCALE_FACTOR = 0.88;

/**
 * Centro horizontal **óptico** de la V respecto al ancho de caja del PNG (0 = borde izq., 1 = borde der.).
 * El asset es asimétrico: el centro de masa visual queda claramente a la izquierda del centro geométrico.
 * Ajustar entre ~0.15 y ~0.22 si se sustituye el PNG (sube si la V se ve aún corrida a la derecha).
 */
const MARK_LOGO_OPTICAL_CENTER_X_RATIO = 0.21;

/**
 * Distancia en px desde el borde izquierdo del `<ul>` de redes (tamaño `md`: `p-2`, icono 17px, `sm:gap-2`)
 * hasta el centro horizontal del 3.er icono. Recalcular si cambian paddings, gaps u orden en `SocialNavIcons`.
 */
const MD_SOCIAL_UL_LEFT_TO_THIRD_ICON_CENTER_PX = 98.5;

/**
 * Caja fija + scale. La imagen ocupa el 100% del ancho de la caja para que `transform-origin: bottom center`
 * coincida con el centro del layout (si el PNG es más estrecho que la caja, object-fit no desplaza el origen).
 */
function ViterraMarkLeftHero({
  boxW,
  boxH,
  scale,
  className,
  enableTransformTransition = true,
}: {
  boxW: number;
  boxH: number;
  scale: number;
  className?: string;
  /** En móvil el `scale` es fijo: sin transición en `transform` (evita “respirar” al hacer scroll). */
  enableTransformTransition?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-end justify-center overflow-visible", className)}
      style={{ width: boxW, height: boxH }}
      aria-hidden
    >
      <img
        src={MARK_ICON_RED}
        alt=""
        width={1024}
        height={264}
        decoding="async"
        className="block max-h-full object-contain"
        style={{
          width: "100%",
          height: boxH,
          maxHeight: boxH,
          objectPosition: "bottom center",
          transform: `scale(${scale})`,
          transformOrigin: "bottom center",
          transition: enableTransformTransition ? "transform 0.2s ease" : "none",
          opacity: 0.96,
        }}
      />
    </span>
  );
}

function ViterraMarkLeftScrolled({
  boxW,
  boxH,
  scale,
  className,
  enableTransformTransition = true,
}: {
  boxW: number;
  boxH: number;
  scale: number;
  className?: string;
  enableTransformTransition?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-end justify-center overflow-visible", className)}
      style={{ width: boxW, height: boxH }}
      aria-hidden
    >
      <img
        src={MARK_ICON_RED}
        alt=""
        width={1024}
        height={267}
        decoding="async"
        className="block max-h-full object-contain"
        style={{
          width: "100%",
          height: boxH,
          maxHeight: boxH,
          objectPosition: "bottom center",
          transform: `scale(${scale})`,
          transformOrigin: "bottom center",
          transition: enableTransformTransition ? "transform 0.2s ease" : "none",
          opacity: 0.96,
        }}
      />
    </span>
  );
}

export function Header() {
  const inPreviewCanvas = usePreviewCanvas();
  const sitePreviewPath = useSitePreviewVirtualPath();
  const suppressSitePreviewHeader = useSitePreviewSuppressHeader();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrollP, setScrollP] = useState(0);
  const { count } = useWishlist();
  const location = useLocation();
  const { t, localePath } = useLocale();
  /**
   * En el iframe del editor la URL real es `/admin/...`; la ruta simulada viene del contexto.
   * Se normaliza sin prefijo de idioma para que las comparaciones de abajo
   * (`isHome`, `isRentPage`, …) funcionen igual en `/renta` y en `/en/renta`.
   */
  const routePath = stripLocaleFromPathname(sitePreviewPath ?? location.pathname);
  const isHome = routePath === "/";
  const isRentPage = routePath === "/renta";
  const isSalePage = routePath === "/venta";
  const isDevelopmentsPage = routePath === "/desarrollos";
  const isPropertiesSection = routePath.startsWith("/propiedades");
  const isServicesPage = routePath === "/servicios";
  const isContactPage = routePath === "/contacto";
  const isAboutPage = routePath === "/nosotros";
  /** Solo propiedades: lista/mapa sin hero “arriba del todo” como renta/venta — mantener barra compacta. Desarrollos tiene hero como el resto: usar scroll como `p`. */
  const lockHeaderInMode2 = isPropertiesSection;
  const useOverlayHeader =
    isHome || isRentPage || isSalePage || isDevelopmentsPage || isServicesPage || isContactPage || isAboutPage;
  const rafRef = useRef<number | null>(null);

  const readScroll = useCallback(() => {
    setScrollP(clamp01(window.scrollY / SCROLL_RANGE));
  }, []);

  useEffect(() => {
    readScroll();
    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        readScroll();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [readScroll]);

  useEffect(() => {
    readScroll();
  }, [location.pathname, sitePreviewPath, readScroll]);

  if (suppressSitePreviewHeader) return null;

  const p = lockHeaderInMode2 ? 1 : scrollP;

  /** 1 en la parte superior, 0 tras un poco de scroll — refuerzo del velo solo al inicio */
  const firstModeHero = 1 - smoothstep01(p, 0.02, 0.16);
  const heroVeilBoost = firstModeHero * 0.17;
  const gTop = Math.min(0.92, lerp(0.5, 0.22, p) + heroVeilBoost);
  const gMid = Math.min(0.88, lerp(0.38, 0.14, p) + heroVeilBoost * 0.9);
  const gBot = Math.min(0.78, lerp(0.2, 0.09, p) + heroVeilBoost * 0.72);

  const bgAlpha = lerp(BG_ALPHA_MIN, BG_ALPHA_MAX, p);
  const blurPx = lerp(0, 18, p);
  const headerBgAlpha = bgAlpha;
  const shadowY = lerp(0, 14, p);
  const shadowBlur = lerp(0, 36, p);
  const shadowAlpha = lerp(0, 0.38, p);
  const borderAlpha = lerp(0.12, 0.14, p);

  const logoPadTop = lerp(22, 8, p);
  const logoPadBottom = lerp(10, 6, p);
  const titleSize = lerp(26, 17, p);
  const guionWhite = 1 - smoothstep01(p, 0.15, 0.55);
  const guionRed = smoothstep01(p, 0.2, 0.6);
  const subtitleOpacity = 1 - smoothstep01(p, 0.05, 0.42);
  const subtitleMaxH = lerp(40, 0, smoothstep01(p, 0.08, 0.45));
  const navRowH = lerp(52, 46, p);
  const navGap = lerp(32, 14, p);
  const navFontPx = lerp(13, 10.5, p);
  const navTrackEm = lerp(0.12, 0.16, p);
  const navLift = lerp(0, -3, p);

  /** Transición marca izquierda: blanco grande → rojo compacto (cruza con el scroll) */
  const compactLeftMark = smoothstep01(p, 0.2, 0.48);
  /** 0 = arriba del todo (marca grande); 1 = header compacto (marca pequeña) */
  const markShrink = smoothstep01(p, 0.05, 0.48);
  /** Escala 1 → ~0.52: mismo ancho de caja, el dibujo se reduce desde abajo al centro */
  const markScale = lerp(1, 0.52, markShrink);
  const markBoxW = 200;
  const markBoxH = 50;
  /**
   * Móvil/tablet (< lg): caja fija + escala fija para mono y rojo.
   * No usar `markScale` del scroll (eso anima el logo de escritorio): al mezclarlo con el crossfade
   * blanco→rojo el tamaño “respira” y el PNG rojo se ve desacomodado.
   */
  const markBoxWMobile = 104;
  const markBoxHMobile = 26;
  const MOBILE_HEADER_MARK_SCALE = 0.92 * MARK_MONO_SCALE_FACTOR;

  /** Centro del 3.er icono bajo el centro óptico de la V: margen izq. del `<ul>` dentro de la caja `markBoxW`. */
  const desktopSocialMarginLeft =
    markBoxW * MARK_LOGO_OPTICAL_CENTER_X_RATIO - MD_SOCIAL_UL_LEFT_TO_THIRD_ICON_CENTER_PX;
  const navLinkClass =
    "font-normal uppercase text-white/85 hover:text-white transition-colors shrink-0";
  /** Modo 1 (nav centrada, inicio de scroll): subrayado blanco. Modo 2 (nav partida): rojo corporativo. */
  const navLinkActiveBase = "text-white font-semibold underline decoration-2 underline-offset-[7px]";
  const navLinkActiveClassCenter = `${navLinkActiveBase} decoration-white`;
  return (
    <header
      className={`left-0 right-0 z-[1100] w-full overflow-visible text-white pt-[env(safe-area-inset-top,0px)] ${
        useOverlayHeader ? "fixed top-0" : "sticky top-0"
      }`}
      style={{
        fontFamily: "Poppins, sans-serif",
        backgroundColor: `rgba(${NAVY.r},${NAVY.g},${NAVY.b},${headerBgAlpha})`,
        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,${gTop.toFixed(3)}) 0%, rgba(0,0,0,${gMid.toFixed(3)}) 42%, rgba(0,0,0,${gBot.toFixed(3)}) 100%)`,
        backdropFilter: `saturate(140%) blur(${blurPx}px)`,
        WebkitBackdropFilter: `saturate(140%) blur(${blurPx}px)`,
        boxShadow: p > 0.02 ? `0 ${shadowY}px ${shadowBlur}px -10px rgba(0,0,0,${shadowAlpha})` : "none",
        borderBottom: `1px solid rgba(255,255,255,${borderAlpha})`,
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={cn("relative overflow-x-visible transition-none", inPreviewCanvas ? "hidden" : "hidden lg:flex lg:justify-center")}
          style={{ paddingTop: `${logoPadTop}px`, paddingBottom: `${logoPadBottom}px` }}
        >
          <Link
            to={localePath("/")}
            aria-label="Viterra Grupo Inmobiliario — Inicio"
            className="group relative flex w-full max-w-none justify-center overflow-visible"
          >
            <span className="absolute left-8 top-[calc(50%+12px)] z-10 -translate-y-1/2 overflow-visible sm:left-10">
              <span className="relative overflow-visible" style={{ width: markBoxW, height: markBoxH }}>
                <span
                  className="absolute inset-0 flex items-end justify-center overflow-visible transition-opacity duration-300 ease-out"
                  style={{ opacity: 1 - compactLeftMark, pointerEvents: compactLeftMark > 0.92 ? "none" : "auto" }}
                >
                  <ViterraMarkLeftHero
                    boxW={markBoxW}
                    boxH={markBoxH}
                    scale={markScale * MARK_MONO_SCALE_FACTOR}
                  />
                </span>
                <span
                  className="absolute inset-0 flex items-end justify-center overflow-visible transition-opacity duration-300 ease-out"
                  style={{ opacity: compactLeftMark, pointerEvents: compactLeftMark < 0.08 ? "none" : "auto" }}
                >
                  <ViterraMarkLeftScrolled boxW={markBoxW} boxH={markBoxH} scale={markScale} />
                </span>
              </span>
            </span>
            <span className="inline-flex min-w-[11rem] max-w-[16rem] flex-col items-stretch text-center">
              <span
                className="text-center font-light leading-tight text-white"
                style={{ fontSize: `${titleSize}px`, letterSpacing: `${lerp(0.18, 0.2, p)}em` }}
              >
                VITERRA
              </span>
              <span className="relative my-2 h-px w-full shrink-0 overflow-hidden rounded-full" aria-hidden>
                <span
                  className="absolute inset-0 origin-left bg-white"
                  style={{ opacity: guionWhite, transform: `scaleX(${lerp(1, 0.35, smoothstep01(p, 0.2, 0.55))})` }}
                />
                <span
                  className="absolute inset-0 origin-left bg-[#C8102E]"
                  style={{ opacity: guionRed, transform: `scaleX(${lerp(0.2, 1, smoothstep01(p, 0.15, 0.5))})` }}
                />
              </span>
              <div className="overflow-hidden text-center" style={{ maxHeight: `${subtitleMaxH}px`, opacity: subtitleOpacity }}>
                <p className="pt-0.5 text-[10px] font-normal uppercase tracking-[0.22em] text-white/70">Grupo Inmobiliario</p>
              </div>
            </span>
          </Link>
        </div>

        <div
          className={cn("relative overflow-visible border-t border-white/10", inPreviewCanvas ? "hidden" : "hidden lg:block")}
          style={{ minHeight: `${navRowH}px` }}
        >
          {/* Misma franja que la marca (`left-8` + `markBoxW`): alineación por centro óptico de la V → icono X (ver constantes arriba). */}
          <div className="pointer-events-none absolute inset-0 z-[55]">
            <div
              className="pointer-events-auto absolute left-8 top-0 z-[56] flex h-full items-center justify-start overflow-visible sm:left-10"
              style={{ width: markBoxW }}
            >
              <PreviewSectionChrome blockId="header-social" label="Redes del encabezado" compact hideLabel>
                <span className="inline-flex shrink-0" style={{ marginLeft: desktopSocialMarginLeft }}>
                  <SocialNavIcons iconSize="md" />
                </span>
              </PreviewSectionChrome>
            </div>
            {/* Espejo del bloque de redes: la franja derecha estaba libre. */}
            <div
              className="pointer-events-auto absolute right-8 top-0 z-[56] flex h-full items-center justify-end sm:right-10"
              style={{ width: markBoxW }}
            >
              <LanguageToggle />
            </div>
          </div>
          <nav
            className="absolute inset-0 flex items-stretch"
            style={{
              transform: `translateY(${navLift}px)`,
              paddingLeft: "clamp(9rem, 16vw, 12rem)",
              paddingRight: "clamp(9rem, 16vw, 12rem)",
            }}
          >
            <div className="flex min-w-0 flex-1 items-center justify-center" style={{ gap: `${navGap}px` }}>
              {VITERRA_NAV_ITEMS.map(([to, labelKey]) => {
                const active = isActiveNavPath(routePath, to);
                return (
                  <Link
                    key={`c-${to}`}
                    to={localePath(to)}
                    className={cn(navLinkClass, active && navLinkActiveClassCenter)}
                    style={{ fontSize: `${navFontPx}px`, letterSpacing: `${navTrackEm}em` }}
                    aria-current={active ? "page" : undefined}
                  >
                    {t(labelKey)}
                  </Link>
                );
              })}
              <Link
                to="/favoritos"
                aria-label={`Ver Favoritos (${count})`}
                className={cn(
                  "relative inline-flex items-center gap-1.5 font-normal uppercase text-white/85 transition-colors hover:text-white shrink-0",
                  isActiveNavPath(routePath, "/favoritos") && navLinkActiveClassCenter
                )}
                style={{ fontSize: `${navFontPx}px`, letterSpacing: `${navTrackEm}em` }}
              >
                <Heart
                  className={cn("h-3.5 w-3.5 transition-colors", count > 0 ? "fill-[#C8102E] text-[#C8102E]" : "text-white/85")}
                  strokeWidth={1.75}
                />
                <span>FAVORITOS</span>
                {count > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#C8102E] px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                    {count}
                  </span>
                )}
              </Link>
            </div>
          </nav>
        </div>

        <div
          className={cn(
            "relative grid min-h-[56px] grid-cols-[1fr_auto] items-center gap-2 border-t-0 px-2 py-1.5 sm:min-h-[52px] sm:grid-cols-[1fr_auto_1fr] sm:px-3",
            inPreviewCanvas ? "" : "lg:hidden"
          )}
        >
          <Link
            to={localePath("/")}
            className="relative z-[56] hidden min-w-0 max-w-full flex-col items-start justify-center gap-0.5 justify-self-start sm:inline-flex"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Viterra Grupo Inmobiliario — Inicio"
          >
            <span className="font-heading truncate text-[13px] font-medium tracking-[0.16em] text-white sm:tracking-[0.18em]">
              VITERRA
            </span>
            <span className="h-px w-7 shrink-0 bg-[#C8102E] sm:w-8" aria-hidden />
          </Link>
          <div className="absolute left-1/2 z-[52] flex min-w-0 -translate-x-1/2 flex-col items-center justify-center gap-1 overflow-visible sm:relative sm:left-auto sm:translate-x-0 sm:justify-self-center sm:gap-1.5">
            {/*
              Misma anchura que la caja del logo: así la fila de redes comparte el mismo marco horizontal
              que la marca y `justify-center` alinea el grupo de iconos con la V (evita que `w-full` herede
              un ancho distinto del de la columna en grid / flex).
            */}
            <div
              className="inline-flex flex-col items-center gap-1"
              style={{ width: markBoxWMobile, maxWidth: "100%" }}
            >
              <Link
                to={localePath("/")}
                className="flex w-full shrink-0 items-center justify-center overflow-visible rounded-sm"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Viterra Grupo Inmobiliario — Inicio"
              >
                <span
                  className="relative shrink-0 overflow-hidden rounded-sm"
                  style={{ width: markBoxWMobile, height: markBoxHMobile }}
                >
                  <span
                    className="absolute inset-0 flex items-end justify-center overflow-hidden transition-opacity duration-200 ease-out"
                    style={{ opacity: 1 - compactLeftMark, pointerEvents: compactLeftMark > 0.92 ? "none" : "auto" }}
                  >
                    <ViterraMarkLeftHero
                      boxW={markBoxWMobile}
                      boxH={markBoxHMobile}
                      scale={MOBILE_HEADER_MARK_SCALE}
                      enableTransformTransition={false}
                    />
                  </span>
                  <span
                    className="absolute inset-0 flex items-end justify-center overflow-hidden transition-opacity duration-200 ease-out"
                    style={{ opacity: compactLeftMark, pointerEvents: compactLeftMark < 0.08 ? "none" : "auto" }}
                  >
                    <ViterraMarkLeftScrolled
                      boxW={markBoxWMobile}
                      boxH={markBoxHMobile}
                      scale={MOBILE_HEADER_MARK_SCALE}
                      enableTransformTransition={false}
                    />
                  </span>
                </span>
              </Link>
              <div className="mt-0.5 flex w-full shrink-0 justify-center">
                <SocialNavIcons iconSize="xs" />
              </div>
            </div>
          </div>
          <div className="relative col-start-2 z-[56] flex items-center justify-end gap-1 justify-self-end sm:col-start-3">
            <Link
              to="/favoritos"
              aria-label={`Favoritos (${count})`}
              className="relative p-2 text-white transition-colors hover:text-white/80"
              onClick={() => setIsMenuOpen(false)}
            >
              <Heart className={cn("h-5 w-5", count > 0 && "fill-[#C8102E] text-[#C8102E]")} strokeWidth={1.5} />
              {count > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#C8102E] px-1 text-[9px] font-bold leading-none text-white">
                  {count}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="shrink-0 p-2 text-white"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X className="h-6 w-6" strokeWidth={1.5} /> : <Menu className="h-6 w-6" strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <nav
          className={cn(
            "max-h-[min(70vh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-5rem))] overflow-y-auto overscroll-contain border-t border-white/10",
            inPreviewCanvas ? "block" : "lg:hidden"
          )}
          style={{
            backgroundColor: `rgba(${NAVY.r},${NAVY.g},${NAVY.b},${lerp(MOBILE_MENU_BG_ALPHA_TOP, BG_ALPHA_MAX, p)})`,
            backdropFilter: `saturate(140%) blur(${lerp(20, 16, p)}px)`,
            WebkitBackdropFilter: `saturate(140%) blur(${lerp(20, 16, p)}px)`,
            transition: "background-color 0.35s ease, backdrop-filter 0.35s ease, -webkit-backdrop-filter 0.35s ease",
          }}
        >
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-5 sm:px-6 sm:py-6">
            {VITERRA_NAV_ITEMS.map(([to, labelKey]) => {
              const active = isActiveNavPath(routePath, to);
              return (
                <Link
                  key={to}
                  to={localePath(to)}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "block border-l-[3px] py-3 pl-4 text-sm uppercase tracking-[0.14em] transition-colors",
                    active
                      ? "border-primary font-semibold text-white"
                      : "border-transparent text-white/90 hover:text-white"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {t(labelKey)}
                </Link>
              );
            })}
            <Link
              to="/favoritos"
              onClick={() => setIsMenuOpen(false)}
              className={cn(
                "flex items-center justify-between border-l-[3px] py-3 pl-4 pr-3 text-sm uppercase tracking-[0.14em] transition-colors",
                isActiveNavPath(routePath, "/favoritos")
                  ? "border-primary font-semibold text-white"
                  : "border-transparent text-white/90 hover:text-white"
              )}
              aria-current={isActiveNavPath(routePath, "/favoritos") ? "page" : undefined}
            >
              <span className="flex items-center gap-2">
                <Heart className={cn("h-4 w-4", count > 0 && "fill-[#C8102E] text-[#C8102E]")} />
                Favoritos
              </span>
              {count > 0 && (
                <span className="rounded-full bg-[#C8102E] px-2 py-0.5 text-xs font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
            <div className="pt-3">
              <div className="border-t border-white/10 pt-3">
                <div className="flex items-center justify-center pb-3">
                  <LanguageToggle />
                </div>
                <div className="flex items-center justify-center">
                  <SocialNavIcons iconSize="sm" />
                </div>
              </div>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
