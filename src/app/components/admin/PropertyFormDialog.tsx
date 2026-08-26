import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { cn } from "../ui/utils";
import { copyPublicPageUrl } from "../../lib/copyPublicLink";
import type { Property } from "../PropertyCard";
import type { Development } from "../../data/developments";
import {
  Building2,
  ChevronRight,
  ExternalLink,
  FileText,
  ImageIcon,
  Link2,
  ListChecks,
  MapPin,
  Phone,
  Ruler,
  Sparkles,
  X,
} from "lucide-react";
import { MAX_FEATURED_PROPERTIES } from "../../lib/supabaseProperties";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { uploadPropertyImage } from "../../lib/supabasePropertyMedia";
import { isValidWhatsappLinkInput } from "../../lib/whatsappLink";
import { PropertyAmenitiesEditor } from "./propertyForm/PropertyAmenitiesEditor";
import { RichDescriptionEditor } from "./propertyForm/RichDescriptionEditor";
import { PropertyContactSection } from "./propertyForm/PropertyContactSection";
import { PropertyFormPreview } from "./propertyForm/PropertyFormPreview";
import { PropertyLocationSection } from "./propertyForm/PropertyLocationSection";
import { PropertyDetailsSection } from "./propertyForm/PropertyDetailsSection";
import { PropertyMediaTab } from "./propertyForm/PropertyMediaTab";
import { PropertyTechnicalSection } from "./propertyForm/PropertyTechnicalSection";
import {
  PROPERTY_FORM_STEPS,
  PropertyField,
  PropertyFieldGrid,
  PropertyFormSection,
  PropertyFormStepId,
  propertyFieldClass,
  propertyTextareaClass,
} from "./propertyForm/propertyFormUi";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  property: Property | null;
  newId: string;
  onSave: (property: Property) => void;
  otherFeaturedCount: number;
  developments?: Development[];
  developmentsLoading?: boolean;
  catalogProperties?: Property[];
};

const STEP_ICONS: Record<PropertyFormStepId, typeof ImageIcon> = {
  medios: ImageIcon,
  ficha: FileText,
  ubicacion: MapPin,
  tecnica: Ruler,
  detalles: Building2,
  amenidades: ListChecks,
  contacto: Phone,
};

const defaultImage =
  "https://images.unsplash.com/photo-1520106392146-ef585c111254?w=1080&q=80";

/**
 * El sitio público prioriza "Título de publicación" sobre "Título" (para copy de Tokko
 * más descriptivo, ver cardHeadline() en PropertyCard.tsx). Si antes de este cambio ambos
 * coincidían (publicationTitle solo reflejaba el título viejo, no una copia personalizada)
 * y aquí se editó el título sin tocar el de publicación, hay que sincronizarlo — si no, el
 * sitio seguiría mostrando el título viejo aunque el admin ya haya "guardado" el nuevo.
 */
export function resolvePublicationTitleOnSave(
  mode: "create" | "edit",
  original: Property | null,
  draft: Pick<Property, "title" | "publicationTitle">,
): string | undefined {
  if (mode !== "edit" || !original) return draft.publicationTitle;

  const titleChanged = draft.title !== original.title;
  const publicationTitleUntouched = draft.publicationTitle === original.publicationTitle;
  const publicationTitleWasMirroringOldTitle =
    (original.publicationTitle?.trim() || "") === original.title.trim();

  return titleChanged && publicationTitleUntouched && publicationTitleWasMirroringOldTitle
    ? draft.title
    : draft.publicationTitle;
}

function emptyDraft(id: string): Property {
  return {
    id,
    title: "",
    price: 0,
    location: "",
    bedrooms: 2,
    bathrooms: 2,
    area: 100,
    image: defaultImage,
    images: [defaultImage],
    type: "",
    status: "venta",
    featured: false,
    coordinates: { lat: 20.676208, lng: -103.34721 },
    amenities: [],
    services: [],
    additionalFeatures: [],
    colony: "",
    fullAddress: "",
    description: "",
    richDescription: "",
    referenceCode: "",
    publicationTitle: "",
    parkingSpaces: 0,
    contactPhone: "",
    contactWhatsapp: "",
    videos: [],
    tours3d: [],
  };
}

