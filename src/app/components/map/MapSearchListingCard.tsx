import { Link } from "react-router";
import { Heart, Star } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { cn } from "../ui/utils";
import { propertyStatusLabel, type Property } from "../PropertyCard";
import { useWishlist } from "../../contexts/WishlistContext";

function demoRating(id: string): string {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (4.75 + (n % 25) / 100).toFixed(2);
}

type Props = {
  property: Property;
  selected: boolean;
  onSelect: () => void;
};

export function MapSearchListingCard({ property, selected, onSelect }: Props) {
  const { isFavorite, toggleFavorite } = useWishlist();
  const saved = isFavorite(property.id);
  const rating = demoRating(property.id);
  const isDual = property.status === "venta_y_alquiler";

  return (
    <article
      className={cn(
        "group cursor-pointer overflow-hidden border-2 border-slate-200 bg-white transition-shadow",
        selected
          ? "border-brand-navy shadow-[0_6px_20px_rgba(0,0,0,0.12)] ring-2 ring-brand-navy ring-offset-2"
          : "shadow-sm hover:border-slate-300 hover:shadow-md"
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="button"
    >
      <div className="relative aspect-[20/19] w-full overflow-hidden bg-slate-100">
        <ImageWithFallback
          src={property.image}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          optimizeWidth={320}
        />
        <span className="absolute left-2 top-2 border border-slate-200 bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-slate-900 shadow-sm">
          {propertyStatusLabel(property.status)}
        </span>
        <button
          type="button"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center border-2 border-slate-200 bg-white/95 text-slate-700 shadow-sm transition-colors hover:border-slate-300"
          aria-label={saved ? "Quitar de favoritos" : "Guardar en favoritos"}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(property.id);
          }}
        >
          <Heart
            className={cn("h-4 w-4", saved && "fill-primary text-primary")}
            strokeWidth={1.5}
          />
        </button>
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
          <span className="h-1 w-1 bg-white shadow-sm" aria-hidden />
        </div>
      </div>

      <div className="p-3 pt-2.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-[15px] font-semibold leading-tight text-slate-900">{property.title}</h3>
          <span className="flex shrink-0 items-center gap-0.5 text-[13px] text-slate-900">
            <Star className="h-3.5 w-3.5 fill-slate-900 text-slate-900" aria-hidden />
            {rating}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[13px] text-slate-500">
          {property.type} · {property.bedrooms} rec. · {property.area} m²
        </p>
        {isDual && (
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
            Se puede comprar o rentar
          </p>
        )}
        {(property.status === "venta" || isDual) && (
          <p className="mt-1 text-[15px] text-slate-900">
            <span className="font-semibold tabular-nums">${property.price.toLocaleString()}</span>
            <span className="text-[13px] font-normal text-slate-600">
              {isDual ? " venta" : " MXN"}
            </span>
          </p>
        )}
        {(property.status === "alquiler" || isDual) && (
          <p className={cn("text-slate-900", isDual ? "text-[13px] text-slate-600" : "mt-1 text-[15px]")}>
            <span className={cn("tabular-nums", isDual ? "font-medium" : "font-semibold")}>
              ${(property.rentalPrice ?? property.price).toLocaleString()}
            </span>
            <span className="font-normal text-slate-600"> / mes</span>
          </p>
        )}
        <Link
          to={`/propiedades/${property.id}`}
          className="mt-2 block text-center text-[12px] font-medium text-primary underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Ver ficha
        </Link>
      </div>
    </article>
  );
}
