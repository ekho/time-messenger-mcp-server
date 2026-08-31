# Scoped npm Release Design

## Goal

Publish the integrated `next` branch as the public npm package
`@ekho/time-messenger-mcp-server@1.4.0` under the `latest` dist-tag.

## Package Contract

- Package name changes from `time-messenger-mcp-server` to
  `@ekho/time-messenger-mcp-server`.
- The executable remains `time-messenger-mcp-server` so existing command and
  MCP server configuration names are unchanged after consumers switch package
  names.
- The release version is `1.4.0`, continuing the previous unscoped package's
  version line and covering the feature and fixes merged into `next`.
- The package remains public and is initially published with explicit
  `--access public` and `--tag latest`.
- The package engine floor remains `>=20.19.0`; the README must state the
  matching Node.js requirement.

## Metadata and Documentation

The release changes only package identity and user-facing installation
instructions:

- Update the root package name and lockfile root package name to the scoped
  package.
- Set the package version and lockfile root version to `1.4.0`.
- Add `publishConfig.access: public` so the package's intended access is
  explicit.
- Point repository, bugs, and homepage metadata to the `ekho` fork.
- Replace README npm and npx package references with the scoped name, while
  preserving the binary invocation name.
- Correct the README Node.js requirement to `20.19+`.

No runtime source or tool contract changes are part of this release.

## Release Artifact and Verification

The release is built and tested from the exact `next` commit. Before publishing:

1. Confirm `next` is clean and matches `origin/next`.
2. Confirm the scoped package/version is absent from npm and that the active
   npm identity can publish under `@ekho`.
3. Run `npm ci`, typecheck, test, and build.
4. Run `npm pack --dry-run`, create a tarball, and inspect its file list,
   integrity, and executable/declaration files.
5. Publish that inspected tarball with `npm publish <tarball> --access public
   --tag latest`.
6. Verify the registry version, `latest` tag, package metadata, and a clean
   install of the package from npm.

## Git and Failure Handling

Release metadata/documentation and version/lockfile changes are separate
atomic commits. An annotated `v1.4.0` tag points to the release commit, and
the commits and tag are pushed to `origin/next` before publishing.

npm package versions are immutable. If publication succeeds but a defect is
found, release a forward fix with a new version; do not unpublish, retag,
deprecate, alter ownership, or delete a Git tag as part of this workflow.
Authentication, MFA, and WebAuthn actions remain user-controlled; no
credentials or one-time codes are recorded in commands or logs.
