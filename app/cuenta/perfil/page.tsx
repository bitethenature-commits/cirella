import { requireBuyerFull } from "@/lib/buyer-access";
import { ProfileForm } from "./form";

export default async function ProfilePage() {
  const user = await requireBuyerFull("/cuenta/perfil");
  return (
    <div>
      <h1 className="display text-[2.4rem]">Mi perfil</h1>
      <ProfileForm name={user.name ?? ""} email={user.email} hasPassword={!!user.passwordHash} />
    </div>
  );
}
