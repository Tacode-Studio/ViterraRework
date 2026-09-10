import type { SupabaseClient } from "@supabase/supabase-js";

export const PROPERTY_MEDIA_BUCKET_ID = "property-media";
/** 5 GB — tope del bucket `property-media` (fotos y videos). */
export const PROPERTY_MEDIA_MAX_BYTES = 5 * 1024 * 1024 * 1024;
/** @deprecated Preferir PROPERTY_MEDIA_MAX_BYTES; se mantiene por usos de video. */
export const PROPERTY_VIDEO_MAX_BYTES = PROPERTY_MEDIA_MAX_BYTES;

function extensionForUpload(file: File): string {
  const name = file.name.split(".").pop()?.toLowerCase();
  if (name && /^[a-z0-9]{1,8}$/.test(name)) return name;
  const mime = file.type.toLowerCase();
  if (mime.includes("jpeg") || mime === "image/jpg") return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("heic") || mime.includes("heif")) return "heic";
  if (mime.includes("tiff")) return "tiff";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime") || mime.includes("mov")) return "mov";
  return "bin";
}

export function propertyMediaPublicUrl(client: SupabaseClient, storagePath: string): string | null {
  const path = storagePath.trim();
  if (!path) return null;
  const { data } = client.storage.from(PROPERTY_MEDIA_BUCKET_ID).getPublicUrl(path);
  return data?.publicUrl?.trim() || null;
}

export function propertyMediaPathFromPublicUrl(publicUrl: string): string | null {
  const t = publicUrl.trim();
  if (!t) return null;
  let pathname: string;
  try {
    pathname = new URL(t).pathname;
  } catch {
    return null;
  }
  const needle = `/storage/v1/object/public/${PROPERTY_MEDIA_BUCKET_ID}/`;
  const idx = pathname.indexOf(needle);
  if (idx === -1) return null;
  let path = pathname.slice(idx + needle.length);
  if (!path) return null;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* mantener */
  }
  return path;
}

export async function uploadDevelopmentImage(
  client: SupabaseClient,
  developmentId: string,
  file: File,
): Promise<string> {
  const ext = extensionForUpload(file);
  const path = `developments/${developmentId}/photos/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from(PROPERTY_MEDIA_BUCKET_ID).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const url = propertyMediaPublicUrl(client, path);
  if (!url) throw new Error("No se obtuvo URL pública de la imagen.");
  return url;
}

export async function uploadPropertyImage(
  client: SupabaseClient,
  propertyId: string,
  file: File
): Promise<string> {
  const ext = extensionForUpload(file);
  const path = `properties/${propertyId}/photos/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from(PROPERTY_MEDIA_BUCKET_ID).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const url = propertyMediaPublicUrl(client, path);
  if (!url) throw new Error("No se obtuvo URL pública de la imagen.");
  return url;
}

export type UploadEntityVideoFn = (
  client: SupabaseClient,
  entityId: string,
  file: File,
  onProgress?: (pct: number) => void,
) => Promise<{ path: string; publicUrl: string }>;

export const uploadDevelopmentVideo: UploadEntityVideoFn = async (
  client,
  developmentId,
  file,
  onProgress,
) => {
  if (file.size > PROPERTY_VIDEO_MAX_BYTES) {
    throw new Error("El video supera el límite de 5 GB. Usa una URL externa.");
  }
  const ext = extensionForUpload(file);
  const path = `developments/${developmentId}/video/${crypto.randomUUID()}.${ext}`;
  onProgress?.(0);
  const { error } = await client.storage.from(PROPERTY_MEDIA_BUCKET_ID).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  onProgress?.(100);
  const publicUrl = propertyMediaPublicUrl(client, path);
  if (!publicUrl) throw new Error("No se obtuvo URL pública del video.");
  return { path, publicUrl };
}

export const uploadPropertyVideo: UploadEntityVideoFn = async (
  client,
  propertyId,
  file,
  onProgress,
) => {
  if (file.size > PROPERTY_VIDEO_MAX_BYTES) {
    throw new Error("El video supera el límite de 5 GB. Usa una URL externa.");
  }
  const ext = extensionForUpload(file);
  const path = `properties/${propertyId}/video/${crypto.randomUUID()}.${ext}`;
  onProgress?.(0);
  const { error } = await client.storage.from(PROPERTY_MEDIA_BUCKET_ID).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  onProgress?.(100);
  const publicUrl = propertyMediaPublicUrl(client, path);
  if (!publicUrl) throw new Error("No se obtuvo URL pública del video.");
  return { path, publicUrl };
}

export async function deletePropertyMediaObject(client: SupabaseClient, storagePath: string): Promise<void> {
  const path = storagePath.trim();
  if (!path) return;
  await client.storage.from(PROPERTY_MEDIA_BUCKET_ID).remove([path]);
}

/** Varios archivos de una vez (borrado definitivo de una ficha). Ignora rutas vacías. */
export async function deletePropertyMediaObjects(
  client: SupabaseClient,
  storagePaths: string[],
): Promise<void> {
  const paths = storagePaths.map((p) => p.trim()).filter(Boolean);
  if (paths.length === 0) return;
  await client.storage.from(PROPERTY_MEDIA_BUCKET_ID).remove(paths);
}

/** Normaliza WhatsApp a solo dígitos (opcional prefijo país). */
export function normalizeWhatsappDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}
