import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { AuthProvider } from "./contexts/AuthContext";
import { WishlistProvider } from "./contexts/WishlistContext";
import { ScrollToTop } from "./components/ScrollToTop";
import { trackPageView } from "./lib/googleAnalytics";
import { LocaleProvider, useLocale } from "./i18n/LocaleContext";
import { isAdminSurfacePath } from "./i18n/locale";
import { SiteContentLocaleSync } from "../contexts/SiteContentContext";

/**
 * Puente entre el idioma de la ruta y el contenido del CMS: `SiteContentProvider`
 * está por encima del router y no puede leer la ubicación.
 *
 * En el admin NO se sincroniza: sus rutas (`/admin/...`) no llevan prefijo de
 * idioma, así que el puente las leería como español y revertiría el selector
 * ES/EN del editor en cuanto el usuario lo pulsa. Dentro del admin la autoridad
 * sobre el idioma editado es ese selector.
 */
function ContentLocaleBridge() {
  const { locale } = useLocale();
  const { pathname } = useLocation();
  if (isAdminSurfacePath(pathname)) return null;
  return <SiteContentLocaleSync locale={locale} />;
}

/**
 * Sin Motion/AnimatePresence en el shell: en Safari el contenedor absoluto + animación
 * de opacidad a veces dejaba la ruta invisible (pantalla blanca) sin errores en consola.
 *
 * Auth debajo del Router para poder omitir consultas a `tokko_users` en rutas públicas (landing).
 */
export function RootLayout() {
  const location = useLocation();
  const pageKey = `${location.pathname}${location.search}`;

  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  return (
    <div className="relative isolate min-h-[100dvh] bg-brand-canvas">
      <ScrollToTop />
      <LocaleProvider>
        <ContentLocaleBridge />
        <AuthProvider>
          <WishlistProvider>
            <div
              key={pageKey}
              className="min-h-[100dvh] w-full overflow-x-clip bg-brand-canvas"
            >
              <Outlet />
            </div>
          </WishlistProvider>
        </AuthProvider>
      </LocaleProvider>
    </div>
  );
}

