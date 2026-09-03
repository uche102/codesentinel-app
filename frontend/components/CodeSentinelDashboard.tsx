"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileCode2,
  Github,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AccountPanel } from "./AccountPanel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useAnalyzeProject } from "@/lib/hooks/useCodeSentinel";
import type { FeePresetLevel } from "@/lib/genlayer/fees";
import type {
  GithubRepoAnalysis,
  ProjectAssessment,
  ProjectData,
  ProjectMaturity,
} from "@/lib/contracts/types";
import { useWallet } from "@/lib/genlayer/wallet";
import { error, success } from "@/lib/utils/toast";

const maturityLabels: Record<ProjectMaturity, string> = {
  insufficient_evidence: "Insufficient evidence",
  early_stage: "Early stage",
  developing: "Developing",
  production_ready: "Production ready",
};

const maturityClassName: Record<ProjectMaturity, string> = {
  insufficient_evidence: "border-zinc-500/40 bg-zinc-500/15 text-zinc-200",
  early_stage: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  developing: "border-sky-500/40 bg-sky-500/15 text-sky-200",
  production_ready: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
};

const defaultForm: ProjectData = {
  name: "",
  has_readme: true,
  has_tests: true,
  has_ci: false,
  file_count: 120,
  test_file_count: 24,
};

function normalizeProjectData(form: ProjectData): ProjectData {
  return {
    ...form,
    name: form.name.trim(),
    file_count: Number(form.file_count),
    test_file_count: Number(form.test_file_count),
  };
}

function validateProjectData(projectData: ProjectData): string | null {
  if (!projectData.name) {
    return "Project name is required.";
  }

  if (!Number.isInteger(projectData.file_count) || projectData.file_count < 0) {
    return "File count must be a non-negative whole number.";
  }

  if (
    !Number.isInteger(projectData.test_file_count) ||
    projectData.test_file_count < 0
  ) {
    return "Test file count must be a non-negative whole number.";
  }

  if (projectData.test_file_count > projectData.file_count) {
    return "Test file count cannot exceed total file count.";
  }

  return null;
}

