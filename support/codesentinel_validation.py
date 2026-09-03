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
