import { createBrowserRouter, Navigate } from "react-router";
import type { ComponentType } from "react";
import { RootLayout } from "./RootLayout";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { RouteErrorFallback } from "./components/ErrorBoundary";
import { ViterraPageLoader } from "./components/ViterraPageLoader";
import { SitePreviewFramePage } from "./pages/admin/SitePreviewFramePage";
import { LOCALES, LOCALE_PATH_PREFIX } from "./i18n/locale";

const lazyPage = (loader: () => Promise<{ [key: string]: unknown }>, exportName: string) => async () => {
  const mod = await loader();
  const Component = mod[exportName];
  if (!Component) {
    throw new Error(`No se encontró export "${exportName}" en módulo de ruta.`);
  }
  return { Component: Component as ComponentType };
};

type PublicPage = {
  /** Ruta canónica en español, sin prefijo de idioma. */
  path: string;
  load: () => Promise<{ [key: string]: unknown }>;
  exportName: string;
};

/**
 * Páginas públicas. El orden importa: las rutas más específicas
 * (`/propiedades/mapa`) van antes que las paramétricas (`/propiedades/:id`).
 */
const PUBLIC_PAGES: PublicPage[] = [
  { path: "/", load: () => import("./pages/HomePage"), exportName: "HomePage" },
  { path: "/renta", load: () => import("./pages/RentPage"), exportName: "RentPage" },
  { path: "/venta", load: () => import("./pages/SalePage"), exportName: "SalePage" },
  { path: "/servicios/d/:slug", load: () => import("./pages/ServiceDetailPage"), exportName: "ServiceDetailPage" },
  { path: "/servicios", load: () => import("./pages/ServicesPage"), exportName: "ServicesPage" },
  { path: "/propiedades/mapa", load: () => import("./pages/MapSearchPage"), exportName: "MapSearchPage" },
  { path: "/propiedades", load: () => import("./pages/PropertiesRedirectPage"), exportName: "PropertiesRedirectPage" },
  { path: "/propiedades/:id", load: () => import("./pages/PropertyDetailPage"), exportName: "PropertyDetailPage" },
  { path: "/desarrollos", load: () => import("./pages/DevelopmentsPage"), exportName: "DevelopmentsPage" },
  { path: "/desarrollos/:id", load: () => import("./pages/DevelopmentDetailPage"), exportName: "DevelopmentDetailPage" },
  { path: "/nosotros", load: () => import("./pages/AboutPage"), exportName: "AboutPage" },
  { path: "/contacto", load: () => import("./pages/ContactPage"), exportName: "ContactPage" },
  { path: "/favoritos", load: () => import("./pages/WishlistPage"), exportName: "WishlistPage" },
  { path: "/aviso-de-privacidad", load: () => import("./pages/AvisoDePrivacidadPage"), exportName: "AvisoDePrivacidadPage" },
];

/** Mismo árbol público bajo cada prefijo de idioma (`/renta` y `/en/renta`). */
function publicRoutesForLocale(prefix: string) {
  return PUBLIC_PAGES.map((page) => ({
    path: prefix ? `${prefix}${page.path === "/" ? "" : page.path}` : page.path,
    lazy: lazyPage(page.load, page.exportName),
  }));
}

const localizedPublicRoutes = LOCALES.flatMap((locale) =>
  publicRoutesForLocale(LOCALE_PATH_PREFIX[locale]),
);

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorFallback />,
    // Se muestra mientras el módulo `lazy` de la ruta inicial se carga en la primera
    // hidratación; sin esto React Router avisa "No HydrateFallback element provided".
    hydrateFallbackElement: <ViterraPageLoader />,
    children: [
      ...localizedPublicRoutes,
      /**
       * El admin y el login no se traducen: son herramientas internas y
       * duplicarlos bajo `/en` solo agregaría rutas que nadie visita.
       */
      {
        path: "/login",
        lazy: lazyPage(() => import("./pages/LoginPage"), "LoginPage"),
      },
      {
        path: "/admin/cambiar-contrasena",
        lazy: lazyPage(() => import("./pages/FirstLoginChangePasswordPage"), "FirstLoginChangePasswordPage"),
      },
      /** Iframe del editor: ruta fuera de `/admin/*` para no cargar el CRM por error. */
      {
        path: "/site-preview-frame",
        Component: SitePreviewFramePage,
      },
      {
        path: "/admin/site-preview-frame",
        element: <Navigate to="/site-preview-frame" replace />,
      },
      {
        path: "/admin",
        /** Contenedor mínimo: eager para que al refrescar no espere un chunk vacío antes del workspace. */
        Component: AdminLayout,
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          {
            path: "*",
            lazy: lazyPage(() => import("./pages/admin/AdminWorkspace"), "AdminWorkspace"),
          },
        ],
      },
      {
        path: "*",
        lazy: lazyPage(() => import("./pages/NotFoundPage"), "NotFoundPage"),
      },
    ],
  },
]);
