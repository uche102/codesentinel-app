"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import CodeSentinel from "../contracts/CodeSentinel";
import type { ProjectAssessment, ProjectData, TransactionReceipt } from "../contracts/types";
import { getContractAddress, getStudioUrl } from "../genlayer/client";
import type { FeePresetLevel } from "../genlayer/fees";
import { useWallet } from "../genlayer/wallet";
import { configError, error, success, userRejected } from "../utils/toast";

export function useCodeSentinelContract(): CodeSentinel | null {
  const { address } = useWallet();
  const contractAddress = getContractAddress();
  const studioUrl = getStudioUrl();

  return useMemo(() => {
    if (!contractAddress) {
      configError(
        "Setup Required",
        "Set NEXT_PUBLIC_CONTRACT_ADDRESS to your deployed CodeSentinel contract address.",
      );
      return null;
    }

    return new CodeSentinel(contractAddress, address, studioUrl);
  }, [contractAddress, address, studioUrl]);
}

export function useAnalyzeProject() {
  const contract = useCodeSentinelContract();
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const mutation = useMutation<
    { receipt: TransactionReceipt; assessment: ProjectAssessment | null },
    Error,
    { projectData: ProjectData; feePresetLevel?: FeePresetLevel }
  >({
    mutationFn: async ({ projectData, feePresetLevel }) => {
      if (!contract) {
        throw new Error("Contract not configured. Set NEXT_PUBLIC_CONTRACT_ADDRESS first.");
      }

      if (!address) {
        throw new Error("Wallet not connected. Connect your wallet to run an assessment.");
      }

      setIsAnalyzing(true);
      const feePreset = await contract.estimateAnalyzeProjectFees(
        projectData,
        feePresetLevel ?? "standard",
      );

      return contract.analyzeProject(projectData, feePreset);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["codesentinel-assessments"] });
      setIsAnalyzing(false);
      success("Assessment completed", {
        description: "CodeSentinel returned a validator-approved project review.",
      });
    },
    onError: (err) => {
      setIsAnalyzing(false);
      const message = err.message || "";

      if (
        err.name === "UserRejectedRequestError" ||
        message.toLowerCase().includes("user rejected") ||
        message.toLowerCase().includes("denied transaction signature")
      ) {
        userRejected("Transaction cancelled");
        return;
      }

      error("Assessment failed", {
        description: message || "Please check your wallet and try again.",
      });
    },
  });

  return {
    ...mutation,
    analyzeProject: mutation.mutate,
    analyzeProjectAsync: mutation.mutateAsync,
    isAnalyzing,
  };
}
