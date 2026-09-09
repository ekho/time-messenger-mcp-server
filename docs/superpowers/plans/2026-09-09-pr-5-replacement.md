# PR #5 Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement PR #5 from `origin/main` at `5986540`, incorporating design commit `083ac7c`, while preserving the approved thread and message behavior and resolving the owner's requested changes.

**Architecture:** Keep the existing `TimeClient` HTTP boundary and MCP tool registration structure. Add a typed user-thread response normalizer, a shared process-local author resolver backed by one bulk `POST /api/v4/users/ids` request for uncached IDs, and reaction methods and tools that reuse the resolver. Unknown or temporarily unavailable users fall back to raw IDs for the current response and are never negatively cached.

**Tech Stack:** TypeScript, MCP SDK, Zod, Vitest, tsup, Mattermost-compatible Time API v4.

## Global Constraints

- Base the implementation on `origin/main` commit `5986540` plus design commit `083ac7c`.
- Preserve existing bulk channel-read behavior and unrelated tool registration order.
- Use canonical Mattermost emoji names `+1`, `-1`, and `100`.
- Encode `+1` as `%2B1` in reaction delete transport URLs.
- Do not add dependencies, version changes, release steps, or unrelated refactors.
- Open the replacement PR against `BarredEwe/main`.

---

### Task 1: Thread and Message Identity Slice

**Files:**
- Modify: `src/types/time-api.ts`
- Modify: `src/client/time-client.ts`
- Modify: `src/tools/threads.ts`
- Modify: `src/tools/messages.ts`
- Create: `src/tools/authors.ts`
- Test: `src/__tests__/time-client.test.ts`
- Test: `src/__tests__/format-threads.test.ts`
- Test: `src/__tests__/format-messages.test.ts`
- Test: `src/__tests__/tool-handlers.test.ts`

**Interfaces:**
- `TimeClient.getUserThreads(...)` returns a typed `UserThreads` boundary response, while the normalizer accepts that wrapper, `threads: null`, and a legacy bare array.
- `extractThreads(response: UserThreads | Thread[] | null | undefined): Thread[]` returns an empty array for an absent or null collection.
- `TimeClient.getUsersByIds(userIds: string[]): Promise<User[]>` sends one bulk request for the uncached IDs.
- The shared author resolver accepts post or reaction user IDs and returns `ReadonlyMap<string, string>` values for resolved usernames; formatters provide raw-ID fallback for unresolved entries.
- Message formatters accept the resolved author map and render `Post ID`, `Root ID` for replies, and `Author: @username`.

- [ ] **Step 1: Write RED tests for the thread boundary and normalization.**

  Add tests proving that the client models the wrapper response, `list_threads` formats `threads: null` as an empty list, and the formatter also accepts the legacy bare-array response. Assert that no null collection reaches the formatter.

- [ ] **Step 2: Run the focused thread tests and confirm failure.**

  Run `npm test -- src/__tests__/time-client.test.ts src/__tests__/format-threads.test.ts src/__tests__/tool-handlers.test.ts`.
  Expected result: the new wrapper, null handling, or normalization assertions fail before implementation.

- [ ] **Step 3: Implement the thread wrapper and normalization.**

  Add the `UserThreads` API type, make `getUserThreads` return it, and add the small `extractThreads` boundary helper. Treat absent or null `threads` as `[]`; retain bare-array compatibility only at this boundary. Keep `list_threads` output behavior unchanged apart from consuming the normalized array.

- [ ] **Step 4: Write RED tests for message identity, authors, cache behavior, and ordering.**

  Extend formatter and handler tests to require post IDs, reply root IDs, resolved `Author: @username`, and raw-ID fallback. Cover channel, thread, and search paths, including oldest-first search output. Add resolver tests proving duplicate IDs are deduplicated, cached successful users are not requested again, omitted users are retried, and a bulk timeout or 5xx fallback is retried on the next call. Assert that each request contains all uncached IDs in one `POST /users/ids` call.

- [ ] **Step 5: Run the focused message and resolver tests and confirm failure.**

  Run `npm test -- src/__tests__/format-messages.test.ts src/__tests__/time-client.test.ts src/__tests__/tool-handlers.test.ts`.
  Expected result: the new identity, author, fallback, retry, and ordering assertions fail before implementation.

- [ ] **Step 6: Implement the shared author resolver and message identity flow.**

  Add `src/tools/authors.ts` with a process-local cache containing only successful username resolutions. Deduplicate IDs, serve cached entries, request every remaining ID through `getUsersByIds` in one batch, cache only returned users, and leave omitted or failed IDs uncached so later calls retry them. Update channel, thread, and search handlers to collect unique post authors once and pass the map to formatters. Render raw IDs when resolution is unavailable. Include post IDs, reply root IDs, and consistent oldest-first ordering without changing the existing bulk channel-read behavior.

- [ ] **Step 7: Run the RED tests again as GREEN tests.**

  Run the focused commands from Steps 2 and 5. Expected result: all thread, identity, author, fallback, cache-retry, and ordering tests pass.

- [ ] **Step 8: Create the first implementation commit boundary.**

  Review the diff to ensure it contains only the thread and message identity slice and its tests. Commit exactly these changes with `GIT_MASTER=1 git add src/types/time-api.ts src/client/time-client.ts src/tools/authors.ts src/tools/threads.ts src/tools/messages.ts src/__tests__/time-client.test.ts src/__tests__/format-threads.test.ts src/__tests__/format-messages.test.ts src/__tests__/tool-handlers.test.ts`, then commit with `GIT_MASTER=1 git commit -m "Fix thread responses and message authors"`.

