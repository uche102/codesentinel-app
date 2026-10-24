import json

import pytest

from support.codesentinel_validation import validate_assessment, validate_project_data

CONTRACT_PATH = "contracts/CodeSentinel.py"

PROJECT_DATA = {
    "name": "Example Project",
    "has_readme": True,
    "has_tests": True,
    "has_ci": True,
    "file_count": 50,
    "test_file_count": 10,
    "repository_files": [
        {
            "path": "README.md",
            "content": "# Example Project\nRun tests with pytest.",
        },
        {
            "path": "tests/test_app.py",
            "content": "def test_app():\n    assert True",
        },
    ],
}

VALID_ASSESSMENT = {
    "overall_score": 85,
    "maturity": "production_ready",
    "strengths": [
        {
            "finding": "The repository includes an automated test.",
            "evidence": [
                {"path": "tests/test_app.py", "quote": "def test_app():"}
            ],
        }
    ],
    "risks": [],
    "recommendations": [],
}

VALID_REVIEW = {
    "approved": True,
    "overall_score": 82,
    "maturity": "production_ready",
    "unsupported_findings": [],
}


def mock_assessment_and_review(direct_vm):
    direct_vm.mock_llm(
        r".*independent repository assessment validator.*",
        json.dumps(VALID_REVIEW),
    )
    direct_vm.mock_llm(
        r".*software engineering technical due-diligence analyst.*",
        json.dumps(VALID_ASSESSMENT),
    )


def test_analyze_project_returns_independently_reviewed_assessment(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    mock_assessment_and_review(direct_vm)
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice

    result = contract.analyze_project(PROJECT_DATA)

    assert result == VALID_ASSESSMENT
    assert contract.get_assessment(direct_alice.as_hex) == result


def test_assessment_requires_score_maturity_consistency():
    mismatched = {
        **VALID_ASSESSMENT,
        "maturity": "early_stage",
    }

    assert validate_assessment(mismatched, PROJECT_DATA) is False


@pytest.mark.parametrize(
    "score,maturity",
    [
        (0, "insufficient_evidence"),
        (19, "insufficient_evidence"),
        (20, "early_stage"),
        (49, "early_stage"),
        (50, "developing"),
        (74, "developing"),
        (75, "production_ready"),
        (100, "production_ready"),
    ],
)
def test_score_maturity_bands(score, maturity):
    assessment = {
        **VALID_ASSESSMENT,
        "overall_score": score,
        "maturity": maturity,
    }

    assert validate_assessment(assessment, PROJECT_DATA) is True


@pytest.mark.parametrize(
    "finding",
    [
        {
            "finding": "The claim cites a path absent from repository evidence.",
            "evidence": [{"path": "src/missing.py", "quote": "not present"}],
        },
        {
            "finding": "The quote does not occur in the cited file.",
            "evidence": [{"path": "README.md", "quote": "invented content"}],
        },
        {"finding": "The finding has no evidence.", "evidence": []},
        "Unstructured finding",
    ],
)
def test_finding_without_verifiable_citation_is_rejected(finding):
    assessment = {**VALID_ASSESSMENT, "risks": [finding]}

    assert validate_assessment(assessment, PROJECT_DATA) is False


def test_valid_finding_must_quote_exact_repository_content():
    assert validate_assessment(VALID_ASSESSMENT, PROJECT_DATA) is True


def test_invalid_project_data_is_rejected():
    assert validate_project_data(None) is False
    assert validate_project_data({**PROJECT_DATA, "repository_files": []}) is False
    assert validate_project_data(
        {
            **PROJECT_DATA,
            "repository_files": [
                {"path": "README.md", "content": "evidence"},
                {"path": "README.md", "content": "duplicate path"},
            ],
        }
    ) is False
    assert validate_project_data(
        {
            **PROJECT_DATA,
            "repository_files": [{"path": "README.md", "content": "x" * 4001}],
        }
    ) is False


def test_invalid_input_is_rejected_by_contract(direct_deploy):
    contract = direct_deploy(CONTRACT_PATH)
    import genlayer.gl.vm as glvm

    invalid_project_data = {**PROJECT_DATA, "test_file_count": 100}

    with pytest.raises(glvm.UserError, match="Invalid project data"):
        contract.analyze_project(invalid_project_data)
