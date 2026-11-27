"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

/** Un filtro del feed: al cambiar, la página se queda a la misma altura. */
export function FilterLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} scroll={false} />;
}
