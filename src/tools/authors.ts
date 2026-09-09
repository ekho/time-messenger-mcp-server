import type { TimeClient } from '../client/time-client.js';
import { TimeApiError, TimeTransportError } from '../types/time-api.js';

const authorCaches = new WeakMap<TimeClient, Map<string, string>>();

function authorCacheFor(client: TimeClient): Map<string, string> {
  const cachedAuthors = authorCaches.get(client);
  if (cachedAuthors) {
    return cachedAuthors;
  }

  const authors = new Map<string, string>();
  authorCaches.set(client, authors);
  return authors;
}

export async function resolveAuthors(
  client: TimeClient,
  userIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const cache = authorCacheFor(client);
  const resolvedAuthors = new Map<string, string>();
  const uncachedIds: string[] = [];

  for (const userId of new Set(userIds)) {
    const username = cache.get(userId);
    if (username) {
      resolvedAuthors.set(userId, username);
    } else {
      uncachedIds.push(userId);
    }
  }

  if (uncachedIds.length === 0) {
    return resolvedAuthors;
  }

  try {
    const users = await client.getUsersByIds(uncachedIds);
    for (const user of users) {
      cache.set(user.id, user.username);
      resolvedAuthors.set(user.id, user.username);
    }
  } catch (error) {
    if (error instanceof TimeTransportError) {
      return resolvedAuthors;
    }
    if (error instanceof TimeApiError && (error.statusCode === 429 || error.statusCode >= 500)) {
      return resolvedAuthors;
    }
    throw error;
  }

  return resolvedAuthors;
}
