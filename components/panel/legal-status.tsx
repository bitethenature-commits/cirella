import { Badge } from "@/app/panel/ui";
import { LEGAL_FIELD_LABEL, legalIdentityMissing, type LegalIdentity } from "@/lib/legal";

/** «Completos» o «Faltan: NIF, dirección…» de la identidad legal de la creadora. */
export function LegalIdentityStatus({ creator }: { creator: Partial<LegalIdentity> }) {
  const missing = legalIdentityMissing(creator);
  if (!missing.length) return <Badge tone="success">Completos</Badge>;
  return <Badge tone="warning">Faltan datos: {missing.map((k) => LEGAL_FIELD_LABEL[k]).join(", ")}</Badge>;
}
