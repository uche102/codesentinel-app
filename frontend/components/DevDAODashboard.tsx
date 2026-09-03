"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Brain,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  GitBranch,
  LayoutDashboard,
  Plus,
  ShieldCheck,
  Users,
  Vote,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AccountPanel } from "./AccountPanel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useDevDAO } from "@/lib/hooks/useDevDAO";
import { useWallet, formatAddress } from "@/lib/genlayer/wallet";
import type { AIEvaluation, Proposal, ProposalInput, ProposalStatus, VoteChoice } from "@/lib/contracts/types";

type View = "dashboard" | "create" | "details" | "governance";

const categories = [
  "Developer Tool",
  "SDK",
  "Documentation",
  "Infrastructure",
  "Open Source",
  "Education",
  "Security Review",
  "Protocol Tooling",
];

const demoEvaluation: AIEvaluation = {
  feasibility: 9,
  impact: 9,
  technical_risk: 7,
  budget: 8,
  overall_score: 8.4,
  recommendation: "APPROVE",
  reasoning:
    "The scope is focused, the repository target is clear, and the requested funding is reasonable for a developer-facing deliverable.",
  validator_agreement: "4/5 validators agree",
};

const demoProposals: Proposal[] = [
  {
    id: 3,
    title: "Build a Rust SDK for GenLayer",
    description:
      "Create a typed Rust SDK with contract calls, wallet helpers, examples, and CI-backed integration tests for backend developers building on GenLayer.",
    category: "SDK",
    requested_funding: 500,
    repository_url: "https://github.com/devdao/genlayer-rust-sdk",
    proposer: "0x8f6C2e6aD27eB470Bf36461F2d3a3B54e09Aa91",
    created_at: "3",
    status: "APPROVED",
    yes_votes: 11,
    no_votes: 4,
    ai_evaluation: demoEvaluation,
  },
  {
    id: 2,
    title: "Improve intelligent contract examples",
    description:
      "Add concise examples for nondeterministic execution, validator prompts, structured response validation, and frontend reads from deployed contracts.",
    category: "Documentation",
    requested_funding: 300,
    repository_url: "https://github.com/devdao/genlayer-examples",
    proposer: "0x42a660c2383e80987B3F93574151F5f348E73D6",
    created_at: "2",
    status: "ACTIVE",
    yes_votes: 7,
    no_votes: 2,
    ai_evaluation: { ...demoEvaluation, overall_score: 8.1, feasibility: 8, budget: 9 },
  },
  {
    id: 1,
    title: "Security review starter kit",
    description:
      "Build a small checklist, template repository, and test harness that helps teams review GenLayer contracts before deployment.",
    category: "Security Review",
    requested_funding: 450,
    repository_url: "https://github.com/devdao/security-review-kit",
    proposer: "0x17788A7aD8A092C90248d4620552A88b8c52C10",
    created_at: "1",
    status: "ACTIVE",
    yes_votes: 5,
    no_votes: 5,
    ai_evaluation: {
      ...demoEvaluation,
      feasibility: 7,
      impact: 8,
      technical_risk: 6,
      budget: 7,
      overall_score: 7.2,
      recommendation: "APPROVE",
      validator_agreement: "3/5 validators agree",
    },
  },
];

const emptyForm: ProposalInput = {
  title: "",
  description: "",
  category: categories[0],
  requested_funding: 250,
  repository_url: "",
};

function votePercent(proposal: Proposal) {
  const total = proposal.yes_votes + proposal.no_votes;
  if (total === 0) return 0;
  return Math.round((proposal.yes_votes / total) * 100);
}

function statusTone(status: ProposalStatus) {
  if (status === "APPROVED") return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  if (status === "REJECTED") return "border-rose-400/40 bg-rose-400/10 text-rose-200";
  return "border-cyan-400/40 bg-cyan-400/10 text-cyan-200";
}

