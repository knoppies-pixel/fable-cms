"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type Preset = "fadeUp" | "staggerReveal";

/**
 * Scroll-entrance presets (design/DIRECTION.md — Motion). Sections declare a
 * preset; they never write ScrollTrigger code themselves.
 *
 * Content is visible without JavaScript and under prefers-reduced-motion:
 * elements are only hidden from inside the effect, immediately before the
 * entrance tween is armed.
 */
export function Reveal({
  preset = "fadeUp",
  targets,
  stagger = 0.08,
  className,
  style,
  children,
}: {
  preset?: Preset;
  /** staggerReveal: selector for the staggered items, e.g. "li". */
  targets?: string;
  /** staggerReveal: seconds between items (default 0.08). */
  stagger?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const items =
      preset === "staggerReveal"
        ? Array.from(el.querySelectorAll(targets ?? ":scope > *")).slice(0, 8)
        : [el];
    if (items.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.set(items, { opacity: 0, y: 24 });
      gsap.to(items, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power2.out",
        stagger: preset === "staggerReveal" ? stagger : 0,
        scrollTrigger: { trigger: el, start: "top 82%", once: true },
      });
    }, el);
    return () => ctx.revert();
  }, [preset, targets, stagger]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
