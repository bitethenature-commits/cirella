import { getCurrentUser } from "@/lib/auth";
import { ResendVerificationForm } from "./resend-verification-form";

/** Aviso del panel para las creadoras que aún no han confirmado su email. */
export async function VerifyEmailBanner() {
  const user = await getCurrentUser();
  if (!user || user.emailVerifiedAt) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ecdcb8] bg-[#fbf5e8] px-4 py-3 text-sm text-[#7a5a1c]">
      <p>
        Confirma tu email (<strong>{user.email}</strong>) para proteger tu cuenta.
      </p>
      <ResendVerificationForm />
    </div>
  );
}
