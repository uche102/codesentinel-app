"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  estimateWriteFeePreset,
  feePresetToTransactionFees,
  type FeePresetEstimate,
  type FeePresetLevel,
} from "../genlayer/fees";
import type { ProjectAssessment, ProjectData, TransactionReceipt } from "./types";

class CodeSentinel {
  private contractAddress: `0x${string}`;
  private client: any;
  private studioUrl?: string;

  constructor(contractAddress: string, address?: string | null, studioUrl?: string) {
    this.contractAddress = contractAddress as `0x${string}`;
    this.studioUrl = studioUrl;

    const config: any = { chain: studionet };

    if (address) {
      config.account = address as `0x${string}`;
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
  ): Promise<{ receipt: TransactionReceipt; assessment: ProjectAssessment | null }> {
    const fees = feePresetToTransactionFees(feePreset);
    const txHash = await this.client.writeContract({
      address: this.contractAddress,
      functionName: "analyze_project",
      args: [projectData],
      value: 0n,
      ...(fees ? { fees } : {}),
    });

    const receipt = await this.client.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED" as any,
      retries: 24,
      interval: 5000,
    });

    return {
      receipt: receipt as TransactionReceipt,
      assessment: this.extractAssessment(receipt),
    };
  }

  private extractAssessment(receipt: any): ProjectAssessment | null {
    const result = receipt?.consensus_data?.leader_receipt?.[0]?.result;
    if (this.isProjectAssessment(result)) {
      return result;
    }

    if (this.isProjectAssessment(receipt?.result)) {
      return receipt.result;
    }

    return null;
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
