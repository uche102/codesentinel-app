/**
 * TypeScript types for GenLayer contracts used by the frontend.
 */

export interface ProjectData {
  name: string;
  has_readme: boolean;
  has_tests: boolean;
  has_ci: boolean;
  file_count: number;
  test_file_count: number;
  repo_url?: string;
  owner?: string;
  repo?: string;
  default_branch?: string;
  primary_language?: string | null;
  stars?: number;
  forks?: number;
  open_issues?: number;
  recent_push_at?: string | null;
  has_license?: boolean;
  has_security_policy?: boolean;
  has_dependabot?: boolean;
  has_package_manifest?: boolean;
  has_lockfile?: boolean;
  has_dockerfile?: boolean;
  has_lint_config?: boolean;
  source_file_count?: number;
  config_file_count?: number;
  workflow_count?: number;
  detected_frameworks?: string[];
}

export interface GithubRepoAnalysis {
  projectData: ProjectData;
  summary: {
    owner: string;
    repo: string;
    defaultBranch: string;
    treeTruncated: boolean;
    inspectedFiles: number;
  };
}

export type ProjectMaturity =
  | "insufficient_evidence"
  | "early_stage"
  | "developing"
  | "production_ready";

export interface ProjectAssessment {
  overall_score: number;
  maturity: ProjectMaturity;
  strengths: string[];
  risks: string[];
  recommendations: string[];
}

export interface Bet {
  id: string;
  game_date: string;
  team1: string;
  team2: string;
  predicted_winner: string;
  has_resolved: boolean;
  real_winner?: string;
  real_score?: string;
  resolution_url?: string;
  owner: string;
}

export interface LeaderboardEntry {
  address: string;
  points: number;
}

export interface TransactionReceipt {
  status: string;
  hash: string;
  blockNumber?: number;
  [key: string]: any;
}

export interface BetFilters {
  resolved?: boolean;
  owner?: string;
}

export type ProposalStatus = "ACTIVE" | "APPROVED" | "REJECTED";
export type VoteChoice = "YES" | "NO";
export type Recommendation = "APPROVE" | "REJECT";

export interface AIEvaluation {
  feasibility: number;
  impact: number;
  technical_risk: number;
  budget: number;
  overall_score: number;
  recommendation: Recommendation;
  reasoning: string;
  validator_agreement: string;
}

export interface Proposal {
  id: number;
  title: string;
  description: string;
  category: string;
  requested_funding: number;
  repository_url: string;
  proposer: string;
  created_at: string;
  status: ProposalStatus;
  yes_votes: number;
  no_votes: number;
  ai_evaluation: AIEvaluation;
}

export interface ProposalInput {
  title: string;
  description: string;
  category: string;
  requested_funding: number;
  repository_url: string;
}
