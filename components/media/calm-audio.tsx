"use client";

import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useT } from "@/lib/i18n/client";

const SPEEDS = [1, 1.25, 1.5, 2] as const;
const speedLabel = (s: number) => `${s.toLocaleString("es-ES")}×`;
const clock = (t: number) => {
  if (!Number.isFinite(t) || t < 0) return "—";
  const s = Math.floor(t);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

const R = 42; // el radio del anillo (en un dibujo de 100 × 100)

/**
 * El reproductor de audio de la web, «el cuenco»: el ▶ dentro de un anillo fino, y el progreso es un arco de
 * oro que va rodeando el círculo, como un cuenco que suena. Mientras suena, salen ondas del anillo. Al lado,
 * el título, los tiempos y, discretos, −15 s, la velocidad y +15 s. Sin fondo propio: toma el oro de la
 * plantilla (o el del área de miembros) y el color del texto de donde va.
 *
 * El anillo también sirve para moverse: se toca o se arrastra alrededor (o con las flechas del teclado).
 * Con `audioRef` maneja un <audio> que ya existe (cursos y membresías); con `src`, crea el suyo.
 */
export function CalmAudio({
  audioRef,
  src,
  title,
  preload = "metadata",
  className = "",
  variant = "bowl",
}: {
  /** «line»: el ▶ en línea dorada, sin anillo, y el progreso en una raya dorada (el audio de la portada). */
  variant?: "bowl" | "line";
  audioRef?: RefObject<HTMLAudioElement | null>;
  src?: string;
  title: string;
  preload?: "none" | "metadata";
  className?: string;
}) {
  const t = useT();
  const own = useRef<HTMLAudioElement>(null);
  const ref = audioRef ?? own;
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(NaN);
  const [speed, setSpeed] = useState(1);
  const ring = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      setPlaying(!el.paused && !el.ended);
      setTime(el.currentTime);
      setDuration(el.duration);
      setSpeed(el.playbackRate);
    };
    const evs = ["play", "pause", "ended", "timeupdate", "loadedmetadata", "durationchange", "ratechange", "seeked"] as const;
    evs.forEach((e) => el.addEventListener(e, sync));
    sync();
    return () => evs.forEach((e) => el.removeEventListener(e, sync));
  }, [ref]);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  };
  const skip = (d: number) => {
    const el = ref.current;
    if (el) el.currentTime = Math.max(0, Math.min(Number.isFinite(el.duration) ? el.duration : Infinity, el.currentTime + d));
  };
  const nextSpeed = () => {
    const el = ref.current;
    const s = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length];
    if (el) el.playbackRate = s;
    setSpeed(s);
  };
  // Tocar el anillo: el ángulo (desde arriba, en el sentido del reloj) es el punto del audio.
  const seekAt = useCallback(
    (x: number, y: number) => {
      const el = ref.current;
      const box = ring.current?.getBoundingClientRect();
      if (!el || !box || !Number.isFinite(el.duration)) return;
      const a = Math.atan2(x - (box.left + box.width / 2), -(y - (box.top + box.height / 2)));
      const f = ((a / (2 * Math.PI)) + 1) % 1;
      el.currentTime = f * el.duration;
      setTime(el.currentTime);
    },
    [ref],
  );

  const f = Number.isFinite(duration) && duration > 0 ? Math.min(1, time / duration) : 0;
  const dot = { x: 50 + R * Math.sin(f * 2 * Math.PI), y: 50 - R * Math.cos(f * 2 * Math.PI) };
  const controls = (
    <div className="-ml-2 mt-1.5 flex items-center gap-0.5 text-[0.78rem] opacity-80">
      <button type="button" onClick={() => skip(-15)} className="calm-btn inline-flex min-h-9 items-center gap-1 rounded-full px-2.5" aria-label={t("Retroceder 15 segundos")}>
        <RotateCcw className="h-3.5 w-3.5" /> 15 s
      </button>
      <button type="button" onClick={nextSpeed} className="calm-btn min-h-9 min-w-11 rounded-full px-2.5 font-serif tabular-nums" aria-label={`Velocidad ${speedLabel(speed)}`}>
        {speedLabel(speed)}
      </button>
      <button type="button" onClick={() => skip(15)} className="calm-btn inline-flex min-h-9 items-center gap-1 rounded-full px-2.5" aria-label={t("Avanzar 15 segundos")}>
        15 s <RotateCw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
  if (variant === "line") {
    // El ▶ es solo su dibujo en oro (sin anillo ni botón relleno) y el progreso, una raya dorada fina.
    return (
      <div className={`calm-audio flex items-center gap-4 ${playing ? "is-playing" : ""} ${className}`} data-calm-audio="line">
        {!audioRef && src && <audio ref={own} src={src} preload={preload} controlsList="nodownload" aria-label={title} />}
        <button type="button" onClick={toggle} className="calm-gold grid h-12 w-12 shrink-0 place-items-center transition-transform duration-300 hover:scale-110" aria-label={playing ? `Pausar ${title}` : `Escuchar ${title}`}>
          {playing ? <Pause className="h-9 w-9" strokeWidth={1.2} /> : <Play className="ml-1 h-9 w-9" strokeWidth={1.2} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-[1.02rem] leading-tight opacity-95">{title}</p>
          <input
            type="range"
            min={0}
            max={Number.isFinite(duration) && duration > 0 ? duration : 1}
            step={0.1}
            value={Number.isFinite(duration) && duration > 0 ? Math.min(time, duration) : 0}
            onChange={(e) => {
              const el = ref.current;
              if (!el || !Number.isFinite(el.duration)) return;
              el.currentTime = Number(e.target.value);
              setTime(el.currentTime);
            }}
            aria-label={t("Posición del audio")}
            aria-valuetext={`${clock(time)} de ${clock(duration)}`}
            className="calm-line mt-2 block w-full"
            style={{ ["--f" as string]: `${f * 100}%` }}
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="font-serif text-[0.85rem] tabular-nums">
              <span className="calm-gold">{clock(time)}</span>
              <span className="opacity-50"> / {clock(duration)}</span>
            </p>
            {controls}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`calm-audio flex items-center gap-5 ${playing ? "is-playing" : ""} ${className}`} data-calm-audio>
      {!audioRef && src && <audio ref={own} src={src} preload={preload} controlsList="nodownload" aria-label={title} />}
      <div className="relative h-24 w-24 shrink-0">
        {/* Las ondas del cuenco, mientras suena. */}
        <span aria-hidden className="calm-wave absolute inset-[6%] rounded-full" />
        <span aria-hidden className="calm-wave calm-wave-2 absolute inset-[6%] rounded-full" />
        <span aria-hidden className="calm-wave calm-wave-3 absolute inset-[6%] rounded-full" />
        <svg
          ref={ring}
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full cursor-pointer touch-none"
          role="slider"
          tabIndex={0}
          aria-label={t("Posición del audio")}
          aria-valuemin={0}
          aria-valuemax={Number.isFinite(duration) ? Math.round(duration) : 0}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${clock(time)} de ${clock(duration)}`}
          onPointerDown={(e) => {
            // El centro es el botón: solo el anillo mueve el audio.
            const box = e.currentTarget.getBoundingClientRect();
            const dx = e.clientX - (box.left + box.width / 2);
            const dy = e.clientY - (box.top + box.height / 2);
            if (Math.hypot(dx, dy) < box.width * 0.3) return;
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            seekAt(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => dragging.current && seekAt(e.clientX, e.clientY)}
          onPointerUp={() => (dragging.current = false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") skip(5);
            else if (e.key === "ArrowLeft") skip(-5);
            else return;
            e.preventDefault();
          }}
        >
          <circle cx="50" cy="50" r={R} fill="none" className="calm-ring-bg" strokeWidth="1.5" />
          <circle cx="50" cy="50" r={R} fill="none" className="calm-ring" strokeWidth="2.6" strokeLinecap="round" pathLength={100} strokeDasharray={`${f * 100} 100`} transform="rotate(-90 50 50)" />
          {f > 0 && <circle cx={dot.x} cy={dot.y} r="3.2" className="calm-dot" />}
        </svg>
        <button type="button" onClick={toggle} className="calm-play absolute inset-[22%] grid place-items-center rounded-full" aria-label={playing ? `Pausar ${title}` : `Escuchar ${title}`}>
          {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-[1.08rem] leading-tight opacity-95">{title}</p>
        <p className="mt-1 font-serif text-[0.95rem] tabular-nums">
          <span className="calm-gold">{clock(time)}</span>
          <span className="opacity-50"> / {clock(duration)}</span>
        </p>
        <div className="-ml-2 mt-1.5 flex items-center gap-0.5 text-[0.78rem] opacity-80">
          <button type="button" onClick={() => skip(-15)} className="calm-btn inline-flex min-h-9 items-center gap-1 rounded-full px-2.5" aria-label={t("Retroceder 15 segundos")}>
            <RotateCcw className="h-3.5 w-3.5" /> 15 s
          </button>
          <button type="button" onClick={nextSpeed} className="calm-btn min-h-9 min-w-11 rounded-full px-2.5 font-serif tabular-nums" aria-label={`Velocidad ${speedLabel(speed)}`}>
            {speedLabel(speed)}
          </button>
          <button type="button" onClick={() => skip(15)} className="calm-btn inline-flex min-h-9 items-center gap-1 rounded-full px-2.5" aria-label={t("Avanzar 15 segundos")}>
            15 s <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
