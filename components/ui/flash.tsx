import { CheckCircle2, AlertCircle } from "lucide-react";

export function Flash({ ok, error }: { ok?: string | null; error?: string | null }) {
  if (!ok && !error) return null;
  return (
    <div
      role="status"
      className={`mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
        error ? "border-[#ecd2cd] bg-[#fdf3f1] text-[#8a3b31]" : "border-[#cfe3d6] bg-[#f1f8f3] text-[#2f5f43]"
      }`}
    >
      {error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{error ?? ok}</span>
    </div>
  );
}
