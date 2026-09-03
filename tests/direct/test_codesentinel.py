import json

import pytest

from support.codesentinel_validation import validate_assessment, validate_project_data

CONTRACT_PATH = "contracts/CodeSentinel.py"


def test_analyze_project_returns_valid_assessment(
    direct_vm,
    direct_deploy,
):
    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {
                "overall_score": 85,
                "maturity": "production_ready",
                "strengths": [
                    "Clear project structure",
                    "Automated tests are present",
                ],
                "risks": [
                    "Documentation could be expanded",
                ],
                "recommendations": [
                    "Improve deployment documentation",
                ],
            }
        ),
    )

    contract = direct_deploy(CONTRACT_PATH)

    project_data = {
        "name": "Example Project",
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": 50,
        "test_file_count": 10,
    }

    result = contract.analyze_project(project_data)

    assert result["overall_score"] == 85
    assert result["maturity"] == "production_ready"
    assert isinstance(result["strengths"], list)
    assert isinstance(result["risks"], list)
    assert isinstance(result["recommendations"], list)


def test_invalid_score_is_rejected():
    invalid_result = {
        "overall_score": 150,
        "maturity": "production_ready",
        "strengths": [],
        "risks": [],
        "recommendations": [],
    }

    assert validate_assessment(invalid_result) is False


def test_missing_required_field_is_rejected():
    assessment = {
        "overall_score": 80,
        "maturity": "developing",
        "strengths": [],
        "risks": [],
        # recommendations is missing
    }

    assert validate_assessment(assessment) is False


def test_invalid_maturity_is_rejected():
    assessment = {
        "overall_score": 80,
        "maturity": "excellent",
        "strengths": [],
        "risks": [],
        "recommendations": [],
    }

    assert validate_assessment(assessment) is False


def test_score_as_string_is_rejected():
    assessment = {
        "overall_score": "80",
        "maturity": "developing",
        "strengths": [],
        "risks": [],
        "recommendations": [],
    }

    assert validate_assessment(assessment) is False


def test_non_string_strength_is_rejected():
    assessment = {
        "overall_score": 80,
        "maturity": "developing",
        "strengths": ["Good architecture", 123],
        "risks": [],
        "recommendations": [],
    }

    assert validate_assessment(assessment) is False


def test_non_string_risk_is_rejected():
    assessment = {
        "overall_score": 80,
        "maturity": "developing",
        "strengths": [],
        "risks": ["Security issue", {"problem": "SQL injection"}],
        "recommendations": [],
    }

    assert validate_assessment(assessment) is False


def test_non_string_recommendation_is_rejected():
    assessment = {
        "overall_score": 80,
        "maturity": "developing",
        "strengths": [],
        "risks": [],
        "recommendations": ["Add CI", 42],
    }

    assert validate_assessment(assessment) is False


def test_non_dict_result_is_rejected():
    assert validate_assessment(None) is False
    assert validate_assessment("invalid") is False
    assert validate_assessment([]) is False


def test_boundary_score_zero_is_valid():
    assessment = {
        "overall_score": 0,
        "maturity": "insufficient_evidence",
        "strengths": [],
        "risks": [],
        "recommendations": [],
    }

    assert validate_assessment(assessment) is True


def test_boundary_score_hundred_is_valid():
    assessment = {
        "overall_score": 100,
        "maturity": "production_ready",
        "strengths": ["Strong architecture"],
        "risks": [],
        "recommendations": [],
    }

    assert validate_assessment(assessment) is True


def test_negative_score_is_rejected():
    invalid_result = {
        "overall_score": -1,
        "maturity": "early_stage",
        "strengths": [],
        "risks": [],
        "recommendations": [],
    }

    assert validate_assessment(invalid_result) is False


def test_boolean_score_is_rejected():
    invalid_result = {
        "overall_score": True,
        "maturity": "production_ready",
        "strengths": [],
        "risks": [],
        "recommendations": [],
    }

    assert validate_assessment(invalid_result) is False


def test_llm_returns_invalid_score_is_handled(direct_vm, direct_deploy):
    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {
                "overall_score": 150,
                "maturity": "production_ready",
                "strengths": [],
                "risks": [],
                "recommendations": [],
            }
        ),
    )

    contract = direct_deploy(CONTRACT_PATH)

    result = contract.analyze_project(
        {
            "name": "Example Project",
            "has_readme": True,
            "has_tests": True,
            "has_ci": True,
            "file_count": 50,
            "test_file_count": 10,
        }
    )

    assert isinstance(result, dict)


def test_llm_returns_missing_field_is_rejected(direct_vm, direct_deploy):
    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {
                "overall_score": 85,
                "maturity": "production_ready",
                "strengths": [],
                "risks": [],
                # recommendations intentionally missing
            }
        ),
    )

    contract = direct_deploy(CONTRACT_PATH)

    project_data = {
        "name": "Example Project",
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": 50,
        "test_file_count": 10,
    }

    result = contract.analyze_project(project_data)

    assert isinstance(result, dict)
    assert validate_assessment(result) is False


