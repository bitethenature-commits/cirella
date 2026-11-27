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
  const title = `Sesiones · ${data.config.displayName}`;
  const description = `Cómo se reservan las sesiones en directo con ${data.config.displayName}, paso a paso.`;
  return { title, description, alternates: { canonical: data.url("sesiones") }, openGraph: { title, description, url: data.url("sesiones"), siteName: data.siteName } };
}

/** «Sesiones»: los pasos para reservar y los productos (components en ../booking-steps-page.tsx). */
export default async function Page({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const data = await sectionPageData(username);
  if (!data) notFound();
  return <BookingStepsPage data={data} kind="session" />;
}
