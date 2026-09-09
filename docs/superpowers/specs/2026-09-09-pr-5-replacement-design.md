# PR #5 Replacement Design

## Goal

Reimplement [upstream PR #5](https://github.com/BarredEwe/time-messenger-mcp-server/pull/5) from current `origin/main`, preserving its approved thread and message fixes while addressing every item in the owner's changes-requested review.

## Scope

The replacement PR includes both original commits as one reviewable PR:

- Normalize the user-threads API wrapper, including `threads: null` and legacy bare-array responses.
- Include post IDs, root IDs, resolved authors, and consistent oldest-first ordering in message output.
- Add reaction API methods and MCP tools.
- Use canonical Mattermost emoji names: `+1`, `-1`, and `100`.
- Resolve reaction authors consistently with message authors.
- Batch uncached author lookups through `POST /api/v4/users/ids`.
- Cache successful username resolutions only. Missing or transiently unavailable users fall back to raw IDs for the current response and remain retryable.
- Add direct behavior and HTTP-contract tests for author resolution and reaction endpoints.

Unrelated refactoring, release changes, and version bumps are out of scope.

## Design

### Thread responses

Model the endpoint response as a `UserThreads` boundary type. `TimeClient.getUserThreads` returns the wrapper response. A small `extractThreads` normalization function accepts the wrapper, `threads: null`, and a bare array, returning a thread array for the formatter. `list_threads` formats only the normalized array.

### Message identity and ordering

Message formatters accept an author map and render `Post ID`, `Root ID` for replies, and `Author: @username`. Unknown users render their raw user ID. Channel, thread, and search handlers collect posts, resolve unique authors once, and pass the map to the formatter. Search output follows the same oldest-first order as channel output.

### Author resolution

`TimeClient.getUsersByIds` calls Mattermost's bulk `POST /api/v4/users/ids` endpoint. The resolver deduplicates user IDs, serves successful entries from a process-local cache, and requests all remaining IDs in one batch. It caches only returned users. IDs omitted from the response or affected by request failures fall back to their raw value for that response and are retried on later calls.

This deliberately avoids permanent negative caching because the existing HTTP abstraction does not expose a per-user 404 from the bulk endpoint. It satisfies the owner's stronger requirement that timeout and 5xx failures remain retryable.

### Reactions

Add typed client methods for create, delete, and list reaction endpoints. The delete path URL-encodes the canonical emoji name, so `+1` becomes `%2B1`.

The MCP tools accept a post ID and emoji input. Unicode emoji are normalized to canonical Mattermost names, surrounding colons are removed from named emoji, and unsupported inputs fail at the tool boundary. `get_reactions` groups entries by emoji and uses the shared author resolver so output contains usernames with the same raw-ID fallback as message output.

### Registration and documentation

Register reaction tools alongside existing tools without changing unrelated registration order. Update README tool documentation and examples to use canonical emoji names.

## Error Handling

Thread response normalization treats absent or null thread collections as empty. Author lookup failures do not fail message or reaction listing; they produce raw-ID fallbacks and are not cached. Reaction mutation and retrieval failures keep the client's existing typed HTTP error behavior and propagate to the MCP error boundary.

## Testing

Development follows red-green-refactor slices:

1. Thread wrapper, null, and bare-array normalization.
2. Message IDs, root IDs, author resolution/fallback, cache retry behavior, and ordering.
3. Canonical emoji normalization and reaction rendering with authors.
4. Exact reaction HTTP methods and paths, including `%2B1` for delete.
5. Tool registration plus full typecheck, test, and production build.

## Commit Structure

Implementation stays in focused commits:

1. Thread and message identity fixes with their tests.
2. Reaction support and owner-requested corrections with their tests and documentation.

The design document is a separate preparatory commit.
