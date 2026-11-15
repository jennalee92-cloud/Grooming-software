"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (for example, not on https): let them copy by hand.
      window.prompt("Copy this link:", text);
    }
  }

  return (
    <button type="button" className="button-quiet" onClick={copy}>
      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : label}
    </button>
  );
}
