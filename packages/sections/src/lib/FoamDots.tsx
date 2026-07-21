/**
 * The ornament layer (design/DIRECTION.md — depth & ornament): a dot-grid
 * cluster, mask-faded, 12–20% opacity, corners only, never over type.
 * Callers position it inside a `relative` wrapper.
 */
export function FoamDots({
  color = "var(--color-accent-warm)",
  className = "",
}: {
  color?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute ${className}`}
      style={{
        backgroundImage: `radial-gradient(circle at 6px 6px, ${color} 2.4px, transparent 3px)`,
        backgroundSize: "26px 14px",
        WebkitMaskImage: "radial-gradient(closest-side, #000, transparent)",
        maskImage: "radial-gradient(closest-side, #000, transparent)",
        opacity: 0.16,
      }}
    />
  );
}
