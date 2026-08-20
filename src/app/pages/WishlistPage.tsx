import { useMemo } from "react";
import { Link } from "react-router";
import { Heart, Trash2, ArrowRight, MapPin, Building2 } from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { PropertyCard } from "../components/PropertyCard";
import { useWishlist } from "../contexts/WishlistContext";
import { useCatalogProperties } from "../hooks/useCatalogProperties";

const T = {
  canvas: "#f4f2ef",
  navy: "#141c2e",
  gold: "#9a7b4f",
  goldFaint: "rgba(154,123,79,0.12)",
  border: "rgba(20,28,46,0.1)",
  muted: "rgba(20,28,46,0.55)",
} as const;

export function WishlistPage() {
  const { favoriteIds, clearFavorites, count } = useWishlist();
  const { properties, loading } = useCatalogProperties();

  const favoriteProperties = useMemo(() => {
    if (favoriteIds.length === 0) return [];
    return properties.filter((p) => favoriteIds.includes(p.id));
  }, [favoriteIds, properties]);

  return (
    <div className="viterra-page flex min-h-screen flex-col bg-brand-canvas" style={{ background: T.canvas }}>
      <Header />

      <main className="flex-1">
        {/* Banner Hero */}
        <section className="relative border-b border-brand-navy/10 bg-brand-navy px-4 py-12 text-white sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                  <Heart className="h-3.5 w-3.5 fill-primary text-primary" />
                  Lista de Deseos
                </span>
                <h1 className="font-heading mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Mis Favoritos
                </h1>
                <p className="mt-2 text-sm text-white/80 sm:text-base">
                  Tus propiedades guardadas en este dispositivo para consultar en cualquier momento.
                </p>
              </div>

              {count > 0 && (
                <div className="flex items-center gap-3">
                  <span className="rounded-md border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-white">
                    {count} {count === 1 ? "Propiedad guardada" : "Propiedades guardadas"}
                  </span>
                  <button
                    type="button"
                    onClick={clearFavorites}
                    className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-white/90 transition-colors hover:border-red-400 hover:bg-red-500/20 hover:text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Vaciar lista
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          {loading && favoriteProperties.length === 0 && count > 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
                Cargando tus propiedades favoritas...
              </p>
            </div>
          ) : favoriteProperties.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {favoriteProperties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto my-8 max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-primary">
                <Heart className="h-8 w-8 stroke-[1.5]" />
              </div>
              <h2 className="font-heading mt-5 text-2xl font-bold text-slate-900">
                Aún no tienes favoritos guardados
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Guarda las propiedades que más te gusten haciendo clic en el ícono de corazón disponible en los listados y fichas de detalle.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  to="/venta"
                  className="inline-flex items-center justify-center gap-2 rounded-none bg-[#C8102E] px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-sm transition-all hover:bg-[#a00d25]"
                >
                  <Building2 className="h-4 w-4" />
                  Ver en Venta
                </Link>
                <Link
                  to="/renta"
                  className="inline-flex items-center justify-center gap-2 rounded-none border border-slate-300 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-900 transition-all hover:border-slate-400 hover:bg-slate-50"
                >
                  <Building2 className="h-4 w-4" />
                  Ver en Renta
                </Link>
                <Link
                  to="/propiedades/mapa"
                  className="inline-flex items-center justify-center gap-2 rounded-none border border-slate-300 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-900 transition-all hover:border-slate-400 hover:bg-slate-50"
                >
                  <MapPin className="h-4 w-4" />
                  Buscar en Mapa
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
