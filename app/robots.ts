import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/panel", "/area", "/admin", "/api", "/dev", "/onboarding", "/*/checkout", "/*/request", "/*/thanks", "/thanks", "/test-payment"] },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
