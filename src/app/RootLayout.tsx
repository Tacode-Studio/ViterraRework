import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { AuthProvider } from "./contexts/AuthContext";
import { WishlistProvider } from "./contexts/WishlistContext";
import { ScrollToTop } from "./components/ScrollToTop";
import { trackPageView } from "./lib/googleAnalytics";

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
    </div>
  );
}

