# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *
import genlayer.gl.vm as glvm


VALID_RECOMMENDATIONS = {"APPROVE", "REJECT"}
VALID_VOTES = {"YES", "NO"}
QUORUM = 3


@allow_storage
@dataclass
class AIEvaluation:
    feasibility: u256
    impact: u256
    technical_risk: u256
    budget: u256
    overall_score: str
    recommendation: str
    reasoning: str
    validator_agreement: str


@allow_storage
@dataclass
class Proposal:
    id: u256
    title: str
    description: str
    category: str
    requested_funding: u256
    repository_url: str
    proposer: Address
    created_at: str
    status: str
    yes_votes: u256
    no_votes: u256
    ai_evaluation: AIEvaluation


def _is_score(value) -> bool:
    if isinstance(value, bool):
        return False
    if not isinstance(value, int):
        return False
    return 0 <= value <= 10


def validate_ai_evaluation(result: dict) -> bool:
    if not isinstance(result, dict):
        return False

    required_fields = {
        "feasibility",
        "impact",
        "technical_risk",
        "budget",
        "overall_score",
        "recommendation",
        "reasoning",
        "validator_agreement",
    }
    if not required_fields.issubset(result.keys()):
        return False

    for field in ("feasibility", "impact", "technical_risk", "budget"):
        if not _is_score(result[field]):
            return False

    if isinstance(result["overall_score"], bool):
        return False
    if isinstance(result["overall_score"], str):
        try:
            overall_score = float(result["overall_score"])
        except Exception:
            return False
    elif isinstance(result["overall_score"], int):
        overall_score = result["overall_score"]
    else:
        return False
    if not 0 <= overall_score <= 10:
        return False

    if result["recommendation"] not in VALID_RECOMMENDATIONS:
        return False

    for field in ("reasoning", "validator_agreement"):
        if not isinstance(result[field], str):
            return False
        if not result[field].strip():
            return False

    return True


def validate_proposal_input(
    title: str,
    description: str,
    category: str,
    requested_funding: int,
    repository_url: str,
) -> bool:
    if not isinstance(title, str) or not title.strip():
        return False
    if not isinstance(description, str) or len(description.strip()) < 20:
        return False
    if not isinstance(category, str) or not category.strip():
        return False
    if isinstance(requested_funding, bool) or not isinstance(requested_funding, int):
        return False
    if requested_funding <= 0:
        return False
    if not isinstance(repository_url, str) or not repository_url.strip():
        return False
    return repository_url.startswith("https://github.com/") or repository_url.startswith(
        "https://gitlab.com/"
    )


class DevDAO(gl.Contract):
    proposals: TreeMap[u256, Proposal]
    votes: TreeMap[str, str]
    members: TreeMap[Address, bool]
    proposal_count: u256

    def __init__(self):
        self.proposal_count = 0

    def _evaluate_proposal(
        self,
        title: str,
        description: str,
        category: str,
        requested_funding: int,
        repository_url: str,
        proposer: Address,
    ) -> AIEvaluation:
        proposal_json = json.dumps(
            {
                "title": title,
                "description": description,
                "category": category,
                "requested_funding": requested_funding,
                "repository_url": repository_url,
                "proposer": proposer.as_hex,
            },
            sort_keys=True,
        )

        def evaluate_with_validators() -> str:
            prompt = f"""
You are a GenLayer AI validator evaluating a Developer DAO funding proposal.

Evaluate ONLY the proposal data below.

Proposal:
{proposal_json}

Assess:
1. Feasibility
2. Developer/ecosystem impact
3. Technical risk
4. Budget justification
5. Overall proposal quality

Return ONLY valid JSON using exactly this structure:

{{
  "feasibility": 0,
  "impact": 0,
  "technical_risk": 0,
  "budget": 0,
  "overall_score": "0.0",
  "recommendation": "REJECT",
  "reasoning": "Concise explanation.",
  "validator_agreement": "4/5 validators agree"
}}

Rules:
- Each dimension score must be an integer from 0 to 10.
- overall_score must be a numeric string from "0" to "10".
- recommendation must be exactly "APPROVE" or "REJECT".
- Do not include markdown, comments, or extra text.
"""
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            if not validate_ai_evaluation(result):
                raise glvm.UserError("Invalid AI evaluation")
            return json.dumps(result, sort_keys=True)

        result = json.loads(gl.eq_principle.strict_eq(evaluate_with_validators))
        if not validate_ai_evaluation(result):
            raise glvm.UserError("Invalid AI evaluation")

        return AIEvaluation(
            feasibility=result["feasibility"],
            impact=result["impact"],
            technical_risk=result["technical_risk"],
            budget=result["budget"],
            overall_score=str(result["overall_score"]),
            recommendation=result["recommendation"],
            reasoning=result["reasoning"],
            validator_agreement=result["validator_agreement"],
        )

    def _refresh_status(self, proposal_id: int) -> None:
        proposal = self.proposals[proposal_id]
        total_votes = proposal.yes_votes + proposal.no_votes
        if total_votes < QUORUM:
            proposal.status = "ACTIVE"
        elif proposal.yes_votes > proposal.no_votes:
            proposal.status = "APPROVED"
        else:
            proposal.status = "REJECTED"

    def _vote_key(self, proposal_id: int, voter: Address) -> str:
        return f"{proposal_id}:{voter.as_hex}"

    @gl.public.write
    def create_proposal(
        self,
        title: str,
        description: str,
        category: str,
        requested_funding: int,
        repository_url: str,
    ) -> u256:
        if not validate_proposal_input(
            title, description, category, requested_funding, repository_url
        ):
            raise glvm.UserError("Invalid proposal")

        proposer = gl.message.sender_address
        proposal_id = self.proposal_count + 1
        self.proposal_count = proposal_id
        self.members[proposer] = True

        evaluation = self._evaluate_proposal(
            title.strip(),
            description.strip(),
            category.strip(),
            requested_funding,
            repository_url.strip(),
            proposer,
        )

        self.proposals[proposal_id] = Proposal(
            id=proposal_id,
            title=title.strip(),
            description=description.strip(),
            category=category.strip(),
            requested_funding=requested_funding,
            repository_url=repository_url.strip(),
            proposer=proposer,
            created_at=str(proposal_id),
            status="ACTIVE",
            yes_votes=0,
            no_votes=0,
            ai_evaluation=evaluation,
        )
        return proposal_id

    @gl.public.write
    def vote(self, proposal_id: int, choice: str) -> None:
        if proposal_id not in self.proposals:
            raise glvm.UserError("Proposal not found")
        if choice not in VALID_VOTES:
            raise glvm.UserError("Invalid vote")

        voter = gl.message.sender_address
        vote_key = self._vote_key(proposal_id, voter)
        if vote_key in self.votes:
            raise glvm.UserError("Already voted")

        proposal = self.proposals[proposal_id]
        self.members[voter] = True
        self.votes[vote_key] = choice
        if choice == "YES":
            proposal.yes_votes += 1
        else:
            proposal.no_votes += 1
        self._refresh_status(proposal_id)

    @gl.public.view
    def get_proposal(self, proposal_id: int) -> Proposal:
        if proposal_id not in self.proposals:
            raise glvm.UserError("Proposal not found")
        return self.proposals[proposal_id]

    @gl.public.view
    def get_proposals(self) -> dict:
        return {str(k): v for k, v in self.proposals.items()}

    @gl.public.view
    def get_vote(self, proposal_id: int, voter: str) -> str:
        address = Address(voter)
        return self.votes.get(self._vote_key(proposal_id, address), "")

    @gl.public.view
    def get_member_count(self) -> int:
        return len(self.members)
