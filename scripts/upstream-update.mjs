#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";

const OFFICIAL_URL = "https://github.com/cabinetai/cabinet.git";
const mode = process.argv[2] ?? "check";

if (!new Set(["check", "prepare"]).has(mode)) {
  console.error("Usage: node scripts/upstream-update.mjs <check|prepare>");
  process.exit(1);
}

function git(args, options = {}) {
  const output = execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
  return typeof output === "string" ? output.trim() : "";
}

function succeeds(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "ignore",
  });
  return result.status === 0;
}

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

const remotes = git(["remote"]).split("\n").filter(Boolean);
if (!remotes.includes("origin")) {
  console.error("This checkout has no 'origin' remote for Scott's repository.");
  process.exit(1);
}

if (!remotes.includes("upstream")) {
  git(["remote", "add", "upstream", OFFICIAL_URL]);
  git(["remote", "set-url", "--push", "upstream", "DISABLED"]);
  console.log("Connected the official Cabinet repository as fetch-only 'upstream'.");
} else {
  const upstreamUrl = git(["remote", "get-url", "upstream"]);
  if (upstreamUrl !== OFFICIAL_URL) {
    console.error(`The 'upstream' remote points to ${upstreamUrl}, not ${OFFICIAL_URL}.`);
    process.exit(1);
  }
}

git(["fetch", "--quiet", "--no-tags", "upstream", "main"]);
const officialCommit = git(["rev-parse", "upstream/main"]);
const shortCommit = officialCommit.slice(0, 8);

if (mode === "check") {
  const currentCommit = git(["rev-parse", "HEAD"]);
  if (succeeds(["merge-base", "--is-ancestor", officialCommit, currentCommit])) {
    console.log(`This branch already contains official Cabinet ${shortCommit}.`);
    process.exit(0);
  }

  const missingCount = git(["rev-list", "--count", `${currentCommit}..${officialCommit}`]);
  console.log(
    `${missingCount} official Cabinet commit${missingCount === "1" ? " is" : "s are"} available for review.`
  );
  console.log(`Official commit: ${officialCommit}`);
  console.log("Nothing was merged, committed, pushed, or deployed.");
  process.exit(0);
}

const dirty = git(["status", "--porcelain"]);
if (dirty) {
  console.error("The working tree has changes. Commit or safely set them aside before preparing an update.");
  process.exit(1);
}

git(["fetch", "--quiet", "origin", "main"]);
const customMain = git(["rev-parse", "origin/main"]);
if (succeeds(["merge-base", "--is-ancestor", officialCommit, customMain])) {
  console.log(`Scott's main branch already contains official Cabinet ${shortCommit}.`);
  process.exit(0);
}

const reviewBranch = `agent/upstream-${shortCommit}`;
if (
  succeeds(["show-ref", "--verify", `refs/heads/${reviewBranch}`]) ||
  succeeds(["ls-remote", "--exit-code", "--heads", "origin", reviewBranch])
) {
  console.error(`Review branch '${reviewBranch}' already exists. Reuse or remove it deliberately.`);
  process.exit(1);
}

git(["switch", "--create", reviewBranch, "origin/main"], { stdio: "inherit" });
const merge = spawnSync(
  "git",
  ["merge", "--no-ff", "--no-commit", "upstream/main"],
  { cwd: repoRoot, encoding: "utf8", stdio: "inherit" }
);

if (merge.status !== 0) {
  const conflicts = git(["diff", "--name-only", "--diff-filter=U"]);
  console.error("The update overlaps Scott-specific code and needs a deliberate conflict resolution.");
  if (conflicts) console.error(`Conflicting files:\n${conflicts}`);
  console.error("Resolve each conflict, or run 'git merge --abort' to return to the pre-update state.");
  process.exit(2);
}

console.log(`Official Cabinet ${shortCommit} is staged on '${reviewBranch}' for inspection.`);
console.log("Review 'git diff --cached', run the required checks, then commit and open a draft pull request.");
console.log("Nothing was pushed or deployed.");
