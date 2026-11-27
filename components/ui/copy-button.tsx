"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Tr } from "@/lib/i18n/client";

export function CopyButton({ text, label = "Copiar enlace", className = "btn btn-outline", copiedLabel = "¡Copiado!" }: { text: string; label?: string; className?: string; copiedLabel?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      <Tr s={copied ? copiedLabel : label} />
    </button>
  );
}
