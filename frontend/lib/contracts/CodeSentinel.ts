"use client";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  estimateWriteFeePreset,
  feePresetToTransactionFees,
  type FeePresetEstimate,
  type FeePresetLevel,
} from "../genlayer/fees";
import type {
  ProjectAssessment,
  ProjectData,
  TransactionReceipt,
} from "./types";

class CodeSentinel {
  private contractAddress: `0x${string}`;
  private client: any;
  private studioUrl?: string;

  constructor(
    contractAddress: string,
    address?: string | null,
    studioUrl?: string,
  ) {
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
  ): Promise<{
    receipt: TransactionReceipt;
    assessment: ProjectAssessment | null;
  }> {
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

    // Debug: print the raw receipt to help diagnose missing assessment payloads
    // Remove or guard this in production.
    try {
      // eslint-disable-next-line no-console
      console.debug("CodeSentinel tx receipt:", receipt);
    } catch {}

    return {
      receipt: receipt as TransactionReceipt,
      assessment: this.extractAssessment(receipt),
    };
  }

  private extractAssessment(receipt: any): ProjectAssessment | null {
    const leaderResult = receipt?.consensus_data?.leader_receipt?.[0]?.result;

    // Helper to normalize candidate values: if the value is a JSON string,
    // parse it; if it's an object, return as-is.
    const repairAndParse = (s: string) => {
      // Quick repair heuristics for malformed JSON returned by validators:
      // - Replace consecutive quotes between fields with "," ("" -> ",")
      // - Remove trailing commas before closing brackets/braces
      // - Remove stray commas before array/object closers
      let out = s;
      out = out.replace(/""/g, '\",\"');
      out = out.replace(/,\s*\]/g, "]");
      out = out.replace(/,\s*\}/g, "}");

      try {
        return JSON.parse(out);
      } catch {
        // If repair fails, return original string to avoid throwing
        return s;
      }
    };

    const normalize = (v: any): any => {
      if (v == null) return v;

      // If v is a bare string, try to parse or repair+parse
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return repairAndParse(v);
        }
      }

      // If object contains a readable or calldata string, prefer parsing that
      if (typeof v === "object" && v !== null) {
        if (typeof v.readable === "string") {
          try {
            return JSON.parse(v.readable);
          } catch {
            return repairAndParse(v.readable);
          }
        }

        if (typeof v.calldata === "string") {
          try {
            return JSON.parse(v.calldata);
          } catch {
            return repairAndParse(v.calldata);
          }
        }

        if (typeof v.calldata === "object" && v.calldata !== null) {
          // prefer the object payload
          return v.calldata;
        }
      }

      return v;
    };

    const candidates: any[] = [];

    // Receipt-level candidates
    candidates.push(receipt?.result, receipt?.result?.calldata, receipt?.result?.payload, receipt?.result?.payload?.readable);

    // Leader-level candidates (check all leader receipts)
    const leaderReceipts = receipt?.consensus_data?.leader_receipt || [];
    for (const lr of leaderReceipts) {
      candidates.push(lr?.result, lr?.result?.payload, lr?.result?.payload?.readable);
      // eq_outputs may contain the return payload under a numeric key
      const eq = lr?.eq_outputs;
      if (eq && typeof eq === 'object') {
        for (const k of Object.keys(eq)) {
          candidates.push(eq[k]?.payload, eq[k]?.payload?.readable);
        }
      }
      candidates.push(lr?.calldata, lr?.calldata?.readable, lr?.payload, lr?.payload?.readable);
    }

    // Normalize and find the first valid assessment
    for (const c of candidates) {
      const payload = normalize(c);
      if (this.isProjectAssessment(payload)) {
        try {
          // eslint-disable-next-line no-console
          console.debug("CodeSentinel parsed assessment:", payload);
        } catch {}
        return payload;
      }
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
