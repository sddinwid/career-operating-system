"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  resumeRevisionConfiguration
} from "@/lib/resume-revision/config";
import type {
  ResumeRevisionRecord,
  ResumeRevisionReviewNote
} from "@/lib/resume-revision/contract";

type ResumeStudioEditorProps = {
  initialRecord: ResumeRevisionRecord;
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

function sortByOrder<T extends { order: number }>(items: T[]) {
  return [...items].sort((a, b) => a.order - b.order);
}

function swapOrder<T extends { order: number }>(items: T[], index: number, direction: -1 | 1) {
  const sorted = sortByOrder(items);
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= sorted.length) {
    return sorted;
  }

  const current = sorted[index]!;
  const target = sorted[targetIndex]!;
  const currentOrder = current.order;
  current.order = target.order;
  target.order = currentOrder;
  return sorted;
}

function buildOrUpdateNote(
  notes: ResumeRevisionReviewNote[],
  args: {
    targetType: "REVISION" | "SECTION" | "STATEMENT";
    targetId: string;
    section: ResumeRevisionReviewNote["section"];
    body: string;
  }
) {
  const existing = notes.find(
    (note) => note.targetType === args.targetType && note.targetId === args.targetId
  );
  const timestamp = new Date().toISOString();

  if (existing) {
    existing.body = args.body;
    existing.updatedAt = timestamp;
    return notes.filter((note) => note.body.trim().length > 0);
  }

  if (args.body.trim().length === 0) {
    return notes;
  }

  return [
    ...notes,
    {
      noteId: crypto.randomUUID(),
      targetType: args.targetType,
      targetId: args.targetId,
      section: args.section,
      body: args.body,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];
}

function noteBody(
  notes: ResumeRevisionReviewNote[],
  targetType: "REVISION" | "SECTION" | "STATEMENT",
  targetId: string
) {
  return notes.find((note) => note.targetType === targetType && note.targetId === targetId)?.body ?? "";
}

export function ResumeStudioEditor({
  initialRecord,
  jobDescriptionVersionId,
  readOnly,
  latestAudit
}: ResumeStudioEditorProps) {
  const router = useRouter();
  const [record, setRecord] = useState(() => clone(initialRecord));
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() => JSON.stringify(initialRecord));
  const [saveState, setSaveState] = useState<{
    kind: "idle" | "saving" | "saved" | "error";
    message?: string;
  }>({ kind: "idle" });
  const [finalizeState, setFinalizeState] = useState<{
    kind: "idle" | "working" | "error";
    message?: string;
  }>({ kind: "idle" });

  const dirty = JSON.stringify(record) !== lastSavedSnapshot;

  const visibleSkills = useMemo(
    () =>
      record.content.skillsGroups.reduce(
        (total, group) => total + group.skills.filter((skill) => skill.included).length,
        0
      ),
    [record]
  );

  async function saveDraft() {
    setSaveState({ kind: "saving" });
    const response = await fetch(`/api/resume-studio/${record.content.revisionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        updatedAt: record.content.updatedAt,
        content: record.content,
        reviewNotes: record.reviewNotes
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      setSaveState({
        kind: "error",
        message: payload.error ?? "Failed to save the resume revision draft."
      });
      return;
    }

    const nextRecord = clone(record);
    nextRecord.content.updatedAt = payload.updatedAt;
    if (payload.summary) {
      nextRecord.summary = payload.summary;
    }
    setRecord(nextRecord);
    setLastSavedSnapshot(JSON.stringify(nextRecord));
    setSaveState({
      kind: "saved",
      message: "Draft saved."
    });
  }

  async function finalizeDraft() {
    setFinalizeState({ kind: "working" });
    const response = await fetch(`/api/resume-studio/${record.content.revisionId}/finalize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        updatedAt: record.content.updatedAt,
        returnTo: `/job-descriptions/${jobDescriptionVersionId}/resume/studio`
      })
    });
    const payload = await response.json();

    if (!response.ok) {
      setFinalizeState({
        kind: "error",
        message: payload.error ?? "Failed to finalize the resume revision."
      });
      return;
    }

    router.push(payload.redirectTo);
    router.refresh();
  }

  function setRevisionNote(body: string) {
    setRecord((current) => ({
      ...current,
      reviewNotes: buildOrUpdateNote([...current.reviewNotes], {
        targetType: "REVISION",
        targetId: current.content.revisionId,
        section: null,
        body
      })
    }));
  }

  function updateSummary(text: string) {
    setRecord((current) => {
      const next = clone(current);
      next.content.professionalSummary.currentText = text;
      const sentenceTexts = text
        .split(/(?<=[.!?])\s+/)
        .map((item) => item.trim())
        .filter(Boolean);
      next.content.professionalSummary.sentences = next.content.professionalSummary.sentences.map(
        (sentence, index) => ({
          ...sentence,
          currentText: sentenceTexts[index] ?? sentence.currentText,
          included: index < Math.max(sentenceTexts.length, 1),
          order: index
        })
      );
      return next;
    });
  }

  function toggleSection(sectionType: string) {
    setRecord((current) => {
      const next = clone(current);
      const section = next.content.sectionControls.find((item) => item.sectionType === sectionType);
      if (section && !section.required) {
        section.enabled = !section.enabled;
      }
      return next;
    });
  }

  function setSectionProfile(profile: "STANDARD_ENGINEERING" | "PROJECT_FORWARD_AI") {
    setRecord((current) => {
      const next = clone(current);
      next.content.sectionOrder.profile = profile;
      next.content.sectionOrder.reason =
        profile === "PROJECT_FORWARD_AI" ? "Project evidence emphasized for this revision." : null;
      return next;
    });
  }

  function updateSkill(
    groupId: string,
    canonicalValue: string,
    updater: (skill: (typeof record.content.skillsGroups)[number]["skills"][number]) => void
  ) {
    setRecord((current) => {
      const next = clone(current);
      const group = next.content.skillsGroups.find((item) => item.groupId === groupId);
      const skill = group?.skills.find((item) => item.canonicalValue === canonicalValue);
      if (skill) {
        updater(skill);
      }
      return next;
    });
  }

  function moveSkill(groupId: string, index: number, direction: -1 | 1) {
    setRecord((current) => {
      const next = clone(current);
      const group = next.content.skillsGroups.find((item) => item.groupId === groupId);
      if (group) {
        group.skills = swapOrder(group.skills, index, direction);
      }
      return next;
    });
  }

  function updateRoleBullet(
    roleId: string,
    statementId: string,
    updater: (bullet: (typeof record.content.professionalExperience)[number]["bullets"][number]) => void
  ) {
    setRecord((current) => {
      const next = clone(current);
      const role = next.content.professionalExperience.find((item) => item.roleId === roleId);
      const bullet = role?.bullets.find((item) => item.statementId === statementId);
      if (bullet) {
        updater(bullet);
      }
      return next;
    });
  }

  function moveRoleBullet(roleId: string, index: number, direction: -1 | 1) {
    setRecord((current) => {
      const next = clone(current);
      const role = next.content.professionalExperience.find((item) => item.roleId === roleId);
      if (role) {
        role.bullets = swapOrder(role.bullets, index, direction);
      }
      return next;
    });
  }

  function updateProjectBullet(
    projectId: string,
    statementId: string,
    updater: (bullet: (typeof record.content.selectedProjects)[number]["bullets"][number]) => void
  ) {
    setRecord((current) => {
      const next = clone(current);
      const project = next.content.selectedProjects.find((item) => item.projectId === projectId);
      const bullet = project?.bullets.find((item) => item.statementId === statementId);
      if (bullet) {
        updater(bullet);
      }
      return next;
    });
  }

  function moveProjectBullet(projectId: string, index: number, direction: -1 | 1) {
    setRecord((current) => {
      const next = clone(current);
      const project = next.content.selectedProjects.find((item) => item.projectId === projectId);
      if (project) {
        project.bullets = swapOrder(project.bullets, index, direction);
      }
      return next;
    });
  }

  function restoreAll() {
    setRecord(clone(initialRecord));
    setSaveState({ kind: "idle" });
    setFinalizeState({ kind: "idle" });
  }

  const currentProfileOrder =
    resumeRevisionConfiguration.sectionProfiles[record.content.sectionOrder.profile];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Resume Studio
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {record.content.targetRole}
            </h1>
            <p className="mt-3 text-base text-stone-600">{record.content.targetCompany}</p>
            <div className="mt-2 space-y-1 text-sm text-stone-500">
              <p>Base composition {record.summary.baseResumeCompositionVersionId}</p>
              <p>Revision version {record.content.revisionId}</p>
              {record.summary.predecessorRevisionId ? (
                <p>Predecessor revision {record.summary.predecessorRevisionId}</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/resume?versionId=${record.summary.baseResumeCompositionVersionId}`}
            >
              Back to Resume Preview
            </a>
            {readOnly ? (
              <a
                className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                href={`/job-descriptions/${jobDescriptionVersionId}/resume/studio?newRevision=1`}
              >
                Create New Revision
              </a>
            ) : (
              <>
                <button
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 disabled:opacity-50"
                  disabled={saveState.kind === "saving"}
                  onClick={() => void saveDraft()}
                  type="button"
                >
                  Save Draft
                </button>
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
                  disabled={finalizeState.kind === "working"}
                  onClick={() => void finalizeDraft()}
                  type="button"
                >
                  Finalize for Audit
                </button>
              </>
            )}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Revision status</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {record.content.status.replace(/_/g, " ")}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Local validation</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {record.summary.localValidationState.replace(/_/g, " ")}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Visible skills</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{visibleSkills}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Estimated pages</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {record.summary.estimatedPageCount}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Latest audit</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {latestAudit ? latestAudit.renderingReadiness.replace(/_/g, " ") : "Not audited"}
            </p>
          </article>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span className={dirty ? "text-amber-700" : "text-stone-500"}>
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          {saveState.message ? <span className="text-stone-600">{saveState.message}</span> : null}
          {finalizeState.message ? (
            <span className="text-rose-700">{finalizeState.message}</span>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Section Controls</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          {record.content.sectionControls.map((section) => (
            <label
              key={section.sectionType}
              className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-700"
            >
              <input
                checked={section.enabled}
                disabled={readOnly || section.required}
                onChange={() => toggleSection(section.sectionType)}
                type="checkbox"
              />
              {section.sectionType.replace(/_/g, " ")}
            </label>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block text-sm text-stone-700">
            <span className="mb-2 block font-semibold">Section order profile</span>
            <select
              className="w-full rounded-2xl border border-stone-300 px-4 py-3"
              disabled={readOnly}
              onChange={(event) =>
                setSectionProfile(event.target.value as "STANDARD_ENGINEERING" | "PROJECT_FORWARD_AI")
              }
              value={record.content.sectionOrder.profile}
            >
              <option value="STANDARD_ENGINEERING">Standard Engineering</option>
              <option value="PROJECT_FORWARD_AI">Project-Forward AI</option>
            </select>
          </label>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
            <p className="font-semibold text-stone-900">Current order</p>
            <p className="mt-2">{currentProfileOrder.join(" -> ")}</p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Professional Summary</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
            <p className="text-sm font-semibold text-stone-900">Original</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
              {record.content.professionalSummary.originalText}
            </p>
          </article>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-stone-900">Revised</span>
            <textarea
              className="min-h-44 w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm leading-6 text-stone-800"
              disabled={readOnly}
              onChange={(event) => updateSummary(event.target.value)}
              value={record.content.professionalSummary.currentText}
            />
            <p className="mt-2 text-sm text-stone-500">
              {record.content.professionalSummary.currentText.trim().split(/\s+/).filter(Boolean).length} words
            </p>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Skills</h2>
        <div className="mt-6 space-y-6">
          {record.content.skillsGroups.map((group) => (
            <article key={group.groupId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <p className="text-lg font-semibold text-stone-900">{group.groupLabel}</p>
              <div className="mt-4 space-y-3">
                {sortByOrder(group.skills).map((skill, index) => (
                  <div key={skill.canonicalValue} className="rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-3 text-sm text-stone-800">
                        <input
                          checked={skill.included}
                          disabled={readOnly}
                          onChange={() =>
                            updateSkill(group.groupId, skill.canonicalValue, (item) => {
                              item.included = !item.included;
                            })
                          }
                          type="checkbox"
                        />
                        {skill.displayValue}
                      </label>
                      <div className="flex gap-2">
                        <button
                          className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700 disabled:opacity-40"
                          disabled={readOnly || index === 0}
                          onClick={() => moveSkill(group.groupId, index, -1)}
                          type="button"
                        >
                          Up
                        </button>
                        <button
                          className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700 disabled:opacity-40"
                          disabled={readOnly || index === group.skills.length - 1}
                          onClick={() => moveSkill(group.groupId, index, 1)}
                          type="button"
                        >
                          Down
                        </button>
                      </div>
                    </div>
                    <label className="mt-3 block text-sm text-stone-700">
                      <span className="mb-2 block font-medium">Qualification</span>
                      <input
                        className="w-full rounded-2xl border border-stone-300 px-4 py-3"
                        disabled={readOnly}
                        onChange={(event) =>
                          updateSkill(group.groupId, skill.canonicalValue, (item) => {
                            item.qualificationText = event.target.value || null;
                          })
                        }
                        value={skill.qualificationText ?? ""}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Professional Experience</h2>
        <div className="mt-6 space-y-6">
          {record.content.professionalExperience.map((role) => (
            <article key={role.roleId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-stone-900">{role.roleTitle}</p>
                  <p className="text-sm text-stone-600">
                    {[role.employer, role.location, role.startDate, role.endDate ?? "Present"]
                      .filter(Boolean)
                      .join(" | ")}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    checked={role.included}
                    disabled={readOnly}
                    onChange={() =>
                      setRecord((current) => {
                        const next = clone(current);
                        const target = next.content.professionalExperience.find((item) => item.roleId === role.roleId);
                        if (target) {
                          target.included = !target.included;
                        }
                        return next;
                      })
                    }
                    type="checkbox"
                  />
                  Include role
                </label>
              </div>
              <div className="mt-4 space-y-3">
                {sortByOrder(role.bullets).map((bullet, index) => (
                  <div key={bullet.statementId} className="rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-3 text-sm text-stone-700">
                        <input
                          checked={bullet.included}
                          disabled={readOnly}
                          onChange={() =>
                            updateRoleBullet(role.roleId, bullet.statementId, (item) => {
                              item.included = !item.included;
                            })
                          }
                          type="checkbox"
                        />
                        Include bullet
                      </label>
                      <div className="flex gap-2">
                        <button
                          className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700 disabled:opacity-40"
                          disabled={readOnly || index === 0}
                          onClick={() => moveRoleBullet(role.roleId, index, -1)}
                          type="button"
                        >
                          Up
                        </button>
                        <button
                          className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700 disabled:opacity-40"
                          disabled={readOnly || index === role.bullets.length - 1}
                          onClick={() => moveRoleBullet(role.roleId, index, 1)}
                          type="button"
                        >
                          Down
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.2em] text-stone-500">Original</p>
                    <p className="mt-1 text-sm leading-6 text-stone-700">{bullet.originalText}</p>
                    <label className="mt-3 block">
                      <span className="mb-2 block text-sm font-medium text-stone-900">Revised</span>
                      <textarea
                        className="min-h-24 w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm leading-6 text-stone-800"
                        disabled={readOnly}
                        onChange={(event) =>
                          updateRoleBullet(role.roleId, bullet.statementId, (item) => {
                            item.currentText = event.target.value;
                          })
                        }
                        value={bullet.currentText}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {record.content.selectedProjects.length > 0 ? (
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-stone-900">Selected Projects</h2>
          <div className="mt-6 space-y-6">
            {record.content.selectedProjects.map((project) => (
              <article key={project.projectId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-stone-900">{project.projectName}</p>
                    <p className="text-sm text-stone-600">{project.contextLabel}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      checked={project.included}
                      disabled={readOnly}
                      onChange={() =>
                        setRecord((current) => {
                          const next = clone(current);
                          const target = next.content.selectedProjects.find(
                            (item) => item.projectId === project.projectId
                          );
                          if (target) {
                            target.included = !target.included;
                          }
                          return next;
                        })
                      }
                      type="checkbox"
                    />
                    Include project
                  </label>
                </div>
                <div className="mt-4 space-y-3">
                  {sortByOrder(project.bullets).map((bullet, index) => (
                    <div key={bullet.statementId} className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-3 text-sm text-stone-700">
                          <input
                            checked={bullet.included}
                            disabled={readOnly}
                            onChange={() =>
                              updateProjectBullet(project.projectId, bullet.statementId, (item) => {
                                item.included = !item.included;
                              })
                            }
                            type="checkbox"
                          />
                          Include bullet
                        </label>
                        <div className="flex gap-2">
                          <button
                            className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700 disabled:opacity-40"
                            disabled={readOnly || index === 0}
                            onClick={() => moveProjectBullet(project.projectId, index, -1)}
                            type="button"
                          >
                            Up
                          </button>
                          <button
                            className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700 disabled:opacity-40"
                            disabled={readOnly || index === project.bullets.length - 1}
                            onClick={() => moveProjectBullet(project.projectId, index, 1)}
                            type="button"
                          >
                            Down
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-stone-500">Original</p>
                      <p className="mt-1 text-sm leading-6 text-stone-700">{bullet.originalText}</p>
                      <label className="mt-3 block">
                        <span className="mb-2 block text-sm font-medium text-stone-900">Revised</span>
                        <textarea
                          className="min-h-24 w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm leading-6 text-stone-800"
                          disabled={readOnly}
                          onChange={(event) =>
                            updateProjectBullet(project.projectId, bullet.statementId, (item) => {
                              item.currentText = event.target.value;
                            })
                          }
                          value={bullet.currentText}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Review Notes</h2>
        <label className="mt-6 block">
          <span className="mb-2 block text-sm font-semibold text-stone-900">Revision note</span>
          <textarea
            className="min-h-32 w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm leading-6 text-stone-800"
            disabled={readOnly}
            onChange={(event) => setRevisionNote(event.target.value)}
            value={noteBody(record.reviewNotes, "REVISION", record.content.revisionId)}
          />
        </label>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Audit Findings</h2>
        <div className="mt-6 space-y-4">
          {latestAudit ? (
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-700">
              <p className="font-semibold text-stone-900">
                {latestAudit.status.replace(/_/g, " ")} â€¢ {latestAudit.renderingReadiness.replace(/_/g, " ")}
              </p>
              <p className="mt-2">{latestAudit.summary ?? "A revision audit exists for this resume."}</p>
            </article>
          ) : (
            <p className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-700">
              No revision audit exists yet.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Change Summary</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Changes</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">{record.summary.changeCount}</p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Edited bullets</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {record.summary.editedBulletCount}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Review notes</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {record.summary.reviewNoteCount}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Provenance</h2>
        <div className="mt-6 space-y-4">
          {record.content.professionalExperience.flatMap((role) =>
            role.bullets.slice(0, 2).map((bullet) => (
              <details
                key={bullet.statementId}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
              >
                <summary className="cursor-pointer text-sm font-semibold text-stone-900">
                  {bullet.statementId}
                </summary>
                <div className="mt-3 text-sm text-stone-700">
                  <p>Evidence: {bullet.provenance.sourceEvidenceIds.join(", ") || "None"}</p>
                  <p>Records: {bullet.provenance.sourceCareerRecordIds.join(", ") || "None"}</p>
                  <p>Requirements: {bullet.provenance.requirementIds.join(", ") || "None"}</p>
                  <p>Truthfulness: {bullet.provenance.truthfulnessClassification}</p>
                </div>
              </details>
            ))
          )}
        </div>
      </section>

      {!readOnly ? (
        <section className="flex gap-3">
          <button
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
            onClick={restoreAll}
            type="button"
          >
            Restore Entire Revision to Base
          </button>
        </section>
      ) : null}
    </div>
  );
}
