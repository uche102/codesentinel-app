"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  ChevronDown,
  FileCode2,
  FileText,
  Github,
  GitBranch,
  Loader2,
  ScanSearch,
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
  AssessmentFinding,
  GithubRepoAnalysis,
  ProjectAssessment,
  ProjectData,
  ProjectMaturity,
} from "@/lib/contracts/types";
import { useWallet } from "@/lib/genlayer/wallet";
import { readJsonResponse } from "@/lib/github/response";
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

function createEmptyProjectForm(): ProjectData {
  return {
    name: "",
    has_readme: false,
    has_tests: false,
    has_ci: false,
    file_count: 0,
    test_file_count: 0,
    repository_files: [],
  };
}

const defaultForm: ProjectData = createEmptyProjectForm();

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

  if (projectData.repository_files.length === 0) {
    return "Inspect a GitHub repository to attach source evidence before assessment.";
  }

  return null;
}

function AssessmentList({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: AssessmentFinding[];
  icon: typeof CheckCircle2;
}) {
  const listLabel = title.toLowerCase();

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-white/[0.07] bg-[#0d121c] p-4 transition-colors hover:border-white/[0.12]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07]">
            <Icon className="h-4 w-4 text-cyan-100" />
          </div>
          <h3 className="truncate text-sm font-semibold text-white">{title}</h3>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs tabular-nums text-slate-400">
          {items.length}
        </span>
      </div>
      {items.length ? (
        <ul className="flex-1 space-y-3">
          {items.map((item, index) => (
            <li
              key={`${title}-${index}`}
              className="rounded-xl border border-white/[0.06] bg-black/20 p-3"
            >
              <p className="text-sm leading-6 text-slate-200">{item.finding}</p>
              <ul className="mt-3 space-y-2">
                {item.evidence.map((citation, citationIndex) => (
                  <li
                    key={`${citation.path}-${citationIndex}`}
                    className="min-w-0 rounded-lg border-l-2 border-cyan-300/40 bg-cyan-300/[0.035] px-3 py-2"
                  >
                    <p className="truncate font-mono text-[11px] text-cyan-100/80">
                      {citation.path}
                    </p>
                    <p className="mt-1 break-words text-xs leading-5 text-slate-400">
                      “{citation.quote}”
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 items-center rounded-xl border border-dashed border-white/[0.08] px-3 py-4">
          <p className="text-sm leading-5 text-slate-500">
            No {listLabel} supported by the submitted evidence.
          </p>
        </div>
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
      <div className="flex min-h-[500px] flex-col items-center justify-center rounded-3xl border border-white/[0.07] bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.07),transparent_55%),#0a0e16] p-8 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06]">
          <Bot className="h-7 w-7 text-cyan-100" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/70">
          Assessment workspace
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
          Your report will appear here
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
          Inspect a public GitHub repository, then run an evidence-backed
          assessment to see its maturity score, cited findings, and next steps.
        </p>
        <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-2 text-left">
          {[
            { number: "01", label: "Inspect", icon: ScanSearch },
            { number: "02", label: "Cite", icon: FileText },
            { number: "03", label: "Verify", icon: ShieldCheck },
          ].map(({ number, label, icon: StepIcon }) => (
            <div
              key={number}
              className="rounded-xl border border-white/[0.06] bg-black/20 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-slate-600">
                  {number}
                </span>
                <StepIcon className="h-3.5 w-3.5 text-cyan-100/60" />
              </div>
              <p className="mt-3 text-xs font-medium text-slate-300">{label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(ellipse_at_85%_0%,rgba(34,211,238,0.11),transparent_36%),#0c111a]">
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-center gap-5">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full p-[1px]"
              style={{
                background: `conic-gradient(#67e8f9 ${assessment.overall_score}%, rgba(255,255,255,0.08) 0)`,
              }}
            >
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#0c111a]">
                <span className="text-3xl font-semibold tabular-nums tracking-tight text-white">
                  {assessment.overall_score}
                </span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  score
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">
                Repository maturity
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Based on cited repository evidence
              </p>
              <Badge
                className={`mt-3 ${maturityClassName[assessment.maturity]}`}
                variant="outline"
              >
                {maturityLabels[assessment.maturity]}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {[
              { label: "Strengths", value: assessment.strengths.length },
              { label: "Risks", value: assessment.risks.length },
              { label: "Next steps", value: assessment.recommendations.length },
            ].map((item) => (
              <div
                key={item.label}
                className="min-w-[96px] rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5"
              >
                <p className="text-lg font-semibold tabular-nums text-white">
                  {item.value}
                </p>
                <p className="text-[11px] text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-white/[0.06] px-5 py-3 sm:px-7">
          <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-100/70" />
          <p className="text-xs leading-5 text-slate-400">
            Findings are checked against source excerpts and independently
            reviewed by validators.
          </p>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-3">
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
  const latestInspectRequestRef = useRef(0);

  const resetRepoInspectionState = () => {
    setAssessment(null);
    setRepoSummary(null);
    setForm(createEmptyProjectForm());
  };

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

    const requestId = latestInspectRequestRef.current + 1;
    latestInspectRequestRef.current = requestId;

    setIsInspectingRepo(true);
    resetRepoInspectionState();

    try {
      const response = await fetch("/api/github/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });

      let payload: GithubRepoAnalysis | { error?: string } | null = null;

      try {
        payload = (await readJsonResponse(response)) as
          | GithubRepoAnalysis
          | { error?: string }
          | null;
      } catch (error) {
        if (!response.ok) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to inspect GitHub repository.";
          throw new Error(message);
        }

        throw error;
      }

      if (!response.ok) {
        const message =
          payload && "error" in payload ? payload.error : undefined;
        throw new Error(message || "Unable to inspect GitHub repository.");
      }

      if (requestId !== latestInspectRequestRef.current) {
        return;
      }

      if (!payload || !("projectData" in payload)) {
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

  const simulateAssessment = () => {
    const sample: ProjectAssessment = {
      overall_score: 85,
      maturity: "production_ready",
      strengths: [
        {
          finding: "The project contains automated tests.",
          evidence: [{ path: "tests/example.test.ts", quote: "describe(" }],
        },
      ],
      risks: [
        {
          finding: "The README does not document deployment.",
          evidence: [{ path: "README.md", quote: "# Example Project" }],
        },
      ],
      recommendations: [
        {
          finding: "Document the deployment process.",
          evidence: [{ path: "README.md", quote: "# Example Project" }],
        },
      ],
    };

    setAssessment(sample);
    success("Simulated assessment applied");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_50%_-15%,rgba(31,107,128,0.18),transparent_48%),linear-gradient(180deg,#080b11_0%,#090d14_45%,#070a10_100%)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#080b11]/85 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07]">
              <ShieldCheck className="h-5 w-5 text-cyan-200" />
            </div>
            <div>
              <p className="text-base font-semibold tracking-[-0.03em]">
                Code<span className="text-cyan-100">Sentinel</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Repository intelligence
              </p>
            </div>
          </div>
          <AccountPanel />
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pb-12 pt-8 md:px-8 md:pt-10">
        <section className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-px w-6 bg-cyan-200/60" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/70">
                GenLayer · Evidence-first review
              </p>
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.055em] text-white md:text-5xl">
              Know what your repository{" "}
              <span className="text-slate-400">is ready for.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
              Turn source files into a maturity report with traceable findings,
              independent validator review, and practical next steps.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-300/[0.08]">
              <ShieldCheck className="h-4 w-4 text-emerald-200" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-200">
                Validator reviewed
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Claims must cite repository files
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-white/[0.07] bg-[#0c111a] p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-cyan-100/70" />
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-300">
                Repository signals
              </p>
            </div>
            {repoSummary ? (
              <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-2.5 py-1 text-[10px] font-medium text-emerald-100/80">
                {repoSummary.evidenceFiles} evidence files attached
              </span>
            ) : (
              <span className="text-[11px] text-slate-600">
                Populated after inspection
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {evidenceSummary.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-black/20 px-3 py-2.5"
              >
                <p className="text-[11px] text-slate-500">{item.label}</p>
                <p className="truncate text-xs font-medium text-slate-200">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/[0.06] font-mono text-[10px] text-cyan-100">
              01
            </span>
            <h2 className="text-sm font-semibold text-slate-200">
              Inspect and assess
            </h2>
          </div>
          <p className="hidden text-xs text-slate-600 sm:block">
            Public GitHub repositories
          </p>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(360px,0.78fr)_minmax(0,1.22fr)]">
          <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0c111a]">
            <div className="border-b border-white/[0.06] p-5 md:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06]">
                  <FileCode2 className="h-4 w-4 text-cyan-100" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Project evidence
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Inspect a repository to attach verifiable source excerpts.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5 md:p-6">
              <div className="space-y-2">
                <Label htmlFor="repo_url" className="text-xs font-medium text-slate-300">
                  GitHub repository
                </Label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Github className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      id="repo_url"
                      value={repoUrl}
                      onChange={(event) => setRepoUrl(event.target.value)}
                      placeholder="github.com/owner/repo"
                      className="h-11 rounded-xl border-white/[0.08] bg-black/25 pl-9 text-sm text-white placeholder:text-slate-600 focus-visible:border-cyan-300/40 focus-visible:ring-cyan-300/15"
                    />
                  </div>
                  <Button
                    className="h-11 shrink-0 rounded-xl border-white/[0.09] bg-white/[0.04] px-3 text-slate-100 hover:border-cyan-200/20 hover:bg-cyan-200/[0.06]"
                    disabled={isInspectingRepo || isAnalyzing}
                    onClick={handleInspectGithub}
                    type="button"
                    variant="outline"
                  >
                    {isInspectingRepo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ScanSearch className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">
                      {isInspectingRepo ? "Inspecting" : "Inspect"}
                    </span>
                  </Button>
                </div>
                {repoSummary ? (
                  <p className="flex items-center gap-1.5 text-[11px] leading-5 text-slate-500">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300/70" />
                    Inspected {repoSummary.inspectedFiles} files on{" "}
                    {repoSummary.defaultBranch}
                    {repoSummary.treeTruncated ? " · tree truncated" : ""}
                  </p>
                ) : (
                  <p className="text-[11px] leading-5 text-slate-600">
                    We’ll inspect the repository tree and select relevant files.
                  </p>
                )}
              </div>

              {repoSummary && form.repository_files.length > 0 ? (
                <details className="group rounded-xl border border-white/[0.07] bg-black/15">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs text-slate-300 marker:hidden">
                    <span className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-cyan-100/70" />
                      Evidence excerpts
                      <span className="text-slate-600">
                        ({form.repository_files.length})
                      </span>
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-600 transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="max-h-48 space-y-2 overflow-y-auto border-t border-white/[0.06] p-3">
                    {form.repository_files.map((file) => (
                      <li
                        key={file.path}
                        className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5"
                      >
                        <p className="truncate font-mono text-[10px] text-cyan-100/75">
                          {file.path}
                        </p>
                        <p className="mt-1 line-clamp-2 break-all font-mono text-[10px] leading-4 text-slate-500">
                          {file.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-medium text-slate-300">
                  Project name
                </Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Example: payments-api"
                  className="h-11 rounded-xl border-white/[0.08] bg-black/25 text-sm text-white placeholder:text-slate-600 focus-visible:border-cyan-300/40 focus-visible:ring-cyan-300/15"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="file_count" className="text-xs font-medium text-slate-300">
                    Total files
                  </Label>
                  <Input
                    id="file_count"
                    min={0}
                    type="number"
                    value={form.file_count}
                    onChange={(event) =>
                      updateField("file_count", Number(event.target.value))
                    }
                    className="h-10 rounded-xl border-white/[0.08] bg-black/25 text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test_file_count" className="text-xs font-medium text-slate-300">
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
                    className="h-10 rounded-xl border-white/[0.08] bg-black/25 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["has_readme", "README"],
                    ["has_tests", "Automated tests"],
                    ["has_ci", "CI workflow"],
                  ] as const
                ).map(([field, label]) => (
                  <label
                    key={field}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2.5 text-xs text-slate-300 transition-colors hover:border-cyan-200/20"
                  >
                    <input
                      checked={form[field]}
                      className="h-3.5 w-3.5 accent-cyan-300"
                      type="checkbox"
                      onChange={(event) =>
                        updateField(field, event.target.checked)
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-slate-300">
                    Transaction fee
                  </Label>
                  <span className="text-[10px] text-slate-600">
                    Choose a comfort level
                  </span>
                </div>
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
                      aria-pressed={feePresetLevel === option.value}
                      onClick={() => setFeePresetLevel(option.value)}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/50 ${
                        feePresetLevel === option.value
                          ? "border-cyan-200/30 bg-cyan-200/[0.08] text-cyan-50"
                          : "border-white/[0.07] bg-black/15 text-slate-400 hover:bg-white/[0.04]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="h-12 w-full rounded-xl bg-cyan-200 text-[#071016] shadow-[0_8px_24px_rgba(34,211,238,0.12)] transition-all hover:bg-cyan-100 disabled:bg-slate-700 disabled:text-slate-400"
                disabled={isAnalyzing || isInspectingRepo}
                type="submit"
                variant="default"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting for validator review
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Run assessment
                  </>
                )}
              </Button>
              {process.env.NODE_ENV !== "production" && (
                <Button
                  type="button"
                  onClick={simulateAssessment}
                  className="h-9 w-full rounded-xl border-white/[0.07] bg-transparent text-xs text-slate-500 hover:bg-white/[0.03] hover:text-slate-300"
                  variant="outline"
                >
                  Preview sample report
                </Button>
              )}
            </form>
          </section>

          <section aria-live="polite" className="min-w-0">
            <AssessmentResult assessment={assessment} />
          </section>
        </div>
      </main>
    </div>
  );
}
