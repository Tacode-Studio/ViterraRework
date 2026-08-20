import { Phone } from "lucide-react";
import { formatPhoneForDisplay } from "../lib/phoneLink";
import { whatsappDisplayLabel } from "../lib/whatsappLink";
import { WhatsAppGlyph } from "./WhatsAppGlyph";
import { useLocale } from "../i18n/LocaleContext";

type Props = {
  title: string;
  intro: string;
  phone?: string;
  whatsappStored?: string;
  telHref: string | null;
  whatsappHref: string;
  responsibleName?: string;
  /** Por defecto usa la traducción de "Llamar". */
  callButtonLabel?: string;
  showGlobalWhatsappHint?: boolean;
  phoneInvalidHint?: string;
  /** Sin borde propio: va dentro de una tarjeta que incluye el formulario. */
  embedded?: boolean;
};

export function PublicDetailContactBlock({
  title,
  intro,
  phone,
  whatsappStored,
  telHref,
  whatsappHref,
  responsibleName,
  callButtonLabel,
  showGlobalWhatsappHint = false,
  phoneInvalidHint,
  embedded = false,
}: Props) {
  const { t } = useLocale();
  const callLabel = callButtonLabel ?? t("contact.call");
  const phoneRaw = phone?.trim() ?? "";
  const phoneDisplay = formatPhoneForDisplay(phoneRaw);
  const waDisplay = whatsappDisplayLabel(whatsappStored);
  const hasContactLines = Boolean(phoneDisplay || waDisplay || responsibleName?.trim());

  const body = (
    <>
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl" style={{ fontWeight: 700 }}>
        {title}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600" style={{ fontWeight: 400 }}>
        {intro}
      </p>

      {hasContactLines ? (
        <div className="mt-4 space-y-2 rounded-lg border border-slate-200/90 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {responsibleName?.trim() ? (
            <p>
              <span className="font-medium text-slate-800">{t("contact.responsible")}:</span> {responsibleName.trim()}
            </p>
          ) : null}
          {phoneDisplay ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Phone className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.75} />
              <span className="font-medium text-slate-800">{t("contact.phone")}:</span>
              {telHref ? (
                <a href={telHref} className="font-semibold text-slate-900 hover:text-primary hover:underline">
                  {phoneDisplay}
                </a>
              ) : (
                <span className="font-semibold text-slate-900">{phoneDisplay}</span>
              )}
            </p>
          ) : null}
          {waDisplay ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <WhatsAppGlyph className="h-4 w-4 shrink-0" />
              <span className="font-medium text-slate-800">WhatsApp:</span>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#128C7E] hover:underline"
              >
                {waDisplay}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3">
        {telHref ? (
          <a
            href={telHref}
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50"
            style={{ fontWeight: 600 }}
          >
            <span className="flex items-center gap-2">
              <Phone className="h-4 w-4" strokeWidth={2} />
              {callLabel}
            </span>
            {phoneDisplay ? (
              <span className="text-[11px] font-medium text-slate-600">{phoneDisplay}</span>
            ) : null}
          </a>
        ) : (
          <span
            className="flex flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-400"
            title={
              phoneInvalidHint ??
              "Configura un teléfono de al menos 10 dígitos en el admin (pestaña Contacto)"
            }
          >
            <span className="flex items-center gap-2">
              <Phone className="h-4 w-4" strokeWidth={2} />
              {callLabel}
            </span>
            {phoneDisplay ? (
              <span className="text-[11px] text-slate-500">{phoneDisplay}</span>
            ) : null}
          </span>
        )}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-0.5 rounded-lg bg-[#25D366] px-3 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#20bd5a]"
          style={{ fontWeight: 600 }}
        >
          <span className="flex items-center gap-2">
            <WhatsAppGlyph className="h-4 w-4 text-white" />
            WhatsApp
          </span>
          {waDisplay ? <span className="text-[11px] font-medium text-white/90">{waDisplay}</span> : null}
        </a>
      </div>

      {showGlobalWhatsappHint ? (
        <p className="mt-2 text-xs text-slate-500">
          WhatsApp: enlace global del sitio. Configura uno propio en la pestaña Contacto del admin.
        </p>
      ) : null}
      {phoneInvalidHint && phoneRaw && !telHref ? (
        <p className="mt-1 text-xs text-amber-700">{phoneInvalidHint}</p>
      ) : null}
    </>
  );

  if (embedded) return body;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{body}</div>
  );
}
