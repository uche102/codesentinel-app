"""Integration tests for the CodeSentinel GenLayer contract."""

import pytest

from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded


@pytest.mark.integration
def test_codesentinel_analyze_project():
    factory = get_contract_factory("CodeSentinel")
    contract = factory.deploy()

    project_data = {
        "name": "Example Project",
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": 50,
        "test_file_count": 10,
    }

    result = contract.analyze_project(
        args=[project_data],
        wait_interval=10000,
        wait_retries=15,
    )

    assert tx_execution_succeeded(result)

    assessment = result["consensus_data"]["leader_receipt"][0]["result"]

    assert isinstance(assessment, dict)

    assert "overall_score" in assessment
    assert "maturity" in assessment
    assert "strengths" in assessment
    assert "risks" in assessment
    assert "recommendations" in assessment

    assert isinstance(assessment["overall_score"], int)
    assert not isinstance(assessment["overall_score"], bool)
    assert 0 <= assessment["overall_score"] <= 100

    assert assessment["maturity"] in {
        "insufficient_evidence",
        "early_stage",
        "developing",
        "production_ready",
    }

    for field in ("strengths", "risks", "recommendations"):
        assert isinstance(assessment[field], list)
        assert all(isinstance(item, str) for item in assessment[field])