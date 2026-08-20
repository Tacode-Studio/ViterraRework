import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale } from "../i18n/LocaleContext";
import { cn } from "./ui/utils";
import { foldFeatureLabel } from "../lib/featureIcons";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  loading?: boolean;
  label?: string;
  labelClassName?: string;
  inputClassName?: string;
  emptyOptionLabel?: string;
};

type PanelRow =
  | { kind: "all" }
  | { kind: "option"; name: string }
  | { kind: "custom"; text: string }
  | { kind: "empty" };

function matchesTypeOption(name: string, query: string) {
  if (!query.trim()) return true;
  return foldFeatureLabel(name).includes(foldFeatureLabel(query));
}

/** Tipo de inmueble: catálogo filtrable al escribir o valor personalizado. */
export function PropertyTypeFilterField({
  value,
  onChange,
  options,
  loading = false,
  label,
  labelClassName,
  inputClassName,
  emptyOptionLabel,
}: Props) {
  const { t } = useLocale();
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const fieldLabel = label ?? t("search.typeFieldLabel");
  const allLabel = emptyOptionLabel ?? t("search.typeAll");
  const waiting = loading && options.length === 0;
  const trimmed = value.trim();

  const filtered = useMemo(
    () => options.filter((name) => matchesTypeOption(name, value)),
    [options, value]
  );

  const panelItems = value.trim() ? filtered : options;
  const exactCatalogMatch = trimmed
    ? options.some((n) => n.toLowerCase() === trimmed.toLowerCase())
    : false;
  const showCustomHint = trimmed.length > 0 && !exactCatalogMatch;

  const rows = useMemo(() => {
    const out: PanelRow[] = [];
    if (!value.trim()) out.push({ kind: "all" });
    if (value.trim() && panelItems.length === 0) out.push({ kind: "empty" });
    for (const name of panelItems) out.push({ kind: "option", name });
    if (showCustomHint) out.push({ kind: "custom", text: trimmed });
    return out;
  }, [value, panelItems, showCustomHint, trimmed]);

  useEffect(() => {
    setHighlight(0);
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const applyRow = (row: PanelRow) => {
    if (row.kind === "all") pick("");
    else if (row.kind === "option") pick(row.name);
    else if (row.kind === "custom") pick(row.text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(0, rows.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter" && open && rows[highlight]) {
      e.preventDefault();
      applyRow(rows[highlight]);
    }
  };

  const showPanel = open && !waiting && rows.length > 0;

  return (
    <div ref={rootRef} className="relative min-w-0 w-full">
      {labelClassName ? (
        <label className={labelClassName} htmlFor={inputId}>
          {fieldLabel}
        </label>
      ) : null}
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={showPanel ? listboxId : undefined}
        aria-autocomplete="list"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={waiting ? t("search.typeLoading") : t("search.typePlaceholder")}
        disabled={waiting}
        autoComplete="off"
        spellCheck={false}
        className={inputClassName}
      />

      {showPanel ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[200] max-h-[min(16rem,42vh)] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5"
        >
          {rows.map((row, idx) => {
            if (row.kind === "all") {
              return (
                <li key="all" role="option" aria-selected={!value}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick("")}
                    className={cn(
                      "w-full px-4 py-2.5 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50",
                      highlight === idx && "bg-slate-100 font-medium text-slate-900"
                    )}
                  >
                    {allLabel}
                  </button>
                </li>
              );
            }
            if (row.kind === "empty") {
              return (
                <li key="empty" className="px-4 py-3 text-sm text-slate-500">
                  Sin coincidencias en el catálogo.
                </li>
              );
            }
            if (row.kind === "option") {
              return (
                <li key={row.name} role="option" aria-selected={value === row.name}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(row.name)}
                    className={cn(
                      "w-full px-4 py-2.5 text-left text-sm text-slate-900 transition-colors hover:bg-slate-50",
                      highlight === idx && "bg-primary/10 font-semibold text-brand-navy"
                    )}
                  >
                    {row.name}
                  </button>
                </li>
              );
            }
            return (
              <li key="custom" role="option" className="border-t border-slate-100">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(row.text)}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50",
                    highlight === idx && "bg-primary/10 font-semibold text-brand-navy"
                  )}
                >
                  Usar «{row.text}»
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
