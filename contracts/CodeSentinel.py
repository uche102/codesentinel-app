# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *
import genlayer.gl.vm as glvm


def validate_assessment(result: dict) -> bool:
    if not isinstance(result, dict):
        return False

    required_fields = {
        "overall_score",
        "maturity",
        "strengths",
        "risks",
        "recommendations",
    }

    if not required_fields.issubset(result.keys()):
        return False

    if isinstance(result["overall_score"], bool):
        return False

    if not isinstance(result["overall_score"], int):
        return False

    if not 0 <= result["overall_score"] <= 100:
        return False

    valid_maturity = {
        "insufficient_evidence",
        "early_stage",
        "developing",
        "production_ready",
    }

    if result["maturity"] not in valid_maturity:
        return False

    for field in ("strengths", "risks", "recommendations"):
        if not isinstance(result[field], list):
            return False

        if not all(isinstance(item, str) for item in result[field]):
            return False

    return True


def validate_project_data(project_data: dict) -> bool:
    if not isinstance(project_data, dict):
        return False

    required_fields = {
        "name",
        "has_readme",
        "has_tests",
        "has_ci",
        "file_count",
        "test_file_count",
    }

    if not required_fields.issubset(project_data.keys()):
        return False

    if not isinstance(project_data["name"], str):
        return False

    if not project_data["name"].strip():
        return False

    for field in ("has_readme", "has_tests", "has_ci"):
        if not isinstance(project_data[field], bool):
            return False

    for field in ("file_count", "test_file_count"):
        if isinstance(project_data[field], bool):
            return False

        if not isinstance(project_data[field], int):
            return False

        if project_data[field] < 0:
            return False

    if project_data["test_file_count"] > project_data["file_count"]:
        return False

    return True


class CodeSentinel(gl.Contract):
    def __init__(self):
        pass

    @gl.public.write
    def analyze_project(self, project_data: dict) -> dict:
        """
        Evaluate the technical maturity of a software project.

        The contract receives structured repository evidence rather than
        the entire repository. GenLayer provides the contextual reasoning
        and validator consensus.
        """
        if not validate_project_data(project_data):
            raise glvm.UserError("Invalid project data")

        # Serialize deterministically so validators receive the same input.
        project_json = json.dumps(project_data, sort_keys=True)

        def leader_fn() -> dict:
            prompt = f"""
You are a software engineering technical due-diligence analyst.

Evaluate the following software project based ONLY on the evidence provided.

Project evidence:
{project_json}

Evaluate these dimensions:
1. Security
2. Architecture
3. Testing
4. Documentation
5. Maintainability

Return ONLY valid JSON using exactly this structure:

{{
    "overall_score": 0,
    "maturity": "insufficient_evidence",
    "strengths": [],
    "risks": [],
    "recommendations": []
}}

Rules:
- overall_score must be an integer from 0 to 100.
- maturity must be one of:
  "insufficient_evidence",
  "early_stage",
  "developing",
  "production_ready".
- Do not invent facts that are not present in the evidence.
- If there is insufficient evidence to make a meaningful assessment,
  use "insufficient_evidence".
- strengths, risks, and recommendations must be arrays of strings.
"""

            return gl.nondet.exec_prompt(
                prompt,
                response_format="json",
            )

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, glvm.Return):
                return False

            return validate_assessment(leader_result.calldata)

        return glvm.run_nondet_unsafe.lazy(leader_fn, validator_fn).get()