export function PropertyFormDialog({
  open,
  onOpenChange,
  mode,
  property,
  newId,
  onSave,
  otherFeaturedCount,
  developments = [],
  developmentsLoading = false,
  catalogProperties = [],
}: Props) {
  const [draft, setDraft] = useState<Property | null>(null);
  const [activeStep, setActiveStep] = useState<PropertyFormStepId>("medios");
  const propertyId = mode === "create" ? newId : property?.id ?? newId;
  const client = getSupabaseClient();

  const uploadImage = useCallback(
    async (file: File) => {
      if (!client) throw new Error("Supabase no está configurado.");
      return uploadPropertyImage(client, propertyId, file);
    },
    [client, propertyId],
  );

  useEffect(() => {
    if (!open) return;
    setActiveStep("medios");
    if (mode === "edit" && property) {
      const gallery =
        property.images?.length
          ? [...property.images]
          : property.image
            ? [property.image]
            : [defaultImage];
      setDraft({
        ...property,
        image: gallery[0] ?? property.image,
        images: gallery,
        amenities: property.amenities ?? [],
        services: property.services ?? [],
        additionalFeatures: property.additionalFeatures ?? [],
        coordinates: property.coordinates ?? { lat: 20.676208, lng: -103.34721 },
      });
    } else if (mode === "create") {
      setDraft(emptyDraft(newId));
    }
  }, [open, mode, property, newId]);

  const patchDraft = (patch: Partial<Property>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!draft.title.trim()) {
      window.alert("Indica un título para la propiedad.");
      setActiveStep("ficha");
      return;
    }
    if (draft.contactWhatsapp?.trim() && !isValidWhatsappLinkInput(draft.contactWhatsapp)) {
      window.alert("El enlace de WhatsApp debe ser una URL (https://…) o un número con lada.");
      setActiveStep("contacto");
      return;
    }
    const lat = draft.coordinates?.lat;
    const lng = draft.coordinates?.lng;
    if (lat != null && (lat < -90 || lat > 90)) {
      window.alert("Latitud inválida.");
      setActiveStep("ubicacion");
      return;
    }
    if (lng != null && (lng < -180 || lng > 180)) {
      window.alert("Longitud inválida.");
      setActiveStep("ubicacion");
      return;
    }
    const imgs =
      draft.images && draft.images.length > 0
        ? draft.images
        : draft.image
          ? [draft.image]
          : [defaultImage];
    const wasFeatured = mode === "edit" && property ? Boolean(property.featured) : false;
    if (draft.featured && !wasFeatured && otherFeaturedCount >= MAX_FEATURED_PROPERTIES) {
      window.alert(`Solo pueden destacarse hasta ${MAX_FEATURED_PROPERTIES} propiedades.`);
      return;
    }

    const syncedPublicationTitle = resolvePublicationTitleOnSave(mode, property, draft);

    onSave({
      ...draft,
      id: propertyId,
      price: Number(draft.price) || 0,
      rentalPrice:
        draft.status === "venta"
          ? undefined
          : Number(draft.rentalPrice) || undefined,
      bedrooms: Number(draft.bedrooms) || 0,
      bathrooms: Number(draft.bathrooms) || 0,
      area: Number(draft.area) || 0,
      image: imgs[0] ?? defaultImage,
      images: imgs,
      galleryImages: imgs,
      featured: Boolean(draft.featured),
      publicationTitle: syncedPublicationTitle,
    });
    onOpenChange(false);
  };

  if (mode === "edit" && !property) return null;

  const stepIndex = PROPERTY_FORM_STEPS.findIndex((s) => s.id === activeStep);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      key={mode === "edit" && property ? property.id : `create-${newId}`}
    >
      <DialogContent
        hideCloseButton
        className={cn(
          "!fixed !inset-0 !left-0 !top-0 z-50 flex !h-[100dvh] !max-h-[100dvh] !w-full !max-w-none !translate-x-0 !translate-y-0 flex-row gap-0 overflow-hidden rounded-none border-0 bg-stone-100 p-0 shadow-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        )}
      >
        {/* Nombre y descripción accesibles del diálogo (Radix los exige en DialogContent).
            Van fuera del condicional para estar presentes también durante «Cargando…». */}
        <DialogTitle className="sr-only">
          {mode === "create" ? "Nueva propiedad" : "Editar propiedad"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Formulario para {mode === "create" ? "crear" : "editar"} una propiedad del catálogo.
        </DialogDescription>
        {!draft ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Cargando…</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 w-full flex-1">
            {/* Navegación lateral */}
            <aside className="hidden w-[17rem] shrink-0 flex-col border-r border-white/10 bg-[#0d1117] text-white md:flex">
              <div className="border-b border-white/10 px-5 py-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">Propiedades</p>
                <h2 className="font-heading mt-1 text-xl font-semibold tracking-tight">
                  {mode === "create" ? "Nueva propiedad" : "Editar propiedad"}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-white/65">
                  Paso {stepIndex + 1} de {PROPERTY_FORM_STEPS.length}
                </p>
              </div>
              <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
                {PROPERTY_FORM_STEPS.map((step, i) => {
                  const Icon = STEP_ICONS[step.id];
                  const active = activeStep === step.id;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setActiveStep(step.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition",
                        active
                          ? "bg-white/12 text-white ring-1 ring-white/20 font-medium"
                          : "text-white/75 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-colors",
                          active ? "bg-slate-800 text-white ring-1 ring-slate-700 shadow-sm" : "bg-white/10 text-white/80",
                        )}
                      >
                        {active ? <Icon className="h-4 w-4 text-white" /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{step.label}</span>
                        <span className="block text-[11px] text-white/55">{step.short}</span>
                      </span>
                      {active ? <ChevronRight className="h-4 w-4 shrink-0 opacity-80" /> : null}
                    </button>
                  );
                })}
              </nav>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
              {/* Barra superior */}
              <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-stone-200/90 bg-white px-4 py-3 sm:px-6">
                <div className="min-w-0 flex-1 md:hidden">
                  <p className="font-heading text-lg font-semibold text-brand-navy">
                    {mode === "create" ? "Nueva propiedad" : "Editar"}
                  </p>
                </div>
                <select
                  className="md:hidden rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium"
                  value={activeStep}
                  onChange={(e) => setActiveStep(e.target.value as PropertyFormStepId)}
                >
                  {PROPERTY_FORM_STEPS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="icon" className="rounded-xl" onClick={() => copyPublicPageUrl(`/propiedades/${draft.id}`)}>
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => window.open(`/propiedades/${draft.id}`, "_blank", "noopener")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Ver en sitio
                  </Button>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="rounded-xl">
                      <X className="mr-2 h-4 w-4" />
                      Cerrar
                    </Button>
                  </DialogClose>
                  <Button type="submit" className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 border border-slate-800 px-5 font-semibold shadow-sm transition-colors">
                    {mode === "create" ? "Crear propiedad" : "Guardar"}
                  </Button>
                </div>
              </header>

              <div className="flex min-h-0 flex-1">
                <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 lg:px-10">
                  <div className="mx-auto max-w-3xl space-y-6">
                    {activeStep === "medios" && (
                      <PropertyMediaTab
                        client={client}
                        propertyId={propertyId}
                        draft={draft}
                        onDraftChange={patchDraft}
                        onImagesChange={(next) =>
                          patchDraft({ images: next, image: next[0] ?? defaultImage, galleryImages: next })
                        }
                        onUploadImage={client ? uploadImage : undefined}
                      />
                    )}

                    {activeStep === "ficha" && (
                      <PropertyFormSection
                        icon={FileText}
                        title="Información principal"
                        description="Título, precio y descripción pública. Las anotaciones son solo internas."
                      >
                        <div className="mb-5 rounded-xl border border-amber-200/60 bg-gradient-to-r from-amber-50 to-amber-50/30 px-4 py-3">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-5 w-5 text-amber-600" />
                              <span className="text-sm font-semibold text-amber-950">
                                Destacar en portada del sitio
                              </span>
                            </div>
                            <Switch
                              checked={Boolean(draft.featured)}
                              disabled={!draft.featured && otherFeaturedCount >= MAX_FEATURED_PROPERTIES}
                              onCheckedChange={(v) => patchDraft({ featured: v })}
                            />
                          </div>
                          {!draft.featured && otherFeaturedCount >= MAX_FEATURED_PROPERTIES ? (
                            <p className="mt-2 text-xs text-amber-900/90">
                              Ya hay {MAX_FEATURED_PROPERTIES} propiedades destacadas. Quita una estrella en otra ficha
                              para poder destacar esta.
                            </p>
                          ) : (
                            <p className="mt-2 text-xs text-amber-900/70">
                              {otherFeaturedCount}/{MAX_FEATURED_PROPERTIES} destacadas en portada. Se guarda al crear o
                              actualizar la propiedad.
                            </p>
                          )}
                        </div>
                        <PropertyFieldGrid>
                          <PropertyField label="Título" span={2}>
                            <input
                              required
                              className={propertyFieldClass}
                              value={draft.title}
                              onChange={(e) => patchDraft({ title: e.target.value })}
                              placeholder="Ej. Casa con vista al parque"
                            />
                          </PropertyField>
                          <PropertyField
                            label="Título de publicación (opcional)"
                            span={2}
                            hint="Si tiene texto, esto es lo que se muestra en el sitio público en vez de «Título»."
                          >
                            <input
                              className={propertyFieldClass}
                              value={draft.publicationTitle ?? ""}
                              onChange={(e) => patchDraft({ publicationTitle: e.target.value })}
                            />
                          </PropertyField>
                          <PropertyField label="Precio (MXN)">
                            <input
                              type="number"
                              min={0}
                              className={propertyFieldClass}
                              value={draft.price || ""}
                              onChange={(e) => patchDraft({ price: Number(e.target.value) })}
                            />
                          </PropertyField>
                          <PropertyField label="Operación">
                            <select
                              className={propertyFieldClass}
                              value={draft.status}
                              onChange={(e) => patchDraft({ status: e.target.value as Property["status"] })}
                            >
                              <option value="venta">Venta</option>
                              <option value="alquiler">Renta</option>
                              <option value="venta_y_alquiler">Venta y Renta</option>
                            </select>
                          </PropertyField>
                          {(draft.status === "alquiler" || draft.status === "venta_y_alquiler") && (
                            <PropertyField label="Precio de Renta (MXN/mes)">
                              <input
                                type="number"
                                min={0}
                                className={propertyFieldClass}
                                value={draft.rentalPrice || ""}
                                onChange={(e) => patchDraft({ rentalPrice: Number(e.target.value) || undefined })}
                                placeholder="Opcional"
                              />
                            </PropertyField>
                          )}
                          <PropertyField
                            label="ID"
                            hint={
                              mode === "create"
                                ? "Se asigna solo al guardar: número de 7 dígitos único (bloque 9xxxxxxx) y referencia VAP + ID."
                                : "Identificador del CRM; no se modifica al editar."
                            }
                          >
                            <div
                              className={cn(
                                propertyFieldClass,
                                "flex items-center bg-stone-50 font-mono text-sm tabular-nums text-brand-navy",
                              )}
                            >
                              {mode === "edit" && draft.tokkoId?.trim() ? (
                                draft.tokkoId.trim()
                              ) : (
                                <span className="text-slate-500">Automático al crear</span>
                              )}
                            </div>
                          </PropertyField>
                          {(mode === "edit" && draft.referenceCode?.trim()) ||
                          mode === "create" ? (
                            <PropertyField label="Referencia en ficha" span={2}>
                              <div
                                className={cn(
                                  propertyFieldClass,
                                  "bg-stone-50 text-sm text-slate-700",
                                )}
                              >
                                {mode === "edit" && draft.referenceCode?.trim()
                                  ? draft.referenceCode.trim()
                                  : "Se generará como VAP + ID (ej. VAP9000000)"}
                              </div>
                            </PropertyField>
                          ) : null}
                          <PropertyField
                            label="Anotaciones"
                            span={2}
                            hint="Pensado para notas del equipo. En el sitio solo se muestra si la descripción con formato está vacía."
                          >
                            <textarea
                              className={propertyTextareaClass}
                              value={draft.description ?? ""}
                              onChange={(e) => patchDraft({ description: e.target.value })}
                              placeholder="Notas internas o texto de respaldo…"
                            />
                          </PropertyField>
                          <PropertyField
                            label="Descripción con formato"
                            span={2}
                            hint="Es lo que ven los visitantes. Si la dejas vacía, se usará el texto de anotaciones como respaldo."
                          >
                            <RichDescriptionEditor
                              value={draft.richDescription ?? ""}
                              onChange={(html) => patchDraft({ richDescription: html })}
                            />
                          </PropertyField>
                        </PropertyFieldGrid>
                      </PropertyFormSection>
                    )}

                    {activeStep === "tecnica" && (
                      <PropertyTechnicalSection
                        client={client}
                        draft={draft}
                        developments={developments}
                        developmentsLoading={developmentsLoading}
                        catalogProperties={catalogProperties}
                        onDraftChange={patchDraft}
                      />
                    )}

                    {activeStep === "ubicacion" && draft.coordinates && (
                      <PropertyLocationSection
                        location={draft.location}
                        colony={draft.colony ?? ""}
                        fullAddress={draft.fullAddress ?? ""}
                        lat={draft.coordinates.lat}
                        lng={draft.coordinates.lng}
                        onLocationChange={(v) => patchDraft({ location: v })}
                        onColonyChange={(v) => patchDraft({ colony: v })}
                        onFullAddressChange={(v) => patchDraft({ fullAddress: v })}
                        onCoordsChange={(lat, lng) => patchDraft({ coordinates: { lat, lng } })}
                      />
                    )}

                    {activeStep === "detalles" && (
                      <PropertyDetailsSection draft={draft} onDraftChange={patchDraft} />
                    )}

                    {activeStep === "amenidades" && (
                      <PropertyAmenitiesEditor
                        amenities={draft.amenities ?? []}
                        services={draft.services ?? []}
                        additionalFeatures={draft.additionalFeatures ?? []}
                        onAmenitiesChange={(v) => patchDraft({ amenities: v })}
                        onServicesChange={(v) => patchDraft({ services: v })}
                        onAdditionalChange={(v) => patchDraft({ additionalFeatures: v })}
                      />
                    )}

                    {activeStep === "contacto" && (
                      <PropertyContactSection
                        contactPhone={draft.contactPhone ?? ""}
                        contactWhatsapp={draft.contactWhatsapp ?? ""}
                        onPhoneChange={(v) => patchDraft({ contactPhone: v })}
                        onWhatsappChange={(v) => patchDraft({ contactWhatsapp: v })}
                      />
                    )}
                  </div>
                </main>

                <aside className="hidden w-[17.5rem] shrink-0 overflow-y-auto border-l border-stone-200/80 bg-gradient-to-b from-stone-100/80 to-stone-50 px-4 py-6 xl:block xl:w-[22rem] xl:px-5 2xl:w-[24rem]">
                  <PropertyFormPreview draft={draft} developments={developments} />
                </aside>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
