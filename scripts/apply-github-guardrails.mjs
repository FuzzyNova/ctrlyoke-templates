#!/usr/bin/env node
/**
 * Applies this repository's GitHub guardrails through the `gh` CLI, so the
 * settings live in version control instead of only in the Settings UI.
 *
 * Usage:
 *   node scripts/apply-github-guardrails.mjs [--dry-run]
 *
 * Idempotent: rulesets are matched by name and updated in place, and every
 * other call is a PUT/PATCH of the desired state. Run it again after editing
 * the definitions below.
 *
 * GitHub only accepts a required status check that has reported at least once,
 * so run this after the `validate` workflow has completed on `main`.
 */

import { execFileSync } from "node:child_process";
import { ROOT } from "./lib.mjs";

const dryRun = process.argv.includes("--dry-run");

/** Built-in "Repository admin" role; admins may still push to `main` directly. */
const ADMIN_BYPASS = [
  { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" },
];

/** The GitHub Actions app, so only a check reported by Actions satisfies the requirement. */
const GITHUB_ACTIONS_APP_ID = 15368;

/** Job id in .github/workflows/validate.yml. */
const REQUIRED_CHECK = "validate";

/**
 * Squash is the only merge method, in both the repo settings and the `main`
 * ruleset, so each template lands as one commit titled by its pull request.
 */
const MERGE_METHODS = ["squash"];

const REPO_SETTINGS = {
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  squash_merge_commit_title: "PR_TITLE",
  squash_merge_commit_message: "PR_BODY",
  delete_branch_on_merge: true,
  has_projects: false,
  has_wiki: false,
};

const RULESETS = [
  {
    name: "main",
    target: "branch",
    enforcement: "active",
    bypass_actors: ADMIN_BYPASS,
    conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: 1,
          require_code_owner_review: true,
          dismiss_stale_reviews_on_push: true,
          require_last_push_approval: true,
          required_review_thread_resolution: false,
          allowed_merge_methods: MERGE_METHODS,
        },
      },
      {
        type: "required_status_checks",
        parameters: {
          // A stale branch must be revalidated: two templates can each pass
          // alone and still collide in index.json once both are merged.
          strict_required_status_checks_policy: true,
          required_status_checks: [
            { context: REQUIRED_CHECK, integration_id: GITHUB_ACTIONS_APP_ID },
          ],
        },
      },
    ],
  },
];

/** Labels the issue forms in .github/ISSUE_TEMPLATE apply. */
const LABELS = [
  {
    name: "report",
    color: "d93f0b",
    description: "A template reported as broken, misleading or unsafe",
  },
];

function gh(args, body) {
  return execFileSync(
    "gh",
    body === undefined ? args : [...args, "--input", "-"],
    {
      cwd: ROOT,
      input: body === undefined ? undefined : JSON.stringify(body),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

function ghJson(args, body) {
  const out = gh(args, body);
  return out.trim() ? JSON.parse(out) : undefined;
}

const repo = ghJson(["repo", "view", "--json", "nameWithOwner,visibility"]);
const base = `repos/${repo.nameWithOwner}`;
console.log(
  `${repo.nameWithOwner} (${repo.visibility.toLowerCase()})${dryRun ? " -- dry run" : ""}\n`,
);

const steps = [
  {
    label:
      "Repo settings: squash-only merges, delete head branches, no Projects or wiki",
    apply: () => gh(["api", "-X", "PATCH", base], REPO_SETTINGS),
  },
  ...RULESETS.map((ruleset) => ({
    label: `ruleset "${ruleset.name}"`,
    apply() {
      const existing = ghJson(["api", `${base}/rulesets`]).find(
        (r) => r.name === ruleset.name,
      );
      if (existing) {
        gh(["api", "-X", "PUT", `${base}/rulesets/${existing.id}`], ruleset);
      } else {
        gh(["api", "-X", "POST", `${base}/rulesets`], ruleset);
      }
    },
  })),
  ...LABELS.map((label) => ({
    label: `label "${label.name}"`,
    apply: () =>
      gh([
        "label",
        "create",
        label.name,
        "--color",
        label.color,
        "--description",
        label.description,
        "--force",
      ]),
  })),
  {
    label: "Actions: default GITHUB_TOKEN is read-only and cannot approve PRs",
    apply: () =>
      gh(["api", "-X", "PUT", `${base}/actions/permissions/workflow`], {
        default_workflow_permissions: "read",
        can_approve_pull_request_reviews: false,
      }),
  },
  {
    // Pull requests come from strangers and their workflows run the PR's own
    // scripts/, so a maintainer approves every outside contributor's run.
    label:
      "Actions: require approval to run workflows for all outside contributors",
    apply: () =>
      gh(
        [
          "api",
          "-X",
          "PUT",
          `${base}/actions/permissions/fork-pr-contributor-approval`,
        ],
        { approval_policy: "all_external_contributors" },
      ),
  },
  {
    label: "Dependabot alerts",
    apply: () => gh(["api", "-X", "PUT", `${base}/vulnerability-alerts`]),
  },
  {
    // Needs Dependabot alerts, so it runs after that step.
    label: "Dependabot security updates",
    apply: () => gh(["api", "-X", "PUT", `${base}/automated-security-fixes`]),
  },
  {
    label: "Secret scanning + push protection",
    apply: () =>
      gh(["api", "-X", "PATCH", base], {
        security_and_analysis: {
          secret_scanning: { status: "enabled" },
          secret_scanning_push_protection: { status: "enabled" },
        },
      }),
  },
  {
    label: "Private vulnerability reporting",
    apply: () =>
      gh(["api", "-X", "PUT", `${base}/private-vulnerability-reporting`]),
  },
];

let failures = 0;
for (const step of steps) {
  if (dryRun) {
    console.log(`would apply: ${step.label}`);
    continue;
  }
  try {
    step.apply();
    console.log(`ok      ${step.label}`);
  } catch (error) {
    failures++;
    const detail = String(error.stderr || error.message)
      .trim()
      .split("\n")
      .pop();
    console.log(`FAILED  ${step.label}\n        ${detail}`);
  }
}

if (failures > 0) {
  console.log(`\n${failures} step(s) failed.`);
  process.exitCode = 1;
}