### Task 2: Reaction Slice, Documentation, and Delivery Verification

**Files:**
- Modify: `src/types/time-api.ts`
- Modify: `src/client/time-client.ts`
- Create: `src/tools/reactions.ts`
- Modify: `src/index.ts`
- Modify: `README.md`
- Modify: `src/__tests__/time-client.test.ts`
- Modify: `src/__tests__/tool-handlers.test.ts`
- Create: `src/__tests__/reactions.test.ts`

**Interfaces:**
- `TimeClient.addReaction(...)`, `removeReaction(...)`, and `getReactions(...)` expose typed reaction API operations with existing typed HTTP errors preserved.
- Reaction tools accept a post ID and emoji input, normalize Unicode emoji or colon-wrapped names to canonical Mattermost names, and reject unsupported inputs at the tool boundary.
- `get_reactions` groups reactions by canonical emoji and uses the shared author resolver, producing usernames or raw-ID fallback.

- [ ] **Step 1: Write RED tests for canonical emoji normalization and reaction output.**

  Add direct tests for Unicode thumbs-up and thumbs-down, `:+1:`, `:-1:`, `:100:`, and canonical names. Assert unsupported emoji fail at the tool boundary. Assert `get_reactions` groups by emoji and includes resolved author names, while unresolved authors remain raw IDs.

- [ ] **Step 2: Write RED HTTP-contract tests for all reaction methods.**

  Assert create, delete, and list use the expected Mattermost reaction endpoints, HTTP methods, and request bodies. Specifically assert that deleting `+1` requests a path containing `%2B1`, not a literal plus sign. Assert typed client errors are still propagated.

- [ ] **Step 3: Run the focused reaction tests and confirm failure.**

  Run `npm test -- src/__tests__/reactions.test.ts src/__tests__/time-client.test.ts src/__tests__/tool-handlers.test.ts`.
  Expected result: reaction normalization, tool, grouping, and HTTP-contract assertions fail before implementation.

- [ ] **Step 4: Implement typed reaction client methods and tools.**

  Add reaction request and response types, then implement create, delete, and list methods in `TimeClient`. URL-encode the canonical emoji segment so `+1` becomes `%2B1`. Add `src/tools/reactions.ts` with the three MCP operations, canonical input normalization, boundary rejection for unsupported values, grouped listing, and shared author resolution. Register the tools in `src/index.ts` alongside existing tools without changing unrelated registration order.

- [ ] **Step 5: Update README reaction documentation.**

  Document the reaction tools and examples in `README.md`, using only canonical names `+1`, `-1`, and `100`. Do not alter unrelated setup, version, release, or channel-read documentation.

- [ ] **Step 6: Run the reaction tests as GREEN tests.**

  Run the focused command from Step 3. Expected result: normalization, unsupported-input, grouping, author-output, endpoint, method, body, and `%2B1` transport tests pass.

- [ ] **Step 7: Run the complete verification suite.**

  Run `npm test`, then `npm run typecheck`, then `npm run build`. Expected result: all Vitest tests pass, TypeScript reports no errors, and tsup produces the production build.

- [ ] **Step 8: Perform manual surface verification.**

  Start the built MCP server with `TIME_URL` and `TIME_TOKEN` configured in the environment, exercise the registered thread, message, and reaction tools through an MCP client or existing test harness, and verify thread normalization, oldest-first output, raw-ID fallback, canonical reaction names, grouped reaction authors, and the existing bulk channel-read operation. Use a deliberately unsupported emoji to verify the tool boundary rejects it.

- [ ] **Step 9: Create the second implementation commit boundary.**

  Review the diff for reaction support, owner-requested corrections, tests, and README changes only. Stage with `GIT_MASTER=1 git add src/types/time-api.ts src/client/time-client.ts src/tools/reactions.ts src/index.ts README.md src/__tests__/time-client.test.ts src/__tests__/tool-handlers.test.ts src/__tests__/reactions.test.ts`, then commit with `GIT_MASTER=1 git commit -m "Add canonical emoji reaction support"`.

- [ ] **Step 10: Review the complete replacement branch.**

  Compare the two implementation commits with the approved design and run the repository review workflow. Confirm the review checks thread and message behavior, shared author caching and retry semantics, reaction endpoint encoding, registration order, preservation of bulk channel-read behavior, test coverage, typecheck, and build output.

- [ ] **Step 11: Push and create the replacement PR.**

  After review passes, push `fix/thread-list-post-authors-reactions` to the configured fork and create a PR targeting `BarredEwe/main`. The PR description must state that it replaces upstream PR #5, starts from `origin/main` `5986540`, includes design commit `083ac7c` as preparatory context, preserves the approved fixes, and addresses the owner's requested changes. Do not include release or version changes.

## Self-Review Checklist

- [ ] Thread wrapper, null collection, and bare-array normalization are covered in Task 1.
- [ ] Post IDs, reply root IDs, resolved authors, raw-ID fallback, cache retry behavior, and oldest-first ordering are covered in Task 1.
- [ ] Bulk `POST /users/ids`, deduplication, successful-only caching, and no negative caching are explicit in Task 1.
- [ ] Reaction normalization, canonical `+1`, `-1`, `100`, author output, grouping, and `%2B1` transport coverage are explicit in Task 2.
- [ ] Existing bulk channel-read behavior and unrelated registration order are explicitly preserved.
- [ ] Both implementation commit boundaries, full tests, typecheck, build, review, push, and PR creation are specified.
- [ ] No dependency, version, release, or unrelated refactor work is requested.
- [ ] No placeholders or undefined interfaces remain.
