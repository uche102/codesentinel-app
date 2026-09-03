"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  estimateWriteFeePreset,
  feePresetToTransactionFees,
  type FeePresetEstimate,
  type FeePresetLevel,
} from "../genlayer/fees";
import type { AIEvaluation, Proposal, ProposalInput, TransactionReceipt, VoteChoice } from "./types";

function toObject(value: any): Record<string, any> {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (Array.isArray(value)) return Object.fromEntries(value as [string, any][]);
  if (typeof value === "object") return value as Record<string, any>;
  return {};
}

function toAddress(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.as_hex === "string") return value.as_hex;
  if (typeof value.asHex === "string") return value.asHex;
  return String(value);
}

function normalizeEvaluation(value: any): AIEvaluation {
  const data = toObject(value);
  return {
    feasibility: Number(data.feasibility ?? 0),
    impact: Number(data.impact ?? 0),
    technical_risk: Number(data.technical_risk ?? data.technicalRisk ?? 0),
    budget: Number(data.budget ?? 0),
    overall_score: Number(data.overall_score ?? data.overallScore ?? 0),
    recommendation: data.recommendation === "REJECT" ? "REJECT" : "APPROVE",
    reasoning: String(data.reasoning ?? ""),
    validator_agreement: String(data.validator_agreement ?? data.validatorAgreement ?? ""),
  };
}

function normalizeProposal(value: any): Proposal {
  const data = toObject(value);
  return {
    id: Number(data.id ?? 0),
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    category: String(data.category ?? ""),
    requested_funding: Number(data.requested_funding ?? data.requestedFunding ?? 0),
    repository_url: String(data.repository_url ?? data.repositoryUrl ?? ""),
    proposer: toAddress(data.proposer),
    created_at: String(data.created_at ?? data.createdAt ?? ""),
    status: data.status === "APPROVED" || data.status === "REJECTED" ? data.status : "ACTIVE",
    yes_votes: Number(data.yes_votes ?? data.yesVotes ?? 0),
    no_votes: Number(data.no_votes ?? data.noVotes ?? 0),
    ai_evaluation: normalizeEvaluation(data.ai_evaluation ?? data.aiEvaluation),
  };
}

class DevDAO {
  private contractAddress: `0x${string}`;
  private client: any;

  constructor(contractAddress: string, address?: string | null, studioUrl?: string) {
    this.contractAddress = contractAddress as `0x${string}`;
    const config: any = { chain: studionet };
    if (address) config.account = address as `0x${string}`;
    if (studioUrl) config.endpoint = studioUrl;
    this.client = createClient(config);
  }

  async getProposals(): Promise<Proposal[]> {
    const result: any = await this.client.readContract({
      address: this.contractAddress,
      functionName: "get_proposals",
      args: [],
    });

    if (result instanceof Map) {
      return Array.from(result.values()).map(normalizeProposal).sort((a, b) => b.id - a.id);
    }

    return Object.values(toObject(result)).map(normalizeProposal).sort((a, b) => b.id - a.id);
  }

  async getProposal(id: number): Promise<Proposal> {
    const result = await this.client.readContract({
      address: this.contractAddress,
      functionName: "get_proposal",
      args: [id],
    });
    return normalizeProposal(result);
  }

  async getMemberCount(): Promise<number> {
    const result = await this.client.readContract({
      address: this.contractAddress,
      functionName: "get_member_count",
      args: [],
    });
    return Number(result ?? 0);
  }

  async estimateCreateProposalFees(
    input: ProposalInput,
    level: FeePresetLevel = "standard",
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(
      this.client,
      {
        address: this.contractAddress,
        functionName: "create_proposal",
        args: [
          input.title,
          input.description,
          input.category,
          input.requested_funding,
          input.repository_url,
        ],
        value: 0n,
      },
      level,
    );
  }

  async estimateVoteFees(
    proposalId: number,
    choice: VoteChoice,
    level: FeePresetLevel = "standard",
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(
      this.client,
      {
        address: this.contractAddress,
        functionName: "vote",
        args: [proposalId, choice],
        value: 0n,
      },
      level,
    );
  }

  async createProposal(input: ProposalInput, feePreset?: FeePresetEstimate): Promise<TransactionReceipt> {
    const fees = feePresetToTransactionFees(feePreset);
    const txHash = await this.client.writeContract({
      address: this.contractAddress,
      functionName: "create_proposal",
      args: [
        input.title,
        input.description,
        input.category,
        input.requested_funding,
        input.repository_url,
      ],
      value: 0n,
      ...(fees ? { fees } : {}),
    });

    return this.client.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED" as any,
      retries: 30,
      interval: 5000,
    }) as Promise<TransactionReceipt>;
  }

  async vote(proposalId: number, choice: VoteChoice, feePreset?: FeePresetEstimate): Promise<TransactionReceipt> {
    const fees = feePresetToTransactionFees(feePreset);
    const txHash = await this.client.writeContract({
      address: this.contractAddress,
      functionName: "vote",
      args: [proposalId, choice],
      value: 0n,
      ...(fees ? { fees } : {}),
    });

    return this.client.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED" as any,
      retries: 24,
      interval: 5000,
    }) as Promise<TransactionReceipt>;
  }
}

export default DevDAO;
