"use client";

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  Building2,
  ClipboardList,
  FileCheck2,
  Hammer,
  Handshake,
  HardHat,
  Home,
  Key,
  Landmark,
  Mail,
  MessageCircle,
  Phone,
  Scale,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TreePine,
  Users,
} from "lucide-react";
import type { ServiceIconKey } from "../data/siteContent";

export const SERVICE_LUCIDE_MAP: Record<ServiceIconKey, LucideIcon> = {
  home: Home,
  building2: Building2,
  settings2: Settings2,
  fileCheck2: FileCheck2,
  scale: Scale,
  barChart3: BarChart3,
  phone: Phone,
  mail: Mail,
  messageCircle: MessageCircle,
  landmark: Landmark,
  key: Key,
  handshake: Handshake,
  briefcase: Briefcase,
  treePine: TreePine,
  hardHat: HardHat,
  hammer: Hammer,
  search: Search,
  sparkles: Sparkles,
  shieldCheck: ShieldCheck,
  users: Users,
  clipboardList: ClipboardList,
};

export function serviceIconForKey(key: ServiceIconKey): LucideIcon {
  return SERVICE_LUCIDE_MAP[key] ?? Building2;
}
