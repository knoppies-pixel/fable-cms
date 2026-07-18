export function StatusBadge({ status }: { status: string }) {
  const published = status === "published";
  return (
    <span
      className={
        published
          ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
          : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
      }
    >
      {status}
    </span>
  );
}
