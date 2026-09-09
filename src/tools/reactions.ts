import { z } from 'zod';
import type { TimeClient } from '../client/time-client.js';
import type { Reaction } from '../types/time-api.js';
import { resolveAuthors } from './authors.js';

const reactionEmojiNames = new Map([
  ['+1', '+1'],
  ['👍', '+1'],
  [':+1:', '+1'],
  ['-1', '-1'],
  ['👎', '-1'],
  [':-1:', '-1'],
  ['100', '100'],
  ['💯', '100'],
  [':100:', '100'],
]);

export function normalizeReactionEmoji(emoji: string): string {
  const canonicalEmoji = reactionEmojiNames.get(emoji);
  if (!canonicalEmoji) {
    throw new Error(`Unsupported reaction emoji: ${emoji}`);
  }

  return canonicalEmoji;
}

export function formatReactions(
  reactions: readonly Reaction[],
  authors: ReadonlyMap<string, string> = new Map(),
): string {
  if (reactions.length === 0) {
    return 'No reactions found.';
  }

  const reactionsByEmoji = new Map<string, string[]>();
  for (const reaction of reactions) {
    const users = reactionsByEmoji.get(reaction.emoji_name);
    if (users) {
      users.push(reaction.user_id);
    } else {
      reactionsByEmoji.set(reaction.emoji_name, [reaction.user_id]);
    }
  }

  const lines = [...reactionsByEmoji].map(([emojiName, userIds]) => {
    const users = userIds.map((userId) => `@${authors.get(userId) ?? userId}`);
    return `${emojiName}: ${users.join(', ')}`;
  });

  return `Reactions:\n\n${lines.join('\n')}`;
}

const reactionSchema = z.object({
  post_id: z.string(),
  emoji: z.string(),
}).strict();

const getReactionsSchema = z.object({
  post_id: z.string(),
}).strict();

export const reactionTools = [
  {
    name: 'add_reaction',
    description: 'Add a +1, -1, or 100 reaction to a post',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: { type: 'string', description: 'Post ID' },
        emoji: { type: 'string', description: 'Emoji: +1, -1, or 100' },
      },
      required: ['post_id', 'emoji'],
      additionalProperties: false,
    },
    handler: async (client: TimeClient, args: unknown, userId: string) => {
      const params = reactionSchema.parse(args);
      const emojiName = normalizeReactionEmoji(params.emoji);
      await client.addReaction(userId, params.post_id, emojiName);

      return {
        content: [{ type: 'text', text: `Added ${emojiName} reaction to post ${params.post_id}.` }],
      };
    },
  },
  {
    name: 'remove_reaction',
    description: 'Remove your +1, -1, or 100 reaction from a post',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: { type: 'string', description: 'Post ID' },
        emoji: { type: 'string', description: 'Emoji: +1, -1, or 100' },
      },
      required: ['post_id', 'emoji'],
      additionalProperties: false,
    },
    handler: async (client: TimeClient, args: unknown, userId: string) => {
      const params = reactionSchema.parse(args);
      const emojiName = normalizeReactionEmoji(params.emoji);
      await client.removeReaction(userId, params.post_id, emojiName);

      return {
        content: [{ type: 'text', text: `Removed ${emojiName} reaction from post ${params.post_id}.` }],
      };
    },
  },
  {
    name: 'get_reactions',
    description: 'List reactions on a post grouped by emoji',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: { type: 'string', description: 'Post ID' },
      },
      required: ['post_id'],
      additionalProperties: false,
    },
    handler: async (client: TimeClient, args: unknown) => {
      const params = getReactionsSchema.parse(args);
      const reactions = await client.getReactions(params.post_id);
      const authors = await resolveAuthors(client, reactions.map((reaction) => reaction.user_id));

      return {
        content: [{ type: 'text', text: formatReactions(reactions, authors) }],
      };
    },
  },
];