def test_llm_returns_invalid_maturity_is_rejected(direct_vm, direct_deploy):
    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {
                "overall_score": 85,
                "maturity": "excellent",
                "strengths": [],
                "risks": [],
                "recommendations": [],
            }
        ),
    )

    contract = direct_deploy(CONTRACT_PATH)

    project_data = {
        "name": "Example Project",
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": 50,
        "test_file_count": 10,
    }

    result = contract.analyze_project(project_data)

    assert isinstance(result, dict)
    assert validate_assessment(result) is False


def test_llm_returns_non_string_array_item_is_rejected(
    direct_vm,
    direct_deploy,
):
    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {
                "overall_score": 85,
                "maturity": "production_ready",
                "strengths": ["Good architecture", 123],
                "risks": [],
                "recommendations": [],
            }
        ),
    )

    contract = direct_deploy(CONTRACT_PATH)

    project_data = {
        "name": "Example Project",
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": 50,
        "test_file_count": 10,
    }

    result = contract.analyze_project(project_data)

    assert isinstance(result, dict)
    assert validate_assessment(result) is False


def test_valid_project_data_is_accepted():
    project_data = {
        "name": "Example Project",
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": 50,
        "test_file_count": 10,
    }

    assert validate_project_data(project_data) is True


def test_missing_project_field_is_rejected():
    project_data = {
        "name": "Example Project",
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": 50,
    }

    assert validate_project_data(project_data) is False


def test_project_data_must_be_dict():
    assert validate_project_data([]) is False
    assert validate_project_data("project") is False
    assert validate_project_data(None) is False


def test_project_name_must_be_string():
    project_data = {
        "name": 123,
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": 50,
        "test_file_count": 10,
    }

    assert validate_project_data(project_data) is False


def test_empty_project_name_is_rejected():
    project_data = {
        "name": "   ",
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": 50,
        "test_file_count": 10,
    }

    assert validate_project_data(project_data) is False


def test_negative_file_count_is_rejected():
    project_data = {
        "name": "Example Project",
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": -1,
        "test_file_count": 0,
    }

    assert validate_project_data(project_data) is False


def test_negative_test_file_count_is_rejected():
    project_data = {
        "name": "Example Project",
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": 10,
        "test_file_count": -1,
    }

    assert validate_project_data(project_data) is False


def test_boolean_file_count_is_rejected():
    project_data = {
        "name": "Example Project",
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": True,
        "test_file_count": 1,
    }

    assert validate_project_data(project_data) is False


def test_boolean_test_file_count_is_rejected():
    project_data = {
        "name": "Example Project",
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": 10,
        "test_file_count": False,
    }

    assert validate_project_data(project_data) is False


def test_test_file_count_cannot_exceed_file_count():
    project_data = {
        "name": "Example Project",
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": 5,
        "test_file_count": 10,
    }

    assert validate_project_data(project_data) is False


def test_boolean_project_flags_are_rejected():
    for field in ("has_readme", "has_tests", "has_ci"):
        project_data = {
            "name": "Example Project",
            "has_readme": True,
            "has_tests": True,
            "has_ci": True,
            "file_count": 10,
            "test_file_count": 5,
        }

        project_data[field] = "true"

        assert validate_project_data(project_data) is False


def test_invalid_project_data_is_rejected(
    direct_vm,
    direct_deploy,
):
    contract = direct_deploy(CONTRACT_PATH)
    import genlayer.gl.vm as glvm

    invalid_project_data = {
        "name": "Example Project",
        "has_readme": True,
        "has_tests": True,
        "has_ci": True,
        "file_count": 5,
        "test_file_count": 10,
    }

    with pytest.raises(glvm.UserError, match="Invalid project data"):
        contract.analyze_project(invalid_project_data)


@pytest.mark.parametrize(
    "maturity",
    [
        "insufficient_evidence",
        "early_stage",
        "developing",
        "production_ready",
    ],
)
def test_all_valid_maturity_values_are_accepted(maturity):
    assessment = {
        "overall_score": 80,
        "maturity": maturity,
        "strengths": [],
        "risks": [],
        "recommendations": [],
    }

    assert validate_assessment(assessment) is True


@pytest.mark.parametrize(
    "field",
    ["strengths", "risks", "recommendations"],
)
def test_assessment_array_field_must_be_a_list(field):
    assessment = {
        "overall_score": 80,
        "maturity": "developing",
        "strengths": [],
        "risks": [],
        "recommendations": [],
    }

    assessment[field] = "not a list"

    assert validate_assessment(assessment) is False
