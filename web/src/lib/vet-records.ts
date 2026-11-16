import "server-only";
import type { Workspace } from "@/lib/dal";
import { Invalid } from "@/lib/form-fields";
import { createClient } from "@/lib/supabase/server";

// Photos and PDFs of vet vaccination records, kept in a private storage
// bucket. Storage and database rules decide who can upload and read them.

export const VET_RECORDS_BUCKET = "vaccination-records";
export const MAX_VET_RECORD_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

// The file from a form field, or null if none was chosen.
export function vetRecordFile(fd: FormData, name: string) {
  const file = fd.get(name);
  if (!(file instanceof File) || file.size === 0) return null;
  if (!EXTENSIONS[file.type]) throw new Invalid("Upload a photo (JPG, PNG, WEBP or HEIC) or a PDF of the vet record.");
  if (file.size > MAX_VET_RECORD_BYTES) throw new Invalid("That file is over 10 MB. Try a smaller photo or a PDF.");
  return file;
}

export async function storeVetRecord(workspace: Workspace, petId: string, file: File, vaccinationId: string | null) {
  const supabase = await createClient();
  const path = `${workspace.organizationId}/${petId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;

  const upload = await supabase.storage.from(VET_RECORDS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) {
    console.error("Vet record upload failed", upload.error);
    return { error: "The vet record couldn't be uploaded. Check your role allows adding records, then try again." };
  }

  const { error } = await supabase.from("vaccination_documents").insert({
    organization_id: workspace.organizationId,
    pet_id: petId,
    vaccination_id: vaccinationId,
    storage_path: path,
    file_name: (file.name || `vet-record.${EXTENSIONS[file.type]}`).slice(0, 200),
    content_type: file.type,
    size_bytes: file.size,
  });
  if (error) {
    console.error("Vet record listing failed", error);
    return { error: "The file uploaded but couldn't be added to the pet's records. Try again." };
  }
  return { error: null };
}

export type VetRecord = {
  id: string;
  vaccinationId: string | null;
  fileName: string;
  isImage: boolean;
  isPdf: boolean;
  url: string | null; // signed link, valid for an hour
  uploadedAt: string;
};

export async function getVetRecords(workspace: Workspace, petId: string): Promise<VetRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vaccination_documents").select("*")
    .eq("organization_id", workspace.organizationId).eq("pet_id", petId).is("removed_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load vet records: ${error.message}`);
  if (data.length === 0) return [];

  const signed = await supabase.storage.from(VET_RECORDS_BUCKET).createSignedUrls(data.map((d) => d.storage_path), 3600);
  const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));

  return data.map((d) => ({
    id: d.id,
    vaccinationId: d.vaccination_id,
    fileName: d.file_name,
    // Browsers can't show HEIC photos inline, so those open as downloads.
    isImage: ["image/jpeg", "image/png", "image/webp"].includes(d.content_type),
    isPdf: d.content_type === "application/pdf",
    url: urls.get(d.storage_path) ?? null,
    uploadedAt: d.created_at,
  }));
}
