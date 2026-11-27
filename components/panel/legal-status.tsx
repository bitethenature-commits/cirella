import { Badge } from "@/app/panel/ui";
import { LEGAL_FIELD_LABEL, legalIdentityMissing, type LegalIdentity } from "@/lib/legal";
import { Tr } from "@/lib/i18n/client";

/** «Completos» o «Faltan: NIF, dirección…» de la identidad legal de la creadora. */
export function LegalIdentityStatus({ creator }: { creator: Partial<LegalIdentity> }) {
  const missing = legalIdentityMissing(creator);
  if (!missing.length) return <Badge tone="success"><Tr s={"Completos"} /></Badge>;
  return <Badge tone="warning"><Tr s={"Faltan datos:"} />{" "}{missing.map((k) => LEGAL_FIELD_LABEL[k]).join(", ")}</Badge>;
}
