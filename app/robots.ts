import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/panel", "/cuenta", "/admin", "/api", "/dev", "/onboarding", "/*/checkout", "/*/gracias"] },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
