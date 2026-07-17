"use client";

import { useState } from "react";
import {
  RENDERING_WARNING_ACKNOWLEDGEMENT
} from "@/lib/resume-rendering-approval/config";
import type {
  ResumeRenderingApprovalEligibility,
  ResumeRenderingApprovalRecord
} from "@/lib/resume-rendering-approval/contract";

type ResumeRenderingApprovalPanelProps = {
  title?: string;
  jobDescriptionVersionId: string;
  applicationId: string | null;
  sourceType: "BASE_COMPOSITION" | "FINALIZED_REVISION";
  sourceId: string;
  initialEligibility: ResumeRenderingApprovalEligibility;
  initialActiveApproval: ResumeRenderingApprovalRecord | null;
  initialHistory: ResumeRenderingApprovalRecord[];
};

export function ResumeRenderingApprovalPanel({
  title = "Rendering Approval",
  jobDescriptionVersionId,
  applicationId,
  sourceType,
  sourceId,
  initialEligibility,
  initialActiveApproval,
  initialHistory
}: ResumeRenderingApprovalPanelProps) {
  const [eligibility, setEligibility] = useState(initialEligibility);
  const [activeApproval, setActiveApproval] = useState(initialActiveApproval);
  const [history, setHistory] = useState(initialHistory);
  const [approvalNote, setApprovalNote] = useState("");
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);
  const [warningAcknowledgement, setWarningAcknowledgement] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [state, setState] = useState<{
    kind: "idle" | "working" | "success" | "error";
    message?: string;
  }>({ kind: "idle" });

  async function approve() {
    setState({ kind: "working" });
    const response = await fetch("/api/resume-rendering-approvals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jobDescriptionVersionId,
        applicationId,
        sourceType,
        sourceId,
        resumeAuditRunId: eligibility.resumeAuditRunId,
        expectedContentChecksum: eligibility.contentChecksum,
        expectedCurrentApprovalId: activeApproval?.approvalId ?? null,
        warningAcknowledged,
        warningAcknowledgement:
          warningAcknowledgement.trim().length > 0 ? warningAcknowledgement : null,
        approvalNote: approvalNote.trim().length > 0 ? approvalNote : null
      })
    });
    const payload = await response.json();

    if (!response.ok) {
      setState({
        kind: "error",
        message: payload.error ?? "Failed to create rendering approval."
      });
      return;
    }

    setActiveApproval(payload.approval);
    setHistory(payload.history);
    setEligibility(payload.eligibility);
    setState({
      kind: "success",
      message: payload.duplicate
        ? "The exact approval was already active, so the existing record was reused."
        : "Rendering approval is now active."
    });
  }

  async function revoke() {
    if (!activeApproval) {
      return;
    }

    setState({ kind: "working" });
    const response = await fetch(
      `/api/resume-rendering-approvals/${activeApproval.approvalId}/revoke`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          approvalId: activeApproval.approvalId,
          expectedActiveApprovalId: activeApproval.approvalId,
          reason: revokeReason.trim().length > 0 ? revokeReason : null,
          jobDescriptionVersionId,
          applicationId,
          sourceType,
          sourceId,
          resumeAuditRunId: eligibility.resumeAuditRunId
        })
      }
    );
    const payload = await response.json();

    if (!response.ok) {
      setState({
        kind: "error",
        message: payload.error ?? "Failed to revoke the active rendering approval."
      });
      return;
    }

    setActiveApproval(payload.activeApproval);
    setHistory(payload.history);
    setEligibility(payload.eligibility);
    setState({
      kind: "success",
      message: "The active rendering approval was revoked."
    });
  }

  const activeMatchesProposed =
    activeApproval?.sourceType === sourceType && activeApproval.sourceId === sourceId;

  return (
    <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-stone-900">{title}</h2>
          <p className="mt-2 text-sm text-stone-600">
            Exact content source {sourceType.replace(/_/g, " ")} with audit{" "}
            {eligibility.resumeAuditRunId ?? "not available"}.
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
          <p className="font-semibold text-stone-900">
            {eligibility.renderingReadiness?.replace(/_/g, " ") ?? "Not eligible"}
          </p>
          <p className="mt-1">
            {eligibility.blockingCount} blocking findings, {eligibility.warningCount} warnings
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-medium text-stone-500">Current approval</p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {activeApproval ? activeApproval.status.replace(/_/g, " ") : "No active approval"}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            {activeApproval
              ? `${activeApproval.sourceType.replace(/_/g, " ")} approved ${new Date(activeApproval.approvedAt).toLocaleString()}`
              : "Approve an audited immutable source before any rendering step."}
          </p>
        </article>
        <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-medium text-stone-500">Eligibility</p>
          <p className="mt-2 text-lg font-semibold text-stone-900">
            {eligibility.eligible
              ? eligibility.warningAcknowledgementRequired
                ? "Eligible with warning acknowledgement"
                : "Eligible"
              : "Not eligible"}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            {eligibility.contentChecksum
              ? `Content checksum ${eligibility.contentChecksum.slice(0, 12)}...`
              : "A matching immutable content checksum is required."}
          </p>
        </article>
      </div>

      <div className="mt-6 space-y-3">
        {eligibility.diagnostics.map((diagnostic) => (
          <article
            key={`${diagnostic.code}-${diagnostic.message}`}
            className={`rounded-2xl border p-4 text-sm ${
              diagnostic.severity === "ERROR"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : diagnostic.severity === "WARNING"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-stone-200 bg-stone-50 text-stone-700"
            }`}
          >
            <p className="font-semibold">{diagnostic.message}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em]">{diagnostic.code}</p>
          </article>
        ))}
      </div>

      {eligibility.warningAcknowledgementRequired ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <label className="flex items-center gap-3 text-sm text-amber-900">
            <input
              checked={warningAcknowledged}
              onChange={(event) => setWarningAcknowledged(event.target.checked)}
              type="checkbox"
            />
            I want to approve this resume despite the remaining non-blocking warnings.
          </label>
          <label className="mt-4 block text-sm text-amber-900">
            <span className="mb-2 block font-semibold">Required acknowledgement</span>
            <input
              className="w-full rounded-2xl border border-amber-300 bg-white px-4 py-3 text-stone-900"
              onChange={(event) => setWarningAcknowledgement(event.target.value)}
              placeholder={RENDERING_WARNING_ACKNOWLEDGEMENT}
              value={warningAcknowledgement}
            />
          </label>
        </div>
      ) : null}

      <label className="mt-6 block text-sm text-stone-700">
        <span className="mb-2 block font-semibold">Approval note</span>
        <textarea
          className="min-h-28 w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm leading-6 text-stone-800"
          onChange={(event) => setApprovalNote(event.target.value)}
          value={approvalNote}
        />
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
          disabled={
            state.kind === "working" ||
            !eligibility.eligible ||
            activeMatchesProposed ||
            (eligibility.warningAcknowledgementRequired &&
              (!warningAcknowledged ||
                warningAcknowledgement !== RENDERING_WARNING_ACKNOWLEDGEMENT))
          }
          onClick={() => void approve()}
          type="button"
        >
          Approve for Rendering
        </button>
        {activeApproval ? (
          <>
            <label className="min-w-72 flex-1 text-sm text-stone-700">
              <span className="mb-2 block font-semibold">Revocation reason</span>
              <input
                className="w-full rounded-2xl border border-stone-300 px-4 py-3"
                onChange={(event) => setRevokeReason(event.target.value)}
                value={revokeReason}
              />
            </label>
            <button
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 disabled:opacity-50"
              disabled={state.kind === "working" || !activeMatchesProposed}
              onClick={() => void revoke()}
              type="button"
            >
              Revoke Approval
            </button>
          </>
        ) : null}
      </div>

      {state.message ? (
        <p
          className={`mt-4 text-sm ${
            state.kind === "error" ? "text-rose-700" : "text-stone-600"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-stone-900">Approval History</h3>
        <div className="mt-4 space-y-3">
          {history.length === 0 ? (
            <p className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
              No rendering approvals have been recorded yet.
            </p>
          ) : (
            history.map((approval, index) => (
              <article
                key={approval.approvalId}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700"
              >
                <p className="font-semibold text-stone-900">
                  Approval {history.length - index} {approval.status === "APPROVED" ? "(Active)" : ""}
                </p>
                <p className="mt-1">
                  {approval.sourceType.replace(/_/g, " ")} • {new Date(approval.approvedAt).toLocaleString()}
                </p>
                <p className="mt-1">
                  Warnings {approval.warningCount} • Blocking {approval.blockingCount}
                </p>
                {approval.approvalNote ? <p className="mt-2">{approval.approvalNote}</p> : null}
                {approval.revokedAt ? (
                  <p className="mt-2 text-rose-700">
                    Revoked {new Date(approval.revokedAt).toLocaleString()}
                  </p>
                ) : null}
                {approval.supersededAt ? (
                  <p className="mt-2 text-stone-600">
                    Superseded {new Date(approval.supersededAt).toLocaleString()}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
