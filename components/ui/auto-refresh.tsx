"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Tr } from "@/lib/i18n/client";

/**
 * Vuelve a pedir la página al servidor cada `seconds` (p. ej. mientras el banco confirma un pago)
 * hasta `maxSeconds`; después deja de insistir y lo dice.
 */
export function AutoRefresh({ seconds = 4, maxSeconds = 120 }: { seconds?: number; maxSeconds?: number }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => {
      if (Date.now() - started >= maxSeconds * 1000) {
        clearInterval(t);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds, maxSeconds]);
  if (!gaveUp) return null;
  return <p className="cp-muted mt-4 text-sm"><Tr s={"Puedes cerrar esta página: te avisaremos por email."} /></p>;
}
