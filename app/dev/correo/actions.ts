"use server";

import { revalidatePath } from "next/cache";
import { runScheduledJobs } from "@/lib/cron";
import { isDemoMode } from "@/lib/env";

export async function runJobsNow() {
  if (!isDemoMode()) return;
  await runScheduledJobs();
  revalidatePath("/dev/correo");
}
