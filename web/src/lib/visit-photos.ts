import "server-only";
import type { Workspace } from "@/lib/dal";
import { Invalid } from "@/lib/form-fields";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

// Before and after photos on visits, kept in a private storage bucket.

export const VISIT_PHOTOS_BUCKET = "visit-photos";
export type PhotoKind = Database["public"]["Enums"]["visit_photo_kind"];

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS_PER_UPLOAD = 12;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

// The photos chosen in a form field (possibly none).
export function photoFiles(fd: FormData, name: string): File[] {
  const files = fd.getAll(name).filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_PHOTOS_PER_UPLOAD) throw new Invalid(`Add up to ${MAX_PHOTOS_PER_UPLOAD} photos at a time.`);
  for (const f of files) {
    if (!EXTENSIONS[f.type]) throw new Invalid("Photos must be JPG, PNG, WEBP or HEIC images.");
    if (f.size > MAX_PHOTO_BYTES) throw new Invalid("One of the photos is over 10 MB. Try a smaller one.");
  }
  return files;
}

// Stores each photo and lists it on the visit. Returns how many failed.
export async function storeVisitPhotos(workspace: Workspace, petId: string, visitId: string, kind: PhotoKind, files: File[]) {
  const supabase = await createClient();
  let failed = 0;
  for (const file of files) {
    const path = `${workspace.organizationId}/${petId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
    const upload = await supabase.storage.from(VISIT_PHOTOS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) { console.error("Visit photo upload failed", upload.error); failed++; continue; }
    const { error } = await supabase.from("visit_photos").insert({
      organization_id: workspace.organizationId,
      pet_id: petId,
      visit_id: visitId,
      kind,
      storage_path: path,
      content_type: file.type,
      size_bytes: file.size,
    });
    if (error) { console.error("Visit photo listing failed", error); failed++; }
  }
  return failed;
}

export type VisitPhoto = {
  id: string;
  visitId: string;
  kind: PhotoKind;
  url: string | null; // signed link, valid for an hour
  viewable: boolean; // browsers can't show HEIC inline
  uploadedBy: string | null;
};

// All of a pet's current photos, grouped by the visit version they were added to.
export async function getVisitPhotos(workspace: Workspace, petId: string): Promise<Map<string, VisitPhoto[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("visit_photos").select("*")
    .eq("organization_id", workspace.organizationId).eq("pet_id", petId).is("removed_at", null)
    .order("created_at");
  if (error) throw new Error(`Could not load visit photos: ${error.message}`);

  const byVisit = new Map<string, VisitPhoto[]>();
  if (data.length === 0) return byVisit;

  const signed = await supabase.storage.from(VISIT_PHOTOS_BUCKET).createSignedUrls(data.map((p) => p.storage_path), 3600);
  const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));

  for (const p of data) {
    const photo: VisitPhoto = {
      id: p.id,
      visitId: p.visit_id,
      kind: p.kind,
      url: urls.get(p.storage_path) ?? null,
      viewable: ["image/jpeg", "image/png", "image/webp"].includes(p.content_type),
      uploadedBy: p.uploaded_by,
    };
    byVisit.set(p.visit_id, [...(byVisit.get(p.visit_id) ?? []), photo]);
  }
  return byVisit;
}
