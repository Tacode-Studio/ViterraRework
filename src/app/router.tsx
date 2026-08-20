import { createBrowserRouter, Navigate } from "react-router";
import type { ComponentType } from "react";
import { RootLayout } from "./RootLayout";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { RouteErrorFallback } from "./components/ErrorBoundary";
import { ViterraPageLoader } from "./components/ViterraPageLoader";
import { SitePreviewFramePage } from "./pages/admin/SitePreviewFramePage";

const lazyPage = (loader: () => Promise<{ [key: string]: unknown }>, exportName: string) => async () => {
  const mod = await loader();
  const Component = mod[exportName];
  if (!Component) {
    throw new Error(`No se encontró export "${exportName}" en módulo de ruta.`);
  }
  return { Component: Component as ComponentType };
};

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorFallback />,
    // Se muestra mientras el módulo `lazy` de la ruta inicial se carga en la primera
    // hidratación; sin esto React Router avisa "No HydrateFallback element provided".
    hydrateFallbackElement: <ViterraPageLoader />,
    children: [
      {
        path: "/",
        lazy: lazyPage(() => import("./pages/HomePage"), "HomePage"),
      },
      {
        path: "/renta",
        lazy: lazyPage(() => import("./pages/RentPage"), "RentPage"),
      },
      {
        path: "/venta",
        lazy: lazyPage(() => import("./pages/SalePage"), "SalePage"),
      },
      {
        path: "/servicios/d/:slug",
        lazy: lazyPage(() => import("./pages/ServiceDetailPage"), "ServiceDetailPage"),
      },
      {
        path: "/servicios",
        lazy: lazyPage(() => import("./pages/ServicesPage"), "ServicesPage"),
      },
      {
        path: "/propiedades/mapa",
        lazy: lazyPage(() => import("./pages/MapSearchPage"), "MapSearchPage"),
      },
      {
        path: "/propiedades",
        lazy: lazyPage(() => import("./pages/PropertiesRedirectPage"), "PropertiesRedirectPage"),
      },
      {
        path: "/propiedades/:id",
        lazy: lazyPage(() => import("./pages/PropertyDetailPage"), "PropertyDetailPage"),
      },
      {
        path: "/desarrollos",
        lazy: lazyPage(() => import("./pages/DevelopmentsPage"), "DevelopmentsPage"),
      },
      {
        path: "/desarrollos/:id",
        lazy: lazyPage(() => import("./pages/DevelopmentDetailPage"), "DevelopmentDetailPage"),
      },
      {
        path: "/nosotros",
        lazy: lazyPage(() => import("./pages/AboutPage"), "AboutPage"),
      },
      {
        path: "/contacto",
        lazy: lazyPage(() => import("./pages/ContactPage"), "ContactPage"),
      },
      {
        path: "/favoritos",
        lazy: lazyPage(() => import("./pages/WishlistPage"), "WishlistPage"),
      },
      {
        path: "/aviso-de-privacidad",
        lazy: lazyPage(() => import("./pages/AvisoDePrivacidadPage"), "AvisoDePrivacidadPage"),
      },
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
