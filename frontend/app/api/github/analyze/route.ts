import { NextResponse } from "next/server";

const GH_REPO_PATTERN =
  /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i;
const GIT_SSH_REPO_PATTERN =
  /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i;

function parseGithubRepoUrl(repoUrl: string) {
  const normalized = repoUrl.trim().replace(/\/+$/, "");
  const match =
    normalized.match(GH_REPO_PATTERN) ?? normalized.match(GIT_SSH_REPO_PATTERN);

  if (!match) {
    throw new Error(
      "GitHub repository URL must be in the format https://github.com/owner/repo.",
    );
  }

  const [, owner, repo] = match;
  if (!owner || !repo) {
    throw new Error("Unable to determine the GitHub owner or repository name.");
  }

  return { owner, repo };
}

function isLikelyTestFile(path: string) {
  return (
    /(^|\/)(tests?|__tests__|test)(?:\/|$)/.test(path) ||
    /\.(test|spec)\.[jt]sx?$/.test(path) ||
    /(^|\/)(.*\.(test|spec)\.[jt]sx?)$/.test(path)
  );
}

function isLikelyWorkflow(path: string) {
  return (
    /(^|\/)\.github\/workflows\//.test(path) ||
    /(^|\/)\.circleci\//.test(path) ||
    /(^|\/)azure-pipelines\.ya?ml$/.test(path) ||
    /(^|\/)jenkinsfile$/i.test(path)
  );
}

function isLikelyConfigFile(path: string) {
  return (
    /(^|\/)(package\.json|pyproject\.toml|requirements\.txt|setup\.py|poetry\.lock|Pipfile\.lock|Cargo\.toml|Cargo\.lock|go\.mod|pom\.xml|build\.gradle|Gemfile|composer\.json|mix\.exs|Dockerfile|docker-compose\.ya?ml|\.eslintrc|\.prettierrc|tsconfig\.json|next\.config\.[jt]s|vite\.config\.[jt]s|tailwind\.config\.[jt]s|\.github\/dependabot\.yml|\.github\/CODEOWNERS)$/i.test(
      path,
    ) ||
    /(^|\/)(\.env|\.env\..+|\.nvmrc|\.tool-versions|\.python-version|\.pre-commit-config\.yaml)$/i.test(
      path,
    ) ||
    /(^|\/)(\.github|\.circleci|docs|config)(?:\/|$)/.test(path)
  );
}

function isLikelyLockfile(path: string) {
  return /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Pipfile\.lock|Cargo\.lock|Gemfile\.lock|composer\.lock|go\.sum)$/.test(
    path,
  );
}

function isLikelyDocker(path: string) {
  return /(^|\/)(Dockerfile|docker-compose\.ya?ml)$/.test(path);
}

function isLikelyLintConfig(path: string) {
  return (
    /(^|\/)(\.eslintrc|\.eslintignore|\.prettierrc|ruff\.toml|pyrightconfig\.json|mypy\.ini|eslint\.config\.[jt]s|biome\.json|\.flake8|\.pylintrc)$/.test(
      path,
    ) || /(^|\/)(eslint|ruff|mypy|pyright|prettier|biome)(?:\/|$)/.test(path)
  );
}

function isLikelySecurityPolicy(path: string) {
  return /(^|\/)(SECURITY\.md|security\.md|SECURITY\.yml)$/i.test(path);
}

