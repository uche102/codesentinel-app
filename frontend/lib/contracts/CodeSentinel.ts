"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  estimateWriteFeePreset,
  feePresetToTransactionFees,
  type FeePresetEstimate,
  type FeePresetLevel,
} from "../genlayer/fees";
import { getEthereumProvider } from "../genlayer/client";
import type {
  ProjectAssessment,
  ProjectData,
  ProjectMaturity,
  TransactionReceipt,
} from "./types";

class CodeSentinel {
  private contractAddress: `0x${string}`;
  private client: any;
  private studioUrl?: string;
  private address?: string | null;

  constructor(
    contractAddress: string,
    address?: string | null,
    studioUrl?: string,
  ) {
    this.contractAddress = contractAddress as `0x${string}`;
    this.studioUrl = studioUrl;
    this.address = address;

    const config: any = { chain: studionet };

    if (address) {
      config.account = address as `0x${string}`;
    }

    const provider = getEthereumProvider();
    if (provider) {
      config.provider = provider;
    }

    if (studioUrl) {
      config.endpoint = studioUrl;
    }

    this.client = createClient(config);
  }

  async estimateAnalyzeProjectFees(
    projectData: ProjectData,
    level: FeePresetLevel = "standard",
  ): Promise<FeePresetEstimate | undefined> {
    return estimateWriteFeePreset(
      this.client,
      {
        address: this.contractAddress,
        functionName: "analyze_project",
        args: [projectData],
        value: 0n,
      },
      level,
    );
  }

  async analyzeProject(
    projectData: ProjectData,
    feePreset?: FeePresetEstimate,
  ): Promise<{
    receipt: TransactionReceipt;
    assessment: ProjectAssessment | null;
  }> {
    const txHash = await this.client.writeContract({
      address: this.contractAddress,
      functionName: "analyze_project",
      args: [projectData],
      value: 0n,
    });

    const receipt = await this.client.waitForTransactionReceipt({
      hash: txHash,
      status: "FINALIZED" as any,
      retries: 36,
      interval: 5000,
      fullTransaction: true,
    });
    const transaction = await this.client.getTransaction({ hash: txHash });

    console.error("CodeSentinel transaction payload", {
      transactionKeys: Object.keys(transaction ?? {}),
      receiptKeys: Object.keys(receipt ?? {}),
      consensusData: (transaction as any)?.consensus_data,
      data: (transaction as any)?.data,
    });

    return {
      receipt: receipt as TransactionReceipt,
      assessment: this.extractAssessment(transaction) ?? this.extractAssessment(receipt),
    };
  }

  async getAssessment(): Promise<ProjectAssessment | null> {
    if (!this.address) {
      return null;
    }

    const result = await this.client.readContract({
      address: this.contractAddress,
      functionName: "get_assessment",
      args: [this.address],
    });

    return this.isProjectAssessment(result) ? result : null;
  }

  private extractAssessment(receipt: any): ProjectAssessment | null {
    const visited = new Set<object>();

    const coerceAssessment = (value: Record<string, unknown>) => {
      const overallScore = value.overall_score ?? value.overallScore;
      const maturity = value.maturity;
      const strengths = value.strengths;
      const risks = value.risks;
      const recommendations = value.recommendations;
      const validMaturities: ProjectMaturity[] = [
        "insufficient_evidence",
        "early_stage",
        "developing",
        "production_ready",
      ];

      if (
        overallScore === undefined ||
        typeof maturity !== "string" ||
        !validMaturities.includes(maturity as ProjectMaturity) ||
        !Array.isArray(strengths) ||
        !Array.isArray(risks) ||
        !Array.isArray(recommendations)
      ) {
        return null;
      }

      const numericScore =
        typeof overallScore === "number"
          ? overallScore
          : typeof overallScore === "string"
            ? Number(overallScore)
            : NaN;

      if (!Number.isFinite(numericScore)) {
        return null;
      }

      return {
        overall_score: numericScore,
        maturity: maturity as ProjectMaturity,
        strengths: strengths.filter((item): item is string => typeof item === "string"),
        risks: risks.filter((item): item is string => typeof item === "string"),
        recommendations: recommendations.filter(
          (item): item is string => typeof item === "string",
        ),
      } satisfies ProjectAssessment;
    };

    const search = (value: unknown): ProjectAssessment | null => {
      if (typeof value === "string") {
        try {
          return search(JSON.parse(value));
        } catch {
          return null;
        }
      }

      if (!value || typeof value !== "object") {
        return null;
      }

      const assessment = coerceAssessment(value as Record<string, unknown>);
      if (assessment) {
        return assessment;
      }

      if (visited.has(value)) {
        return null;
      }
      visited.add(value);

      for (const child of Object.values(value)) {
        const assessment = search(child);
        if (assessment) {
          return assessment;
        }
      }

      return null;
    };

    return search(receipt);
  }

  private isProjectAssessment(value: unknown): value is ProjectAssessment {
    if (!value || typeof value !== "object") {
      return false;
    }

    const assessment = value as ProjectAssessment;
    return (
      typeof assessment.overall_score === "number" &&
      typeof assessment.maturity === "string" &&
      Array.isArray(assessment.strengths) &&
      Array.isArray(assessment.risks) &&
      Array.isArray(assessment.recommendations)
    );
  }
}

export default CodeSentinel;