function recommendationTone(recommendation: string) {
  return recommendation === "APPROVE"
    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
    : "border-rose-400/40 bg-rose-400/10 text-rose-200";
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof LayoutDashboard;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">{label}</p>
        <Icon className="size-4 text-cyan-300" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ProposalCard({ proposal, onOpen }: { proposal: Proposal; onOpen: () => void }) {
  const yesPercent = votePercent(proposal);

  return (
    <article className="rounded-lg border border-white/10 bg-zinc-950/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white">{proposal.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline" className="border-white/15 text-zinc-300">
              {proposal.category}
            </Badge>
            <Badge variant="outline" className={statusTone(proposal.status)}>
              {proposal.status}
            </Badge>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onOpen}>
          View
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-zinc-500">Funding</p>
          <p className="font-medium text-zinc-100">{proposal.requested_funding} USDC</p>
        </div>
        <div>
          <p className="text-zinc-500">AI score</p>
          <p className="font-medium text-zinc-100">{proposal.ai_evaluation.overall_score}/10</p>
        </div>
        <div>
          <p className="text-zinc-500">YES vote</p>
          <p className="font-medium text-zinc-100">{yesPercent}%</p>
        </div>
      </div>

      <div className="mt-4 h-2 rounded-full bg-zinc-800">
        <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${yesPercent}%` }} />
      </div>
    </article>
  );
}

function EvaluationPanel({ evaluation }: { evaluation: AIEvaluation }) {
  const rows = [
    ["Feasibility", evaluation.feasibility],
    ["Developer Impact", evaluation.impact],
    ["Technical Risk", evaluation.technical_risk],
    ["Budget", evaluation.budget],
  ];

  return (
    <section className="rounded-lg border border-cyan-400/20 bg-cyan-950/20 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="size-5 text-cyan-300" />
          <h2 className="text-lg font-semibold text-white">AI Evaluation</h2>
        </div>
        <Badge variant="outline" className={recommendationTone(evaluation.recommendation)}>
          {evaluation.recommendation}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-cyan-100/80">Generated by GenLayer validator consensus.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-md border border-white/10 bg-black/30 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-300">{label}</span>
              <span className="font-semibold text-white">{value}/10</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-white/10 bg-black/30 p-3">
          <p className="text-sm text-zinc-400">Overall Score</p>
          <p className="mt-1 text-2xl font-semibold text-white">{evaluation.overall_score}/10</p>
        </div>
        <div className="rounded-md border border-white/10 bg-black/30 p-3">
          <p className="text-sm text-zinc-400">Validator Consensus</p>
          <p className="mt-1 text-2xl font-semibold text-white">{evaluation.validator_agreement}</p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-6 text-zinc-300">{evaluation.reasoning}</p>
    </section>
  );
}

function ProposalDetails({
  proposal,
  onVote,
  isVoting,
}: {
  proposal: Proposal;
  onVote: (choice: VoteChoice) => void;
  isVoting: boolean;
}) {
  const yesPercent = votePercent(proposal);
  const noPercent = 100 - yesPercent;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <main className="space-y-6">
        <section className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge variant="outline" className="border-white/15 text-zinc-300">
                {proposal.category}
              </Badge>
              <h1 className="mt-4 text-3xl font-semibold text-white">{proposal.title}</h1>
            </div>
            <Badge variant="outline" className={statusTone(proposal.status)}>
              {proposal.status}
            </Badge>
          </div>
          <p className="mt-5 leading-7 text-zinc-300">{proposal.description}</p>
          <div className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-zinc-500">Proposer</p>
              <p className="font-mono text-zinc-100">{formatAddress(proposal.proposer, 14)}</p>
            </div>
            <div>
              <p className="text-zinc-500">Funding requested</p>
              <p className="text-zinc-100">{proposal.requested_funding} USDC</p>
            </div>
            <div>
              <p className="text-zinc-500">Repository</p>
              <a
                className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
                href={proposal.repository_url}
                target="_blank"
                rel="noreferrer"
              >
                <GitBranch className="size-3" />
                Open repo
              </a>
            </div>
          </div>
        </section>

        <EvaluationPanel evaluation={proposal.ai_evaluation} />
      </main>

      <aside className="rounded-lg border border-white/10 bg-zinc-950/70 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Vote className="size-5 text-emerald-300" />
          Community Vote
        </h2>
        <div className="mt-5 space-y-4">
          <div>
            <div className="flex justify-between text-sm text-zinc-300">
              <span>YES</span>
              <span>{yesPercent}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-800">
              <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${yesPercent}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm text-zinc-300">
              <span>NO</span>
              <span>{noPercent}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-800">
              <div className="h-2 rounded-full bg-rose-400" style={{ width: `${noPercent}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-md border border-white/10 bg-black/30 p-3">
              <p className="text-2xl font-semibold text-white">{proposal.yes_votes}</p>
              <p className="text-xs text-zinc-500">YES votes</p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/30 p-3">
              <p className="text-2xl font-semibold text-white">{proposal.no_votes}</p>
              <p className="text-xs text-zinc-500">NO votes</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="blue" disabled={isVoting || proposal.status !== "ACTIVE"} onClick={() => onVote("YES")}>
              <CheckCircle2 className="size-4" />
              YES
            </Button>
            <Button variant="outline" disabled={isVoting || proposal.status !== "ACTIVE"} onClick={() => onVote("NO")}>
              <XCircle className="size-4" />
              NO
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function DevDAODashboard() {
  const { address } = useWallet();
  const { contractConfigured, proposals, isLoadingProposals, memberCount, createProposal, vote } = useDevDAO();
  const [view, setView] = useState<View>("dashboard");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [demoItems, setDemoItems] = useState<Proposal[]>(demoProposals);
  const [form, setForm] = useState<ProposalInput>(emptyForm);

  const items = contractConfigured ? proposals : demoItems;
  const selectedProposal = useMemo(
    () => items.find((proposal) => proposal.id === selectedId) ?? items[0],
    [items, selectedId],
  );
  const activeCount = items.filter((proposal) => proposal.status === "ACTIVE").length;
  const completedCount = items.length - activeCount;
  const displayedMembers = contractConfigured ? memberCount : 128;

  const openProposal = (proposal: Proposal) => {
    setSelectedId(proposal.id);
    setView("details");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!contractConfigured) {
      const proposal: Proposal = {
        id: demoItems.length + 1,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        requested_funding: Number(form.requested_funding),
        repository_url: form.repository_url.trim(),
        proposer: address ?? "0xDemo000000000000000000000000000000000000",
        created_at: String(demoItems.length + 1),
        status: "ACTIVE",
        yes_votes: 0,
        no_votes: 0,
        ai_evaluation: demoEvaluation,
      };
      setDemoItems((current) => [proposal, ...current]);
      setSelectedId(proposal.id);
      setForm(emptyForm);
      setView("details");
      toast.info("Demo proposal created", {
        description: "Set NEXT_PUBLIC_CONTRACT_ADDRESS to submit through GenLayer.",
      });
      return;
    }

    await createProposal.mutateAsync({
      ...form,
      requested_funding: Number(form.requested_funding),
    });
    setForm(emptyForm);
    setView("dashboard");
  };

  const handleVote = async (choice: VoteChoice) => {
    if (!selectedProposal) return;

    if (!contractConfigured) {
      setDemoItems((current) =>
        current.map((proposal) => {
          if (proposal.id !== selectedProposal.id || proposal.status !== "ACTIVE") return proposal;
          const yes_votes = proposal.yes_votes + (choice === "YES" ? 1 : 0);
          const no_votes = proposal.no_votes + (choice === "NO" ? 1 : 0);
          const status =
            yes_votes + no_votes >= 3 ? (yes_votes > no_votes ? "APPROVED" : "REJECTED") : "ACTIVE";
          return { ...proposal, yes_votes, no_votes, status };
        }),
      );
      toast.info("Demo vote recorded", {
        description: "Set NEXT_PUBLIC_CONTRACT_ADDRESS to vote through GenLayer.",
      });
      return;
    }

    await vote.mutateAsync({ proposalId: selectedProposal.id, choice });
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10">
              <Code2 className="size-5 text-cyan-300" />
            </div>
            <div>
              <p className="text-xl font-semibold text-white">DevDAO</p>
              <p className="text-sm text-zinc-500">AI-assisted developer governance</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["dashboard", "create", "governance"] as View[]).map((item) => (
              <Button
                key={item}
                size="sm"
                variant={view === item ? "blue" : "ghost"}
                onClick={() => setView(item)}
                className="capitalize"
              >
                {item === "dashboard" && <LayoutDashboard className="size-4" />}
                {item === "create" && <Plus className="size-4" />}
                {item === "governance" && <Vote className="size-4" />}
                {item}
              </Button>
            ))}
            <AccountPanel />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {!contractConfigured && (
          <div className="mb-6 rounded-lg border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Demo mode: proposals and treasury are sample data until `NEXT_PUBLIC_CONTRACT_ADDRESS` is configured.
          </div>
        )}

        {view === "dashboard" && (
          <div className="space-y-8">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Treasury balance" value="24 USDC" icon={CircleDollarSign} />
              <StatCard label="Members" value={displayedMembers.toString()} icon={Users} />
              <StatCard label="Active proposals" value={activeCount.toString()} icon={Vote} />
              <StatCard label="Completed proposals" value={completedCount.toString()} icon={ShieldCheck} />
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-white">Recent Proposals</h1>
                  <p className="mt-1 text-sm text-zinc-500">Funding requests evaluated by GenLayer validators.</p>
                </div>
                <Button variant="gradient" onClick={() => setView("create")}>
                  <Plus className="size-4" />
                  Create
                </Button>
              </div>
              {isLoadingProposals && contractConfigured ? (
                <div className="rounded-lg border border-white/10 bg-zinc-950/70 p-8 text-center text-zinc-400">
                  Loading proposals...
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {items.map((proposal) => (
                    <ProposalCard key={proposal.id} proposal={proposal} onOpen={() => openProposal(proposal)} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {view === "create" && (
          <section className="mx-auto max-w-3xl rounded-lg border border-white/10 bg-zinc-950/70 p-5">
            <h1 className="text-2xl font-semibold text-white">Create Proposal</h1>
            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <label className="block text-sm text-zinc-300">
                Proposal title
                <Input
                  className="mt-2"
                  required
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </label>
              <label className="block text-sm text-zinc-300">
                Description
                <textarea
                  className="mt-2 min-h-36 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  required
                  minLength={20}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm text-zinc-300">
                  Category
                  <select
                    className="mt-2 h-9 w-full rounded-md border border-input bg-black px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                  >
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-zinc-300">
                  Funding requested
                  <Input
                    className="mt-2"
                    required
                    min={1}
                    type="number"
                    value={form.requested_funding}
                    onChange={(event) =>
                      setForm({ ...form, requested_funding: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              <label className="block text-sm text-zinc-300">
                GitHub/repository URL
                <Input
                  className="mt-2"
                  required
                  type="url"
                  value={form.repository_url}
                  onChange={(event) => setForm({ ...form, repository_url: event.target.value })}
                />
              </label>
              <Button variant="gradient" type="submit" disabled={createProposal.isPending}>
                <Brain className="size-4" />
                {createProposal.isPending ? "Evaluating..." : "Submit Proposal"}
              </Button>
            </form>
          </section>
        )}

        {view === "details" && selectedProposal && (
          <ProposalDetails proposal={selectedProposal} onVote={handleVote} isVoting={vote.isPending} />
        )}

        {view === "governance" && (
          <section className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold text-white">Governance</h1>
              <p className="mt-1 text-sm text-zinc-500">Active proposal voting status.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} onOpen={() => openProposal(proposal)} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
