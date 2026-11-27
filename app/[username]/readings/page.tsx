import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingStepsPage } from "../booking-steps-page";
import { sectionPageData } from "../section-data";
import { getT } from "@/lib/i18n/server";

type Params = { username: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) return { title: (await getT())("Página no encontrada") };
  const title = `Lecturas · ${data.config.displayName}`;
  const description = `Cómo funcionan las lecturas que prepara ${data.config.displayName}, paso a paso.`;
  return { title, description, alternates: { canonical: data.url("lecturas") }, openGraph: { title, description, url: data.url("lecturas"), siteName: data.siteName } };
}

/** «Lecturas»: los pasos para reservar y los productos (components en ../booking-steps-page.tsx). */
export default async function Page({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) notFound();
  return <BookingStepsPage data={data} kind="reading" />;
}
