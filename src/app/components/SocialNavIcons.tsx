import { useLocation } from "react-router";
import { Facebook, Instagram, Youtube, Link as LinkIcon, MessageCircle } from "lucide-react";
import { useSiteContent } from "../../contexts/SiteContentContext";
import { useSitePreviewVirtualPath } from "../../contexts/SitePreviewVirtualPathContext";
import { mergeSiteSection } from "../../lib/siteContentMerge";
import type { HeaderSocialIconId } from "../config/socialLinks";
import { PreviewFieldPulse } from "./admin/siteEditor/PreviewFieldPulse";
import { cn } from "./ui/utils";

const iconById: Partial<Record<HeaderSocialIconId, typeof Facebook>> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  tiktok: LinkIcon,
  threads: LinkIcon,
  whatsapp: MessageCircle,
  website: LinkIcon,
};

const sizeStyles = {
  /** Desktop navbar: misma lectura que enlaces (sin cajas segmentadas) */
  md: { pad: "p-2", icon: "h-[17px] w-[17px]" },
  sm: { pad: "p-1.5", icon: "h-4 w-4" },
  xs: { pad: "p-1.5", icon: "h-[14px] w-[14px]" },
} as const;

type SocialNavIconsProps = {
  className?: string;
  /** md: barra desktop · sm: mapa / tablet · xs: cabecera móvil muy estrecha */
  iconSize?: keyof typeof sizeStyles;
};

export function SocialNavIcons({ className, iconSize = "md" }: SocialNavIconsProps) {
  const location = useLocation();
  const sitePreviewPath = useSitePreviewVirtualPath();
  const { content } = useSiteContent();
  /** En el iframe del editor la URL real es `/admin/site-preview-frame`; la ruta pública va en el contexto. */
  const pathname = sitePreviewPath ?? location.pathname;
  const hidden =
    pathname.startsWith("/admin") || pathname.startsWith("/login");
  if (hidden) return null;

  const headerSocial = mergeSiteSection("header", content.header).navSocial;
  const linksWithIndex = headerSocial.flatMap((link, i) =>
    link.href.trim().length > 0 ? [{ link, index: i }] : [],
  );
  if (linksWithIndex.length === 0) return null;

  const { pad, icon } = sizeStyles[iconSize];

  return (
    <ul
      role="list"
      aria-label="Redes sociales"
      className={cn(
        "flex flex-nowrap items-center overflow-visible",
        iconSize === "md" ? "gap-1 sm:gap-2" : "gap-0.5 sm:gap-1.5",
        className
      )}
    >
      {linksWithIndex.map(({ link: { id, label, href }, index }) => {
        const Lucide = iconById[id] ?? LinkIcon;
        return (
          <li key={`${id}-${index}`} className="shrink-0 overflow-visible">
            <PreviewFieldPulse
              blockId="header-social"
              fieldKey={`header-social-${index}-href`}
              layout="inline"
            >
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className={cn(
                  "inline-flex items-center justify-center overflow-visible rounded-md text-white/85 transition-colors",
                  "hover:bg-white/[0.07] hover:text-white",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60",
                  "active:bg-white/[0.1]",
                  pad
                )}
              >
                <Lucide className={cn(icon, "overflow-visible")} strokeWidth={1.5} aria-hidden />
              </a>
            </PreviewFieldPulse>
          </li>
        );
      })}
    </ul>
  );
}
