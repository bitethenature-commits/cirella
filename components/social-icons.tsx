import type { SocialKey } from "@/lib/page-config";

const paths: Record<SocialKey, React.ReactNode> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
    </>
  ),
  tiktok: <path d="M15.5 3c.3 2.2 1.7 3.8 4 4v3c-1.5 0-2.8-.4-4-1.2v6.3c0 3.1-2.5 5.4-5.6 5.4A5.5 5.5 0 0 1 4.5 15c0-3.3 2.9-5.8 6.3-5.3v3.2a2.3 2.3 0 0 0-3 2.2c0 1.3 1 2.3 2.3 2.3 1.3 0 2.3-1 2.3-2.4V3h3.1Z" fill="currentColor" />,
  telegram: <path d="M20.7 4.3 2.9 11.2c-1.2.5-1.2 1.2-.2 1.5l4.6 1.4 1.8 5.4c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.2-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8l3-14.2c.3-1.2-.5-1.8-1.6-1.3ZM9 14l8.6-5.4c.4-.3.8-.1.5.2l-7.1 6.4-.3 3.2L9 14Z" fill="currentColor" />,
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="m10 9.2 5 2.8-5 2.8V9.2Z" fill="currentColor" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 8.2c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.3.5.8 1.1 1.3 1.6.6.5 1.2.8 1.6 1 .2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.6-.1l1.5.7c.3.1.4.2.4.4 0 .3-.1 1-.6 1.4-.5.4-1.1.6-1.9.5-1-.2-2.3-.7-3.6-1.9-1.4-1.3-2.1-2.6-2.3-3.5-.2-.9.1-1.6.5-2Z" fill="currentColor" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </>
  ),
  website: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 12h18M12 3c2.5 2.7 3.6 5.7 3.6 9s-1.1 6.3-3.6 9c-2.5-2.7-3.6-5.7-3.6-9S9.5 5.7 12 3Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
};

export function SocialIcon({ name, className = "h-5 w-5" }: { name: SocialKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {paths[name]}
    </svg>
  );
}
