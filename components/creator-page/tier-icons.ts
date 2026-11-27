import { Bookmark, BookOpenText, CalendarDays, CloudSun, Flame, Flower2, GraduationCap, Heart, MessageCircle, Mic, Moon, MoonStar, PenLine, Radio, SlidersHorizontal, Sparkles, type LucideIcon } from "lucide-react";
import type { TierIcon } from "@/lib/tier-features";

/** El dibujo de cada cosa que incluye un nivel de la comunidad (lib/tier-features.ts). */
export const TIER_ICONS: Record<TierIcon, LucideIcon> = {
  text: PenLine, page: BookOpenText, calendar: CalendarDays, save: Bookmark, moon: Moon, chat: MessageCircle, podcast: Mic, meditation: Flower2,
  weather: CloudSun, masterclass: GraduationCap, ceremony: Flame, circle: MoonStar, live: Radio, filter: SlidersHorizontal, heart: Heart, star: Sparkles,
};