function isLikelyDependabot(path: string) {
  return /(^|\/)(\.github\/dependabot\.yml|dependabot\.yml)$/i.test(path);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl : "";

    if (!repoUrl.trim()) {
      return NextResponse.json(
        { error: "GitHub URL is required." },
        { status: 400 },
      );
    }

    const { owner, repo } = parseGithubRepoUrl(repoUrl);
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "CodeSentinel-App",
    };

    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers,
        cache: "no-store",
      },
    );

    if (!repoResponse.ok) {
      const raw = await repoResponse.text();
      return NextResponse.json(
        {
          error:
            raw && raw.trim().startsWith("{")
              ? `GitHub API error: ${raw.slice(0, 220)}`
              : `GitHub repository could not be accessed (HTTP ${repoResponse.status}).`,
        },
        { status: repoResponse.status >= 500 ? 502 : 400 },
      );
    }

    const repoData = (await repoResponse.json()) as {
      name?: string;
      full_name?: string;
      default_branch?: string;
      html_url?: string;
      stargazers_count?: number;
      forks_count?: number;
      open_issues_count?: number;
      pushed_at?: string | null;
      license?: { key?: string } | null;
      language?: string | null;
      private?: boolean;
    };

    const defaultBranch = repoData.default_branch || "main";
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      {
        headers,
        cache: "no-store",
      },
    );

    let tree: Array<{ path?: string; type?: string }> = [];
    let treeTruncated = false;

    if (treeResponse.ok) {
      const treePayload = (await treeResponse.json()) as {
        tree?: Array<{ path?: string; type?: string }>;
        truncated?: boolean;
      };
      tree = Array.isArray(treePayload.tree) ? treePayload.tree : [];
      treeTruncated = Boolean(treePayload.truncated);
    }

    const filePaths = tree
      .map((node) => node.path ?? "")
      .filter((path) => path && nodeIsBlob(path, nodeTypeFromTree(tree, path)));

    const hasReadme = filePaths.some((path) => /(^|\/)readme\.md$/i.test(path));
    const testFileCount = filePaths.filter((path) =>
      isLikelyTestFile(path),
    ).length;
    const workflowCount = filePaths.filter((path) =>
      isLikelyWorkflow(path),
    ).length;
    const dependencyFileCount = filePaths.filter((path) =>
      isLikelyConfigFile(path),
    ).length;
    const hasCi = workflowCount > 0;
    const hasSecurityPolicy = filePaths.some((path) =>
      isLikelySecurityPolicy(path),
    );
    const hasDependabot = filePaths.some((path) => isLikelyDependabot(path));
    const hasPackageManifest = filePaths.some((path) =>
      /(^|\/)(package\.json|pyproject\.toml|requirements\.txt|setup\.py|Cargo\.toml|go\.mod|pom\.xml|build\.gradle|Gemfile|composer\.json|mix\.exs)$/.test(
        path,
      ),
    );
    const hasLockfile = filePaths.some((path) => isLikelyLockfile(path));
    const hasDockerfile = filePaths.some((path) => isLikelyDocker(path));
    const hasLintConfig = filePaths.some((path) => isLikelyLintConfig(path));
    const hasLicense = !!repoData.license;
    const fileCount = filePaths.length;
    const sourceFileCount = filePaths.filter(
      (path) =>
        !/\.(md|txt|yaml|yml|json|lock|toml|ini|cfg)$/i.test(path) &&
        !/^\./.test(path.split("/").at(-1) ?? "") &&
        path !== "",
    ).length;
    const configFileCount = filePaths.filter((path) =>
      isLikelyConfigFile(path),
    ).length;

    const projectData = {
      name: repoData.name || repo,
      has_readme: hasReadme,
      has_tests: testFileCount > 0,
      has_ci: hasCi,
      file_count: fileCount,
      test_file_count: testFileCount,
      repo_url: repoData.html_url || `https://github.com/${owner}/${repo}`,
      owner,
      repo,
      default_branch: defaultBranch,
      primary_language: repoData.language || null,
      stars: repoData.stargazers_count || 0,
      forks: repoData.forks_count || 0,
      open_issues: repoData.open_issues_count || 0,
      recent_push_at: repoData.pushed_at || null,
      has_license: hasLicense,
      has_security_policy: hasSecurityPolicy,
      has_dependabot: hasDependabot,
      has_package_manifest: hasPackageManifest,
      has_lockfile: hasLockfile,
      has_dockerfile: hasDockerfile,
      has_lint_config: hasLintConfig,
      source_file_count: sourceFileCount,
      config_file_count: configFileCount,
      workflow_count: workflowCount,
      detected_frameworks: workflowCount > 0 ? ["GitHub Actions"] : [],
    };

    return NextResponse.json({
      projectData,
      summary: {
        owner,
        repo,
        defaultBranch,
        treeTruncated,
        inspectedFiles: fileCount,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The GitHub repository could not be inspected.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function nodeIsBlob(path: string, type?: string) {
  if (!path || path.endsWith("/")) return false;

  if (type && type !== "blob") {
    return false;
  }

  return /\.[A-Za-z0-9]+$/.test(path);
}

function nodeTypeFromTree(
  tree: Array<{ path?: string; type?: string }>,
  path: string,
) {
  const match = tree.find((node) => node.path === path);
  return match?.type;
}