function AssessmentList({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: string[];
  icon: typeof CheckCircle2;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 shadow-[0_20px_80px_rgba(15,23,42,0.45)] backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-fuchsia-400/25 bg-fuchsia-500/10">
          <Icon className="h-4 w-4 text-fuchsia-200" />
        </div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/75">
          {title}
        </h3>
      </div>
      {items.length ? (
        <ul className="space-y-2.5">
          {items.map((item, index) => (
            <li
              key={`${title}-${index}`}
              className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-200/90"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">No items returned.</p>
      )}
    </section>
  );
}

function AssessmentResult({
  assessment,
}: {
  assessment: ProjectAssessment | null;
}) {
  if (!assessment) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-[#0a0d16]/80 p-8 text-center shadow-[0_28px_80px_rgba(15,23,42,0.35)]">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-500/10 ring-1 ring-cyan-400/15">
          <Bot className="h-7 w-7 text-cyan-200" />
        </div>
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">
          Awaiting assessment
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
          Submit repository evidence to receive a validator-checked maturity
          score, risks, strengths, and next engineering recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-[#0c1018]/90 p-5 shadow-[0_24px_80px_rgba(9,14,24,0.45)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Overall score
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-5xl font-bold leading-none text-white">
                {assessment.overall_score}
              </span>
              <span className="pb-1 text-sm text-slate-400">/ 100</span>
            </div>
          </div>
          <Badge
            className={maturityClassName[assessment.maturity]}
            variant="outline"
          >
            {maturityLabels[assessment.maturity]}
          </Badge>
        </div>
        <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-fuchsia-400 shadow-[0_0_18px_rgba(59,130,246,0.5)]"
            style={{ width: `${assessment.overall_score}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <AssessmentList
          title="Strengths"
          items={assessment.strengths}
          icon={CheckCircle2}
        />
        <AssessmentList
          title="Risks"
          items={assessment.risks}
          icon={AlertTriangle}
        />
        <AssessmentList
          title="Recommendations"
          items={assessment.recommendations}
          icon={ClipboardCheck}
        />
      </div>
    </div>
  );
}

export function CodeSentinelDashboard() {
  const { isConnected, address } = useWallet();
  const { analyzeProjectAsync, isAnalyzing } = useAnalyzeProject();
  const [repoUrl, setRepoUrl] = useState("");
  const [isInspectingRepo, setIsInspectingRepo] = useState(false);
  const [repoSummary, setRepoSummary] = useState<
    GithubRepoAnalysis["summary"] | null
  >(null);
  const [form, setForm] = useState<ProjectData>(defaultForm);
  const [feePresetLevel, setFeePresetLevel] =
    useState<FeePresetLevel>("standard");
  const [assessment, setAssessment] = useState<ProjectAssessment | null>(null);

  const evidenceSummary = useMemo(
    () => [
      { label: "README", value: form.has_readme ? "Present" : "Missing" },
      { label: "Tests", value: form.has_tests ? "Present" : "Missing" },
      { label: "CI", value: form.has_ci ? "Present" : "Missing" },
      { label: "Files", value: String(form.file_count || 0) },
      { label: "Language", value: form.primary_language || "Unknown" },
      { label: "Workflows", value: String(form.workflow_count || 0) },
    ],
    [form],
  );

  const updateField = <K extends keyof ProjectData>(
    field: K,
    value: ProjectData[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleInspectGithub = async () => {
    if (!repoUrl.trim()) {
      error("GitHub URL is required");
      return;
    }

    setIsInspectingRepo(true);
    setRepoSummary(null);

    try {
      const response = await fetch("/api/github/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
      const payload = (await response.json()) as
        | GithubRepoAnalysis
        | { error?: string };

      if (!response.ok) {
        const message = "error" in payload ? payload.error : undefined;
        throw new Error(message || "Unable to inspect GitHub repository.");
      }

      if (!("projectData" in payload)) {
        throw new Error("GitHub response did not include project evidence.");
      }

      setForm(payload.projectData);
      setRepoSummary(payload.summary);
      setAssessment(null);
      success("Repository inspected", {
        description: "Project evidence was populated from GitHub.",
      });
    } catch (err) {
      error("GitHub inspection failed", {
        description:
          err instanceof Error
            ? err.message
            : "Please check the repository URL.",
      });
    } finally {
      setIsInspectingRepo(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isConnected || !address) {
      error("Connect your wallet first");
      return;
    }

    const projectData = normalizeProjectData(form);
    const validationError = validateProjectData(projectData);
    if (validationError) {
      error("Invalid project evidence", { description: validationError });
      return;
    }

    try {
      const result = await analyzeProjectAsync({ projectData, feePresetLevel });
      setAssessment(result.assessment);
    } catch (err) {
      // The mutation reports both cancellations and failures through toast.
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.20),transparent_25%),radial-gradient(circle_at_right,rgba(34,211,238,0.14),transparent_25%),linear-gradient(180deg,#05070d_0%,#0b1018_28%,#05070d_100%)] text-white">
      <header className="border-b border-white/10 bg-black/35 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
              <ShieldCheck className="h-5 w-5 text-cyan-200" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-[-0.04em]">
                CodeSentinel
              </p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                GenLayer technical maturity oracle
              </p>
            </div>
          </div>
          <AccountPanel />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <section className="mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0f18]/80 p-6 shadow-[0_32px_80px_rgba(15,23,42,0.4)] ring-1 ring-white/5 md:p-8">
          <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Badge className="border-cyan-400/30 bg-cyan-500/10 text-cyan-100">
                Builder trust layer
              </Badge>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.07em] text-white md:text-5xl">
                Assess repository maturity before launch.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                Evaluate project readiness with repository evidence,
                validator-style scoring, and GenLayer-native risk intelligence.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-sm text-slate-200">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
              Live validator checks
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {evidenceSummary.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(19,25,38,0.9),rgba(8,10,18,0.8))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  {item.label}
                </p>
                <p className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-white">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <section className="rounded-[28px] border border-white/10 bg-[#0a0d16]/85 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur-sm md:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                  Project evidence
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
                  Repository signal input
                </h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/10">
                <FileCode2 className="h-5 w-5 text-fuchsia-200" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="repo_url" className="text-slate-200">
                  GitHub repository
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="repo_url"
                    value={repoUrl}
                    onChange={(event) => setRepoUrl(event.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="h-11 rounded-xl border-white/10 bg-white/[0.03] text-white placeholder:text-slate-500"
                  />
                  <Button
                    className="h-11 shrink-0 rounded-xl border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/[0.06]"
                    disabled={isInspectingRepo}
                    onClick={handleInspectGithub}
                    type="button"
                    variant="outline"
                  >
                    {isInspectingRepo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Github className="h-4 w-4" />
                    )}
                    Inspect
                  </Button>
                </div>
                {repoSummary ? (
                  <p className="text-xs leading-5 text-slate-400">
                    Inspected {repoSummary.inspectedFiles} files on{" "}
                    {repoSummary.defaultBranch}
                    {repoSummary.treeTruncated
                      ? "; GitHub truncated the tree"
                      : ""}
                    .
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-200">
                  Project name
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Example: payments-api"
                  className="h-11 rounded-xl border-white/10 bg-white/[0.03] text-white placeholder:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="file_count" className="text-slate-200">
                    Files
                  </Label>
                  <Input
                    id="file_count"
                    min={0}
                    type="number"
                    value={form.file_count}
                    onChange={(event) =>
                      updateField("file_count", Number(event.target.value))
                    }
                    className="h-11 rounded-xl border-white/10 bg-white/[0.03] text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test_file_count" className="text-slate-200">
                    Test files
                  </Label>
                  <Input
                    id="test_file_count"
                    min={0}
                    type="number"
                    value={form.test_file_count}
                    onChange={(event) =>
                      updateField("test_file_count", Number(event.target.value))
                    }
                    className="h-11 rounded-xl border-white/10 bg-white/[0.03] text-white"
                  />
                </div>
              </div>

              <div className="grid gap-3">
                {(
                  [
                    ["has_readme", "README"],
                    ["has_tests", "Automated tests"],
                    ["has_ci", "CI workflow"],
                  ] as const
                ).map(([field, label]) => (
                  <label
                    key={field}
                    className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-slate-200 transition-colors hover:border-cyan-400/30 hover:bg-cyan-500/5"
                  >
                    <span>{label}</span>
                    <input
                      checked={form[field]}
                      className="h-4 w-4 accent-cyan-300"
                      type="checkbox"
                      onChange={(event) =>
                        updateField(field, event.target.checked)
                      }
                    />
                  </label>
                ))}
              </div>

              <div className="space-y-3">
                <Label className="text-slate-200">Fee preset</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: "low", label: "Low" },
                      { value: "standard", label: "Standard" },
                      { value: "high", label: "High" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFeePresetLevel(option.value)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                        feePresetLevel === option.value
                          ? "border-cyan-300/60 bg-cyan-500/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.15)]"
                          : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20 hover:bg-white/[0.04]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="h-12 w-full rounded-xl bg-[linear-gradient(135deg,#8b5cf6_0%,#a855f7_35%,#22d3ee_100%)] text-white shadow-[0_18px_42px_rgba(124,58,237,0.35)] hover:brightness-110"
                disabled={isAnalyzing}
                type="submit"
                variant="default"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Run Assessment
                  </>
                )}
              </Button>
            </form>
          </section>

          <section className="space-y-6">
            <AssessmentResult assessment={assessment} />
          </section>
        </div>
      </main>
    </div>
  );
}
