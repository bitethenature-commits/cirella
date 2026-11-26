"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { runScheduledJobs } from "@/lib/cron";
import { isDemoMode } from "@/lib/env";

export async function runJobsNow() {
  if (!isDemoMode()) return;
  const user = await getCurrentUser();
  if (!user?.isAdmin || !user.sessionVerified) return;
  await runScheduledJobs();
  revalidatePath("/dev/email");
}
