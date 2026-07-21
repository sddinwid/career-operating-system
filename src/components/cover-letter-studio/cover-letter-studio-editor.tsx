"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CoverLetterRevisionRecord } from "@/lib/cover-letter-revision/contract";

type CoverLetterStudioEditorProps = {
  initialRecord: CoverLetterRevisionRecord;
  jobDescriptionVersionId: string;
  readOnly: boolean;
  latestAudit: {
    id: string;
    status: string;
    renderingReadiness: string;
    summary: string | null;
  } | null;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sortParagraphs(record: CoverLetterRevisionRecord) {
  record.content.paragraphs = [...record.content.paragraphs].sort((left, right) => left.order - right.order);
  return record;
}

export function CoverLetterStudioEditor({
  initialRecord,
  jobDescriptionVersionId,
  readOnly,
  latestAudit
}: CoverLetterStudioEditorProps) {
  const router = useRouter();
  const normalizedInitialRecord = useMemo(() => sortParagraphs(clone(initialRecord)), [initialRecord]);
  const [record, setRecord] = useState(() => clone(normalizedInitialRecord));
  const [lastSavedUpdatedAt, setLastSavedUpdatedAt] = useState(initialRecord.content.updatedAt);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "error" | "saved"; message?: string }>({
    kind: "idle"
  });
  const [finalizeState, setFinalizeState] = useState<{ kind: "idle" | "working" | "error"; message?: string }>({
    kind: "idle"
  });

  const dirty =
    JSON.stringify(record) !== JSON.stringify(normalizedInitialRecord) &&
    record.content.updatedAt === lastSavedUpdatedAt;
  const wordCount = useMemo(() => record.content.summary.wordCount, [record]);

  function updateParagraph(paragraphId: string, nextText: string) {
    setRecord((current) => {
      const next = clone(current);
      const paragraph = next.content.paragraphs.find((item) => item.id === paragraphId);
      if (paragraph) {
        paragraph.currentText = nextText;
        paragraph.editedClaimRisk = paragraph.currentText !== paragraph.originalText;
      }
      return next;
    });
  }

  function moveParagraph(index: number, direction: -1 | 1) {
    setRecord((current) => {
      const next = sortParagraphs(clone(current));
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.content.paragraphs.length) {
        return next;
      }
      const currentParagraph = next.content.paragraphs[index]!;
      const targetParagraph = next.content.paragraphs[targetIndex]!;
      const currentOrder = currentParagraph.order;
      currentParagraph.order = targetParagraph.order;
      targetParagraph.order = currentOrder;
      return sortParagraphs(next);
    });
  }

  async function saveDraft() {
    setState({ kind: "saving" });
    const response = await fetch(`/api/cover-letter-studio/${record.content.revisionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedInputChecksum: record.content.inputChecksum,
        updatedAt: record.content.updatedAt,
        content: record.content,
        userNotes: record.userNotes
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setState({ kind: "error", message: payload.error ?? "Failed to save the cover-letter revision." });
      return;
    }
    setLastSavedUpdatedAt(payload.updatedAt ?? record.content.updatedAt);
    setState({
      kind: "saved",
      message: "Draft saved."
    });
    router.push(`/job-descriptions/${jobDescriptionVersionId}/cover-letter/studio?revisionId=${payload.revisionId}`);
    router.refresh();
  }

  async function finalizeDraft() {
    setFinalizeState({ kind: "working" });
    const response = await fetch(`/api/cover-letter-studio/${record.content.revisionId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updatedAt: record.content.updatedAt,
        returnTo: `/job-descriptions/${jobDescriptionVersionId}/cover-letter/studio`
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setFinalizeState({ kind: "error", message: payload.error ?? "Failed to finalize the cover-letter revision." });
      return;
    }
    router.push(payload.redirectTo);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">Cover Letter Studio</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">{record.content.header.role}</h1>
            <p className="mt-3 text-base text-stone-600">{record.content.header.company}</p>
            <div className="mt-2 space-y-1 text-sm text-stone-500">
              <p>Composition {record.content.coverLetterCompositionVersionId}</p>
              <p>Revision {record.content.revisionId}</p>
              {record.summary.predecessorRevisionId ? <p>Predecessor {record.summary.predecessorRevisionId}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/cover-letter?versionId=${record.content.coverLetterCompositionVersionId}`}
            >
              Return to Cover Letter
            </a>
            <a
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/cover-letter/compare?revisionId=${record.content.revisionId}`}
            >
              View Comparison
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Status</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{record.content.status}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Word count</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{wordCount}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Paragraphs</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{record.content.summary.paragraphCount}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Latest audit</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{latestAudit?.status ?? "Not audited"}</p>
            <p className="mt-1 text-sm text-stone-600">{latestAudit?.summary ?? "Run the deterministic audit."}</p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <label className="block text-sm text-stone-700">
          <span className="mb-2 block font-semibold">Salutation</span>
          <input
            aria-label="Salutation"
            className="w-full rounded-2xl border border-stone-300 px-4 py-3"
            disabled={readOnly}
            onChange={(event) =>
              setRecord((current) => ({ ...current, content: { ...current.content, salutation: event.target.value } }))
            }
            value={record.content.salutation}
          />
        </label>

        <div className="mt-6 space-y-4">
          {record.content.paragraphs.map((paragraph, index) => (
            <article key={paragraph.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-stone-500">{paragraph.type.replace(/_/g, " ")}</p>
                  <p className="mt-2 text-base font-semibold text-stone-900">{paragraph.purpose}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-full border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 disabled:opacity-50"
                    disabled={readOnly || index === 0}
                    onClick={() => moveParagraph(index, -1)}
                    type="button"
                  >
                    Move Up
                  </button>
                  <button
                    className="rounded-full border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 disabled:opacity-50"
                    disabled={readOnly || index === record.content.paragraphs.length - 1}
                    onClick={() => moveParagraph(index, 1)}
                    type="button"
                  >
                    Move Down
                  </button>
                </div>
              </div>
              <label className="mt-4 block text-sm text-stone-700">
                <span className="mb-2 block font-semibold">Paragraph text</span>
                <textarea
                  aria-label={`${paragraph.type.replace(/_/g, " ")} paragraph`}
                  className="min-h-32 w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm leading-6 text-stone-800"
                  disabled={readOnly}
                  onChange={(event) => updateParagraph(paragraph.id, event.target.value)}
                  value={paragraph.currentText}
                />
              </label>
              <p className="mt-3 text-sm text-stone-600">
                Evidence {paragraph.supportingEvidenceIds.join(", ") || "None"} - Requirements{" "}
                {paragraph.supportingRequirementIds.join(", ") || "None"}
              </p>
            </article>
          ))}
        </div>

        <label className="mt-6 block text-sm text-stone-700">
          <span className="mb-2 block font-semibold">Closing</span>
          <textarea
            aria-label="Closing"
            className="min-h-24 w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm leading-6 text-stone-800"
            disabled={readOnly}
            onChange={(event) =>
              setRecord((current) => ({ ...current, content: { ...current.content, closing: event.target.value } }))
            }
            value={record.content.closing}
          />
        </label>

        <label className="mt-6 block text-sm text-stone-700">
          <span className="mb-2 block font-semibold">Review Notes</span>
          <textarea
            aria-label="Review Notes"
            className="min-h-24 w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm leading-6 text-stone-800"
            disabled={readOnly}
            onChange={(event) => setRecord((current) => ({ ...current, userNotes: event.target.value }))}
            value={record.userNotes ?? ""}
          />
        </label>

        {!readOnly ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 disabled:opacity-50"
              disabled={state.kind === "saving"}
              onClick={() => void saveDraft()}
              type="button"
            >
              Save Draft
            </button>
            <button
              className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
              disabled={finalizeState.kind === "working" || dirty}
              onClick={() => void finalizeDraft()}
              type="button"
            >
              Finalize Revision
            </button>
          </div>
        ) : null}

        {state.message ? <p className={`mt-4 text-sm ${state.kind === "error" ? "text-rose-700" : "text-stone-600"}`}>{state.message}</p> : null}
        {finalizeState.message ? <p className="mt-2 text-sm text-rose-700">{finalizeState.message}</p> : null}
      </section>
    </div>
  );
}
