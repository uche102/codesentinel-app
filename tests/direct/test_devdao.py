import json

from tests.direct.conftest import to_hex

CONTRACT_PATH = "contracts/DevDAO.py"


VALID_EVALUATION = {
    "feasibility": 9,
    "impact": 8,
    "technical_risk": 7,
    "budget": 8,
    "overall_score": "8.0",
    "recommendation": "APPROVE",
    "reasoning": "The proposal is feasible and valuable for developers.",
    "validator_agreement": "4/5 validators agree",
}


def mock_valid_ai(direct_vm):
    direct_vm.mock_llm(r".*", json.dumps(VALID_EVALUATION))


def create_sample_proposal(contract):
    return contract.create_proposal(
        "Build a Rust SDK for GenLayer",
        "Create a focused Rust SDK that helps backend developers integrate GenLayer.",
        "SDK",
        500,
        "https://github.com/devdao/genlayer-rust-sdk",
    )


def deploy_contract(direct_vm, direct_deploy, evaluation=None):
    direct_vm.mock_llm(r".*", json.dumps(evaluation or VALID_EVALUATION))
    return direct_deploy(CONTRACT_PATH)


def test_proposal_creation(direct_vm, direct_deploy, direct_alice):
    contract = deploy_contract(direct_vm, direct_deploy)
    direct_vm.sender = direct_alice

    proposal_id = create_sample_proposal(contract)
    proposal = contract.get_proposal(proposal_id)

    assert proposal.title == "Build a Rust SDK for GenLayer"
    assert proposal.category == "SDK"
    assert proposal.requested_funding == 500
    assert proposal.proposer.as_hex == to_hex(direct_alice)
    assert proposal.status == "ACTIVE"
    assert proposal.ai_evaluation.recommendation == "APPROVE"
    assert proposal.ai_evaluation.feasibility == 9


def test_required_proposal_fields_are_validated(direct_vm, direct_deploy, direct_alice):
    contract = deploy_contract(direct_vm, direct_deploy)
    direct_vm.sender = direct_alice

    invalid_inputs = [
        ("", "Long enough description here.", "Docs", 100, "https://github.com/a/b"),
        ("Title", "Too short", "Docs", 100, "https://github.com/a/b"),
        ("Title", "Long enough description here.", "", 100, "https://github.com/a/b"),
        ("Title", "Long enough description here.", "Docs", 0, "https://github.com/a/b"),
        ("Title", "Long enough description here.", "Docs", 100, "ftp://example.com"),
    ]

    for proposal_input in invalid_inputs:
        with direct_vm.expect_revert("Invalid proposal"):
            contract.create_proposal(*proposal_input)


def test_proposal_retrieval(direct_vm, direct_deploy, direct_alice):
    contract = deploy_contract(direct_vm, direct_deploy)
    direct_vm.sender = direct_alice

    proposal_id = create_sample_proposal(contract)

    proposals = contract.get_proposals()
    assert str(proposal_id) in proposals
    assert proposals[str(proposal_id)].title == "Build a Rust SDK for GenLayer"


def test_voting_and_vote_counting(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_contract(direct_vm, direct_deploy)
    direct_vm.sender = direct_alice
    proposal_id = create_sample_proposal(contract)

    contract.vote(proposal_id, "YES")
    direct_vm.sender = direct_bob
    contract.vote(proposal_id, "NO")

    proposal = contract.get_proposal(proposal_id)
    assert proposal.yes_votes == 1
    assert proposal.no_votes == 1
    assert proposal.status == "ACTIVE"


def test_invalid_votes_are_rejected(direct_vm, direct_deploy, direct_alice):
    contract = deploy_contract(direct_vm, direct_deploy)
    direct_vm.sender = direct_alice
    proposal_id = create_sample_proposal(contract)

    with direct_vm.expect_revert("Invalid vote"):
        contract.vote(proposal_id, "MAYBE")


def test_duplicate_vote_is_rejected(direct_vm, direct_deploy, direct_alice):
    contract = deploy_contract(direct_vm, direct_deploy)
    direct_vm.sender = direct_alice
    proposal_id = create_sample_proposal(contract)

    contract.vote(proposal_id, "YES")
    with direct_vm.expect_revert("Already voted"):
        contract.vote(proposal_id, "NO")


def test_final_status_after_quorum(direct_vm, direct_deploy, direct_alice, direct_bob):
    from gltest.direct import create_address

    contract = deploy_contract(direct_vm, direct_deploy)
    direct_vm.sender = direct_alice
    proposal_id = create_sample_proposal(contract)

    contract.vote(proposal_id, "YES")
    direct_vm.sender = direct_bob
    contract.vote(proposal_id, "YES")
    direct_vm.sender = create_address("charlie")
    contract.vote(proposal_id, "NO")

    proposal = contract.get_proposal(proposal_id)
    assert proposal.status == "APPROVED"
    assert proposal.yes_votes == 2
    assert proposal.no_votes == 1


def test_ai_evaluation_result_validation(direct_vm, direct_deploy, direct_alice):
    contract = deploy_contract(direct_vm, direct_deploy)
    direct_vm.sender = direct_alice

    proposal_id = create_sample_proposal(contract)
    proposal = contract.get_proposal(proposal_id)

    assert proposal.ai_evaluation.feasibility == VALID_EVALUATION["feasibility"]
    assert proposal.ai_evaluation.recommendation == VALID_EVALUATION["recommendation"]


def test_invalid_ai_evaluation_data_is_rejected(direct_vm, direct_deploy, direct_alice):
    invalid = dict(VALID_EVALUATION)
    invalid.pop("reasoning")
    contract = deploy_contract(direct_vm, direct_deploy, invalid)
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Invalid AI evaluation"):
        create_sample_proposal(contract)


def test_recommendation_validation(direct_vm, direct_deploy, direct_alice):
    invalid = dict(VALID_EVALUATION)
    invalid["recommendation"] = "MAYBE"
    contract = deploy_contract(direct_vm, direct_deploy, invalid)
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Invalid AI evaluation"):
        create_sample_proposal(contract)


def test_score_boundaries(direct_vm, direct_deploy, direct_alice):
    valid_zero = dict(VALID_EVALUATION, feasibility=0, impact=0, technical_risk=0, budget=0, overall_score="0")
    invalid_high = dict(VALID_EVALUATION, feasibility=11)
    invalid_low = dict(VALID_EVALUATION, overall_score="-0.1")

    contract = deploy_contract(direct_vm, direct_deploy, valid_zero)
    direct_vm.sender = direct_alice
    proposal_id = create_sample_proposal(contract)
    assert contract.get_proposal(proposal_id).ai_evaluation.overall_score == "0"

    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", json.dumps(invalid_high))
    with direct_vm.expect_revert("Invalid AI evaluation"):
        create_sample_proposal(contract)

    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", json.dumps(invalid_low))
    with direct_vm.expect_revert("Invalid AI evaluation"):
        create_sample_proposal(contract)


def test_invalid_ai_response_fails_creation(direct_vm, direct_deploy, direct_alice):
    contract = deploy_contract(
        direct_vm,
        direct_deploy,
        dict(VALID_EVALUATION, recommendation="MAYBE"),
    )
    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Invalid AI evaluation"):
        create_sample_proposal(contract)
