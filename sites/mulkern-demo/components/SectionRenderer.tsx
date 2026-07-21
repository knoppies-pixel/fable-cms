import type { ComponentType } from "react";
import { getRegistryEntry } from "@fable/sections";
import type { CmsSection } from "@/lib/cms";

/**
 * The dumb renderer (spec §5): validate props against the registry schema,
 * render the section component. Unknown type or invalid props render nothing
 * in production and a visible error card in preview mode.
 */
export function SectionRenderer({
  section,
  preview,
}: {
  section: CmsSection;
  preview: boolean;
}) {
  const entry = getRegistryEntry(section.section_type);
  if (!entry) {
    return preview ? (
      <SectionErrorCard
        sectionType={section.section_type}
        issues={["Unknown section type — is the site's registry up to date?"]}
      />
    ) : null;
  }

  const parsed = entry.schema.safeParse(section.props);
  if (!parsed.success) {
    return preview ? (
      <SectionErrorCard
        sectionType={section.section_type}
        issues={parsed.error.issues.map(
          (issue) =>
            `${issue.path.length ? issue.path.join(".") : "(root)"}: ${issue.message}`,
        )}
      />
    ) : null;
  }

  // Registry entries are type-erased (see contract.ts); props were just
  // validated by the entry's own schema, so this widening is safe.
  const Component = entry.Component as ComponentType<Record<string, unknown>>;
  const rendered = <Component {...(parsed.data as Record<string, unknown>)} />;

  if (preview && section.status === "draft") {
    return (
      <div data-draft-section className="relative outline-2 outline-dashed outline-amber-400">
        <span className="absolute right-2 top-2 z-10 rounded bg-amber-400 px-2 py-0.5 text-xs font-bold uppercase text-amber-950">
          Draft
        </span>
        {rendered}
      </div>
    );
  }
  return rendered;
}

/** Preview-only diagnostics; intentionally loud, never shown in production. */
function SectionErrorCard({
  sectionType,
  issues,
}: {
  sectionType: string;
  issues: string[];
}) {
  return (
    <div
      data-section-error
      className="mx-auto my-8 w-full max-w-6xl px-4 sm:px-6 lg:px-8"
    >
      <div className="rounded-card border-2 border-dashed border-red-400 bg-red-50 p-6 text-red-900">
        <p className="font-bold">
          Section “{sectionType}” failed validation and will not render in
          production.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {issues.map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
