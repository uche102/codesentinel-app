MAX_EVIDENCE_FILES = 12
MAX_EVIDENCE_FILE_CHARS = 4000
MAX_EVIDENCE_TOTAL_CHARS = 24000
MAX_FINDINGS = 8
MAX_CITATIONS_PER_FINDING = 3


def maturity_for_score(score: int) -> str:
    if score < 20:
        return "insufficient_evidence"
    if score < 50:
        return "early_stage"
    if score < 75:
        return "developing"
    return "production_ready"


def validate_assessment(result: dict, project_data: dict) -> bool:
    if not isinstance(result, dict) or not validate_project_data(project_data):
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

    score = result["overall_score"]
    if isinstance(score, bool) or not isinstance(score, int) or not 0 <= score <= 100:
        return False
    if result["maturity"] != maturity_for_score(score):
        return False

    evidence_by_path = {
        item["path"]: item["content"] for item in project_data["repository_files"]
    }
    for field in ("strengths", "risks", "recommendations"):
        findings = result[field]
        if not isinstance(findings, list) or len(findings) > MAX_FINDINGS:
            return False

        for finding in findings:
            if not isinstance(finding, dict):
                return False
            if (
                not isinstance(finding.get("finding"), str)
                or not finding["finding"].strip()
                or len(finding["finding"]) > 500
            ):
                return False

            citations = finding.get("evidence")
            if (
                not isinstance(citations, list)
                or not citations
                or len(citations) > MAX_CITATIONS_PER_FINDING
            ):
                return False

            for citation in citations:
                if not isinstance(citation, dict):
                    return False
                path = citation.get("path")
                quote = citation.get("quote")
                if (
                    not isinstance(path, str)
                    or path not in evidence_by_path
                    or not isinstance(quote, str)
                    or not quote.strip()
                    or len(quote) > 500
                    or quote not in evidence_by_path[path]
                ):
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
        "repository_files",
    }
    if not required_fields.issubset(project_data.keys()):
        return False

    if (
        not isinstance(project_data["name"], str)
        or not project_data["name"].strip()
        or len(project_data["name"]) > 200
    ):
        return False

    for field in ("has_readme", "has_tests", "has_ci"):
        if not isinstance(project_data[field], bool):
            return False

    for field in ("file_count", "test_file_count"):
        value = project_data[field]
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            return False

    if project_data["test_file_count"] > project_data["file_count"]:
        return False

    files = project_data["repository_files"]
    if not isinstance(files, list) or not 1 <= len(files) <= MAX_EVIDENCE_FILES:
        return False

    paths = set()
    total_chars = 0
    for item in files:
        if not isinstance(item, dict):
            return False
        path = item.get("path")
        content = item.get("content")
        if (
            not isinstance(path, str)
            or not path.strip()
            or len(path) > 300
            or path in paths
            or not isinstance(content, str)
            or not content.strip()
            or len(content) > MAX_EVIDENCE_FILE_CHARS
        ):
            return False
        paths.add(path)
        total_chars += len(content)

    return total_chars <= MAX_EVIDENCE_TOTAL_CHARS
