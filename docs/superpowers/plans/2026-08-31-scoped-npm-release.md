# Scoped npm Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `@ekho/time-messenger-mcp-server@1.4.0` from `next` as a public npm package under `latest`.

**Architecture:** This is a metadata-only release. The package name, repository metadata, lockfile roots, and user installation instructions change; the executable name remains `time-messenger-mcp-server`. Publish only an inspected tarball from the verified and tagged release commit.

**Tech Stack:** npm CLI, Node.js 20.19+, Git, TypeScript/Vitest/tsup.

## Global Constraints

- Run every Git command with `GIT_MASTER=1`.
- Preserve `bin.time-messenger-mcp-server` as `dist/index.js`.
- Publish `@ekho/time-messenger-mcp-server@1.4.0` with `--access public --tag latest`.
- Never capture credentials, tokens, MFA codes, or OTPs.
- Never unpublish, retag, deprecate, change ownership, or delete the release tag.

---

### Task 1: Synchronize the Design Commit

**Files:**
- Modify: none

- [ ] Verify branch and expected unpushed documentation commit:

```bash
GIT_MASTER=1 git status --short --branch
GIT_MASTER=1 git log --oneline origin/next..next
GIT_MASTER=1 git diff --name-status origin/next..next
```

Expected: only the approved release design and this implementation plan are ahead.

- [ ] Push it and require the branch to align:

```bash
GIT_MASTER=1 git push origin next:next
GIT_MASTER=1 git fetch origin next
GIT_MASTER=1 git rev-list --left-right --count next...origin/next
```

Expected: `0 0`.

### Task 2: Clear npm Authentication and Registry Gates

**Files:**
- Modify: none

- [ ] Check the npm registry and identity:

```bash
npm config get registry
npm ping --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

Expected: `https://registry.npmjs.org/` and npm identity `ekho`. If identity is not authenticated, stop until the user logs in privately; do not run `npm login` or inspect npm credentials.

- [ ] Confirm the scoped version is absent:

```bash
npm view @ekho/time-messenger-mcp-server@1.4.0 version --json --registry=https://registry.npmjs.org/
```

Expected: authenticated `E404`; any other result blocks release preparation.

### Task 3: Apply Scoped Metadata and Installation Documentation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`

- [ ] Change `package.json` while preserving the current version `1.3.0`:

```json
{
  "name": "@ekho/time-messenger-mcp-server",
  "publishConfig": { "access": "public" },
  "repository": { "type": "git", "url": "https://github.com/ekho/time-messenger-mcp-server.git" },
  "bugs": { "url": "https://github.com/ekho/time-messenger-mcp-server/issues" },
  "homepage": "https://github.com/ekho/time-messenger-mcp-server#readme"
}
```

- [ ] Change the root `name` and `packages[""].name` values in `package-lock.json` to `@ekho/time-messenger-mcp-server`.

- [ ] In `README.md`, replace all npm/npx package references with `@ekho/time-messenger-mcp-server`, update GitHub clone links to `ekho`, and state Node.js `20.19+`. Keep all executable invocations as `time-messenger-mcp-server`.

- [ ] Verify the metadata contract:

```bash
node --input-type=module -e 'import assert from "node:assert/strict"; import fs from "node:fs"; const p=JSON.parse(fs.readFileSync("package.json","utf8")); const l=JSON.parse(fs.readFileSync("package-lock.json","utf8")); assert.equal(p.name,"@ekho/time-messenger-mcp-server"); assert.equal(l.name,p.name); assert.equal(l.packages[""].name,p.name); assert.equal(p.publishConfig.access,"public"); assert.deepEqual(p.bin,{"time-messenger-mcp-server":"dist/index.js"});'
GIT_MASTER=1 git diff --check
```

- [ ] Commit the coupled consumer contract:

```bash
GIT_MASTER=1 git add package.json package-lock.json README.md
GIT_MASTER=1 git diff --staged --check
GIT_MASTER=1 git commit -m "chore: scope npm package metadata" -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
```

### Task 4: Bump the Release Version

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] Set the `package.json` version and the lockfile top-level and root-package versions to `1.4.0`.

- [ ] Verify all three values and commit:

```bash
node --input-type=module -e 'import assert from "node:assert/strict"; import fs from "node:fs"; const p=JSON.parse(fs.readFileSync("package.json","utf8")); const l=JSON.parse(fs.readFileSync("package-lock.json","utf8")); assert.equal(p.version,"1.4.0"); assert.equal(l.version,p.version); assert.equal(l.packages[""].version,p.version);'
GIT_MASTER=1 git add package.json package-lock.json
GIT_MASTER=1 git diff --staged --check
GIT_MASTER=1 git commit -m "chore: release v1.4.0" -m "Ultraworked with [Sisyphus](https://github.com/code-yeongyu/oh-my-openagent)" -m "Co-authored-by: Sisyphus <clio-agent@sisyphuslabs.ai>"
```

### Task 5: Verify and Inspect the Exact Artifact

**Files:**
- Modify: none

- [ ] Run the release gate:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run --json
```

- [ ] Create and inspect exactly one tarball outside the repository:

```bash
ARTIFACT_DIR="$(mktemp -d)"
PACK_JSON="$(npm pack --pack-destination "$ARTIFACT_DIR" --json)"
TARBALL="$ARTIFACT_DIR/$(node -e 'const p=JSON.parse(process.argv[1]); process.stdout.write(p[0].filename)' "$PACK_JSON")"
tar -tzf "$TARBALL"
```

Require `package/package.json`, `package/README.md`, `package/LICENSE`, `package/dist/index.js`, and `package/dist/index.d.ts`; reject credentials, source, tests, or CI files.

- [ ] Dry-run the exact publish operation:

```bash
npm publish "$TARBALL" --dry-run --access public --tag latest --registry=https://registry.npmjs.org/
```

### Task 6: Tag, Push, Publish, and Verify

**Files:**
- Modify: none

- [ ] Confirm the branch has exactly the two release commits and create/push `v1.4.0`:

```bash
GIT_MASTER=1 git fetch origin next
GIT_MASTER=1 git log --oneline origin/next..next
GIT_MASTER=1 git tag -a v1.4.0 -m "v1.4.0"
GIT_MASTER=1 git push origin next:next
GIT_MASTER=1 git push origin refs/tags/v1.4.0
```

- [ ] Immediately recheck identity and version absence. Present package, version, access, tag, commit, tarball path, integrity, and file list. Require fresh explicit user approval before the irreversible command:

```bash
npm publish "$TARBALL" --access public --tag latest --registry=https://registry.npmjs.org/
```

- [ ] Verify the registry and a clean install:

```bash
npm view @ekho/time-messenger-mcp-server@1.4.0 name version bin engines repository dist --json --registry=https://registry.npmjs.org/
npm view @ekho/time-messenger-mcp-server dist-tags --json --registry=https://registry.npmjs.org/
VERIFY_DIR="$(mktemp -d)"
npm install --prefix "$VERIFY_DIR" --ignore-scripts @ekho/time-messenger-mcp-server@1.4.0 --registry=https://registry.npmjs.org/
test -x "$VERIFY_DIR/node_modules/.bin/time-messenger-mcp-server"
```

Expected: registry and `latest` resolve to `1.4.0`; installed package exposes the unchanged binary.
