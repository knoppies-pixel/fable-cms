"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderSections } from "@/lib/actions";
import { PublishToggle } from "./publish-toggle";
import { SectionRowActions } from "./section-row-actions";

export interface SectionListItem {
  id: string;
  label: string;
  description: string;
  status: string;
  editable: boolean; // false for types missing from the registry
}

/**
 * Sortable section list (dnd-kit): drag the handle (or focus it and use
 * Space + arrows) to reorder. The new order applies optimistically and is
 * persisted via reorderSections; on failure it snaps back.
 */
export function SectionList({
  siteId,
  pageId,
  sections,
}: {
  siteId: string;
  pageId: string;
  sections: SectionListItem[];
}) {
  const [order, setOrder] = useState(() => sections.map((s) => s.id));
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Resync with server data after add/duplicate/delete/toggle refreshes.
  const serverKey = sections.map((s) => s.id).join(",");
  useEffect(() => {
    setOrder(serverKey === "" ? [] : serverKey.split(","));
  }, [serverKey]);

  const byId = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections],
  );
  const rows = order.flatMap((id) => byId.get(id) ?? []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const previous = order;
    const next = arrayMove(
      previous,
      previous.indexOf(String(active.id)),
      previous.indexOf(String(over.id)),
    );
    setOrder(next);
    setError(null);
    setWarning(null);
    startTransition(async () => {
      const result = await reorderSections(siteId, pageId, next);
      if (!result.ok) {
        setOrder(previous);
        setError(result.error);
      } else if (result.warning) {
        setWarning(result.warning);
      }
    });
  };

  return (
    <div>
      {error && (
        <p className="mb-2 rounded-btn bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {error}
        </p>
      )}
      {warning && (
        <p className="mb-2 rounded-btn bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          {warning}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ul data-testid="section-list" className="space-y-2">
            {rows.map((section) => (
              <SortableRow
                key={section.id}
                siteId={siteId}
                pageId={pageId}
                section={section}
              />
            ))}
            {rows.length === 0 && (
              <li className="rounded-card bg-surface px-4 py-8 text-center text-sm text-muted shadow-sm ring-1 ring-black/5">
                No sections yet — add one to start building this page.
              </li>
            )}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableRow({
  siteId,
  pageId,
  section,
}: {
  siteId: string;
  pageId: string;
  section: SectionListItem;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-sm ring-1 ring-black/5 ${
        isDragging ? "relative z-10 opacity-90 shadow-lg ring-accent/40" : ""
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${section.label}`}
        className="-ml-1 cursor-grab touch-none rounded-btn px-1 py-2 text-muted hover:bg-surface-alt hover:text-primary active:cursor-grabbing"
      >
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
          <circle cx="2" cy="2" r="1.5" />
          <circle cx="8" cy="2" r="1.5" />
          <circle cx="2" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="2" cy="14" r="1.5" />
          <circle cx="8" cy="14" r="1.5" />
        </svg>
      </button>
      <div className="min-w-0">
        <p className="font-medium">{section.label}</p>
        <p className="truncate text-xs text-muted">{section.description}</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <PublishToggle
          siteId={siteId}
          pageId={pageId}
          sectionId={section.id}
          status={section.status}
        />
        {section.editable && (
          <Link
            href={`/sites/${siteId}/pages/${pageId}/sections/${section.id}`}
            className="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast hover:opacity-90"
          >
            Edit
          </Link>
        )}
        <SectionRowActions
          siteId={siteId}
          pageId={pageId}
          sectionId={section.id}
          label={section.label}
        />
      </div>
    </li>
  );
}
