"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import DevDAO from "../contracts/DevDAO";
import type { ProposalInput, VoteChoice } from "../contracts/types";
import { getContractAddress, getStudioUrl } from "../genlayer/client";
import { useWallet } from "../genlayer/wallet";
import { configError, error, success, userRejected } from "../utils/toast";

export function useDevDAOContract(): DevDAO | null {
  const { address } = useWallet();
  const contractAddress = getContractAddress();
  const studioUrl = getStudioUrl();

  return useMemo(() => {
    if (!contractAddress) return null;
    return new DevDAO(contractAddress, address, studioUrl);
  }, [address, contractAddress, studioUrl]);
}

function handleMutationError(err: Error, title: string) {
  const message = err.message || "";
  if (
    err.name === "UserRejectedRequestError" ||
    message.toLowerCase().includes("user rejected") ||
    message.toLowerCase().includes("denied transaction signature")
  ) {
    userRejected("Transaction cancelled");
    return;
  }
  error(title, { description: message || "Please check your wallet and try again." });
}

export function useDevDAO() {
  const contract = useDevDAOContract();
  const { address } = useWallet();
  const queryClient = useQueryClient();

  const proposals = useQuery({
    queryKey: ["devdao", "proposals"],
    queryFn: async () => {
      if (!contract) return [];
      return contract.getProposals();
    },
  });

  const memberCount = useQuery({
    queryKey: ["devdao", "member-count"],
    queryFn: async () => {
      if (!contract) return 0;
      return contract.getMemberCount();
    },
  });

  const createProposal = useMutation({
    mutationFn: async (input: ProposalInput) => {
      if (!contract) {
        configError(
          "Demo mode",
          "Set NEXT_PUBLIC_CONTRACT_ADDRESS to submit proposals to GenLayer.",
        );
        throw new Error("Contract not configured.");
      }
      if (!address) throw new Error("Connect your wallet before submitting a proposal.");
      const feePreset = await contract.estimateCreateProposalFees(input, "standard");
      return contract.createProposal(input, feePreset);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devdao"] });
      success("Proposal submitted", {
        description: "GenLayer validators evaluated and stored the proposal.",
      });
    },
    onError: (err) => handleMutationError(err as Error, "Proposal submission failed"),
  });

  const vote = useMutation({
    mutationFn: async ({ proposalId, choice }: { proposalId: number; choice: VoteChoice }) => {
      if (!contract) {
        configError("Demo mode", "Set NEXT_PUBLIC_CONTRACT_ADDRESS to vote on GenLayer.");
        throw new Error("Contract not configured.");
      }
      if (!address) throw new Error("Connect your wallet before voting.");
      const feePreset = await contract.estimateVoteFees(proposalId, choice, "standard");
      return contract.vote(proposalId, choice, feePreset);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devdao"] });
      success("Vote recorded", { description: "Your DAO vote was written to GenLayer." });
    },
    onError: (err) => handleMutationError(err as Error, "Vote failed"),
  });

  return {
    contractConfigured: Boolean(contract),
    proposals: proposals.data ?? [],
    isLoadingProposals: proposals.isLoading,
    memberCount: memberCount.data ?? 0,
    createProposal,
    vote,
  };
}
