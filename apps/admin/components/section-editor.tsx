"use client";

import { useState } from "react";
import type { SectionType } from "@fable/sections";
import { PreviewPane } from "./preview-pane";
import { SectionForm } from "./section-form/section-form";

/**
 * Section editing workspace: auto-generated form on the left, live draft-mode
 * preview of the page on the right. A successful save reloads the preview so
 * the change is visible immediately.
 */
export function SectionEditor({
  siteId,
  pageId,
  sectionId,
  sectionType,
  initialProps,
  previewSrc,
}: {
  siteId: string;
  pageId: string;
  sectionId: string;
  sectionType: SectionType;
  initialProps: unknown;
  previewSrc: string | null;
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = () => setReloadKey((key) => key + 1);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <SectionForm
        siteId={siteId}
        pageId={pageId}
        sectionId={sectionId}
        sectionType={sectionType}
        initialProps={initialProps}
        onSaved={refresh}
      />
      <div className="xl:sticky xl:top-6 xl:h-[calc(100vh-8rem)]">
        <PreviewPane src={previewSrc} reloadKey={reloadKey} onRefresh={refresh} />
      </div>
    </div>
  );
}
