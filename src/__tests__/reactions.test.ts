import { describe, expect, it, vi } from 'vitest';
import { TimeClient } from '../client/time-client.js';
import { formatReactions, normalizeReactionEmoji, reactionTools } from '../tools/reactions.js';
import type { Reaction } from '../types/time-api.js';

describe('reaction emoji normalization', () => {
  it.each([
    ['👍', '+1'],
    ['👎', '-1'],
    ['💯', '100'],
    [':+1:', '+1'],
    [':-1:', '-1'],
    [':100:', '100'],
    ['+1', '+1'],
    ['-1', '-1'],
    ['100', '100'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeReactionEmoji(input)).toBe(expected);
  });

  it('rejects unsupported emoji', () => {
    expect(() => normalizeReactionEmoji('heart')).toThrow('Unsupported reaction emoji');
  });
});

describe('reaction output', () => {
  it('groups canonical reactions and uses resolved authors with raw-ID fallback', () => {
    const reactions = [
      { user_id: 'u1', post_id: 'p1', emoji_name: '+1', create_at: 1 },
      { user_id: 'u2', post_id: 'p1', emoji_name: '+1', create_at: 2 },
      { user_id: 'u1', post_id: 'p1', emoji_name: '100', create_at: 3 },
    ] satisfies Reaction[];

    expect(formatReactions(reactions, new Map([['u1', 'alice']]))).toBe(
      'Reactions:\n\n+1: @alice, @u2\n100: @alice'
    );
  });

  it('reports when a post has no reactions', () => {
    expect(formatReactions([])).toBe('No reactions found.');
  });
});

describe('reaction tools', () => {
  const findTool = (name: string) => reactionTools.find((tool) => tool.name === name);

  it('publishes add, remove, and list reaction tools with post and emoji schemas', () => {
    expect(reactionTools.map((tool) => tool.name)).toEqual([
      'add_reaction',
      'remove_reaction',
      'get_reactions',
    ]);
    expect(findTool('add_reaction')?.inputSchema).toEqual({
      type: 'object',
      properties: {
        post_id: { type: 'string', description: 'Post ID' },
        emoji: { type: 'string', description: 'Emoji: +1, -1, or 100' },
      },
      required: ['post_id', 'emoji'],
      additionalProperties: false,
    });
  });

  it('rejects unsupported input before any mutation', async () => {
    const client = new TimeClient('https://time.test.com', 'test-token');
    const addReactionSpy = vi.spyOn(client, 'addReaction');
    const tool = reactionTools[0];

    await expect(tool.handler(client, { post_id: 'p1', emoji: 'heart' }, 'u1'))
      .rejects.toThrow('Unsupported reaction emoji');

    expect(addReactionSpy).not.toHaveBeenCalled();
  });

  it('rejects unexpected add_reaction fields before mutation', async () => {
    const client = new TimeClient('https://time.test.com', 'test-token');
    const addReactionSpy = vi.spyOn(client, 'addReaction');

    await expect(reactionTools[0].handler(client, {
      post_id: 'p1', emoji: '+1', unexpected: true,
    }, 'u1')).rejects.toThrow();

    expect(addReactionSpy).not.toHaveBeenCalled();
  });

  it('rejects unsupported remove_reaction input before mutation', async () => {
    const client = new TimeClient('https://time.test.com', 'test-token');
    const removeReactionSpy = vi.spyOn(client, 'removeReaction').mockResolvedValue(undefined);

    await expect(reactionTools[1].handler(client, { post_id: 'p1', emoji: 'heart' }, 'u1'))
      .rejects.toThrow('Unsupported reaction emoji');

    expect(removeReactionSpy).not.toHaveBeenCalled();
  });

  it('rejects unexpected remove_reaction and get_reactions fields', async () => {
    const client = new TimeClient('https://time.test.com', 'test-token');
    const removeReactionSpy = vi.spyOn(client, 'removeReaction');
    const getReactionsSpy = vi.spyOn(client, 'getReactions');

    await expect(reactionTools[1].handler(client, {
      post_id: 'p1', emoji: '+1', unexpected: true,
    }, 'u1')).rejects.toThrow();
    await expect(reactionTools[2].handler(client, {
      post_id: 'p1', unexpected: true,
    }, 'u1')).rejects.toThrow();

    expect(removeReactionSpy).not.toHaveBeenCalled();
    expect(getReactionsSpy).not.toHaveBeenCalled();
  });
});
