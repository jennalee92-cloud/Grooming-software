"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, LoaderCircle } from "lucide-react";

type Props = { id: string; name: string; label: string };

const MAX_EDGE = 1600; // pixels on the longest side after shrinking
const QUALITY = 0.82;

// Shrinks a phone photo to a reasonable size before upload. Falls back to
// the original if the browser can't decode it (e.g. HEIC outside Safari).
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// Multiple-photo picker (camera or library) with previews. Photos are
// shrunk in the browser and put back into the input, so the form uploads
// the small versions.
export function PhotoInput({ id, name, label }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const onChange = async () => {
    const el = input.current;
    if (!el?.files) return;
    const chosen = Array.from(el.files);
    setBusy(true);
    const small = await Promise.all(chosen.map(shrink));
    const transfer = new DataTransfer();
    small.forEach((f) => transfer.items.add(f));
    el.files = transfer.files;
    setPreviews(small.filter((f) => f.type !== "image/heic" && f.type !== "image/heif").map((f) => URL.createObjectURL(f)));
    setBusy(false);
  };

  return (
    <label className="field photo-field" htmlFor={id}>
      <span><Camera size={13} /> {label}</span>
      <input ref={input} id={id} name={name} type="file" multiple className="file-input"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={onChange} />
      {busy && <small className="photo-busy"><LoaderCircle size={13} className="spin" /> Preparing photos…</small>}
      {previews.length > 0 && (
        <span className="photo-previews">
          {/* Local previews of the chosen files. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {previews.map((src) => <img key={src} src={src} alt="" />)}
        </span>
      )}
    </label>
  );
}
