"use client";

import { abi, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import {
  estimateWriteFeePreset,
  feePresetToTransactionFees,
  type FeePresetEstimate,
  type FeePresetLevel,
} from "../genlayer/fees";
import { getEthereumProvider } from "../genlayer/client";
import type {
  AssessmentFinding,
  ProjectAssessment,
  ProjectData,
  ProjectMaturity,
  TransactionReceipt,
} from "./types";

function isAssessmentFinding(value: unknown): value is AssessmentFinding {
  if (!value || typeof value !== "object") {
    return false;
  }

  const finding = value as AssessmentFinding;
  return (
    typeof finding.finding === "string" &&
    finding.finding.trim().length > 0 &&
    Array.isArray(finding.evidence) &&
    finding.evidence.length > 0 &&
    finding.evidence.every(
      (citation) =>
        typeof citation?.path === "string" &&
        citation.path.length > 0 &&
        typeof citation.quote === "string" &&
        citation.quote.trim().length > 0,
    )
  );
}

function maturityMatchesScore(score: number, maturity: ProjectMaturity) {
  if (score < 20) return maturity === "insufficient_evidence";
  if (score < 50) return maturity === "early_stage";
  if (score < 75) return maturity === "developing";
  return maturity === "production_ready";
}

export function decodeGenLayerResultValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (character) =>
      character.charCodeAt(0),
    );

    if (bytes.length > 1 && bytes[0] === 0) {
      return (abi as any).calldata.decode(bytes.slice(1));
    }
  } catch {
    // Ignore malformed base64 payloads; we will fall back to ordinary string parsing.
  }

  return null;
}

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
        !strengths.every(isAssessmentFinding) ||
        !Array.isArray(risks) ||
        !risks.every(isAssessmentFinding) ||
        !Array.isArray(recommendations) ||
        !recommendations.every(isAssessmentFinding)
      ) {
        return null;
      }

      const numericScore =
        typeof overallScore === "number"
          ? overallScore
          : typeof overallScore === "bigint"
            ? Number(overallScore)
          : typeof overallScore === "string"
            ? Number(overallScore)
            : NaN;

      if (
        !Number.isInteger(numericScore) ||
        numericScore < 0 ||
        numericScore > 100 ||
        !maturityMatchesScore(numericScore, maturity as ProjectMaturity)
      ) {
        return null;
      }

      return {
        overall_score: numericScore,
        maturity: maturity as ProjectMaturity,
        strengths,
        risks,
        recommendations,
      } satisfies ProjectAssessment;
    };

    const searchMap = (value: Map<unknown, unknown>) => {
      const mapped = Object.fromEntries(value.entries());
      return search(mapped) ?? search(Array.from(value.values()));
    };

    const search = (value: unknown): ProjectAssessment | null => {
      if (typeof value === "string") {
        const trimmed = value.trim();

        if (!trimmed) {
          return null;
        }

        try {
          return search(JSON.parse(trimmed));
        } catch {
          if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            return null;
          }

          try {
            const decodedValue = decodeGenLayerResultValue(trimmed);
            if (decodedValue !== null) {
              return search(decodedValue);
            }
          } catch {
            // Ignore malformed payloads.
          }

          if (typeof value === "string") {
            const maybeWrapped = value as string;
            const payloadMatch = maybeWrapped.match(/\"readable\"\s*:\s*\"(.*)\"/s);
            if (payloadMatch) {
              try {
                const nested = JSON.parse(payloadMatch[1].replace(/\\"/g, '"'));
                return search(nested);
              } catch {
                // Ignore malformed readable payloads.
              }
            }
          }

          return null;
        }
      }

      if (!value || typeof value !== "object") {
        return null;
      }

      if (value instanceof Map) {
        return searchMap(value);
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
      Number.isInteger(assessment.overall_score) &&
      assessment.overall_score >= 0 &&
      assessment.overall_score <= 100 &&
      typeof assessment.maturity === "string" &&
      maturityMatchesScore(
        assessment.overall_score,
        assessment.maturity as ProjectMaturity,
      ) &&
      Array.isArray(assessment.strengths) &&
      assessment.strengths.every(isAssessmentFinding) &&
      Array.isArray(assessment.risks) &&
      assessment.risks.every(isAssessmentFinding) &&
      Array.isArray(assessment.recommendations) &&
      assessment.recommendations.every(isAssessmentFinding)
    );
  }
}

export default CodeSentinel;
