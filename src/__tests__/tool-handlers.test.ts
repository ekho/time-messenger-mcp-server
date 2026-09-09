import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messageTools } from '../tools/messages.js';
import { threadTools } from '../tools/threads.js';
import { channelTools } from '../tools/channels.js';
import { teamTools } from '../tools/teams.js';
import { userTools } from '../tools/users.js';
import { TimeApiError, TimeTransportError } from '../types/time-api.js';
import type { TimeClient } from '../client/time-client.js';
import type { Post, PostList, Channel, Team, User, Thread, ThreadStats, ChannelUnread, MarkChannelsReadResult, TeamUnread, SearchResult } from '../types/time-api.js';

const markChannelsReadResult = {
  successes: [],
  failures: [],
} satisfies MarkChannelsReadResult;

function createMockClient(overrides: Partial<TimeClient> = {}): TimeClient {
  return {
    getMe: vi.fn().mockResolvedValue({ id: 'me', username: 'me' } as User),
    getUser: vi.fn().mockResolvedValue({ id: 'u1', username: 'user1' } as User),
    getUsersByIds: vi.fn().mockResolvedValue([]),
    searchUsers: vi.fn().mockResolvedValue([] as User[]),
    getTeamsForUser: vi.fn().mockResolvedValue([] as Team[]),
    getTeam: vi.fn().mockResolvedValue({ id: 't1', display_name: 'Team' } as Team),
    getTeamsUnread: vi.fn().mockResolvedValue([] as TeamUnread[]),
    getTeamUnread: vi.fn().mockResolvedValue({ team_id: 't1', msg_count: 5, mention_count: 1 } as TeamUnread),
    getChannelsForUser: vi.fn().mockResolvedValue([] as Channel[]),
    getAllChannelsForUser: vi.fn().mockResolvedValue([] as Channel[]),
    markChannelsRead: vi.fn().mockResolvedValue(markChannelsReadResult),
    getChannel: vi.fn().mockResolvedValue({ id: 'ch1', display_name: 'General' } as Channel),
    searchChannels: vi.fn().mockResolvedValue([] as Channel[]),
    getChannelUnread: vi.fn().mockResolvedValue({ channel_id: 'ch1', msg_count: 3, mention_count: 0 } as ChannelUnread),
    createPost: vi.fn().mockResolvedValue({ id: 'p1', create_at: 1000 } as Post),
    getPostsForChannel: vi.fn().mockResolvedValue({ order: [], posts: {}, next_post_id: '', prev_post_id: '' } as PostList),
    getPostThread: vi.fn().mockResolvedValue({ order: [], posts: {}, next_post_id: '', prev_post_id: '' } as PostList),
    searchPosts: vi.fn().mockResolvedValue({ order: [], posts: {} } as SearchResult),
    getUserThreads: vi.fn().mockResolvedValue({
      threads: [],
      total: 0,
      total_unread_threads: 0,
      total_unread_mentions: 0,
    }),
    getThreadsStats: vi.fn().mockResolvedValue({ total_unread_threads: 2, total_unread_mentions: 1 } as ThreadStats),
    getUserThread: vi.fn().mockResolvedValue({ id: 'th1', reply_count: 3 } as Thread),
    startFollowingThread: vi.fn().mockResolvedValue(undefined),
    stopFollowingThread: vi.fn().mockResolvedValue(undefined),
    updateThreadRead: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as TimeClient;
}

const findTool = (tools: unknown[], name: string) =>
  (tools as { name: string; description: string; inputSchema: Record<string, unknown>; handler: Function }[]).find((t) => t.name === name)!;

const userId = 'user123';

describe('messageTools handlers', () => {
  let client: TimeClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('send_message calls createPost with correct args', async () => {
    const tool = findTool(messageTools, 'send_message');
    await tool.handler(client, { channel_id: 'ch1', message: 'Hi' });
    expect(client.createPost).toHaveBeenCalledWith('ch1', 'Hi', undefined);
  });

  it('send_message with root_id calls createPost with root_id', async () => {
    const tool = findTool(messageTools, 'send_message');
    await tool.handler(client, { channel_id: 'ch1', message: 'Reply', root_id: 'p1' });
    expect(client.createPost).toHaveBeenCalledWith('ch1', 'Reply', 'p1');
  });

  it('send_message rejects missing channel_id', async () => {
    const tool = findTool(messageTools, 'send_message');
    await expect(tool.handler(client, { message: 'Hi' })).rejects.toThrow();
  });

  it('send_message rejects missing message', async () => {
    const tool = findTool(messageTools, 'send_message');
    await expect(tool.handler(client, { channel_id: 'ch1' })).rejects.toThrow();
  });

  it('get_channel_messages calls getPostsForChannel', async () => {
    const tool = findTool(messageTools, 'get_channel_messages');
    await tool.handler(client, { channel_id: 'ch1', page: 2, per_page: 10 });
    expect(client.getPostsForChannel).toHaveBeenCalledWith('ch1', 2, 10);
  });

  it('get_channel_messages resolves unique authors in bulk and formats their identities', async () => {
    const post = {
      id: 'p1', create_at: 1000, update_at: 0, delete_at: 0, edit_at: 0,
      user_id: 'u1', channel_id: 'ch1', root_id: '', parent_id: '', original_id: '',
      message: 'Hello', type: '', props: {}, hashtags: '', pending_post_id: '', metadata: {},
    } satisfies Post;
    const secondPost = {
      id: 'p2', create_at: 2000, update_at: 0, delete_at: 0, edit_at: 0,
      user_id: 'u2', channel_id: 'ch1', root_id: '', parent_id: '', original_id: '',
      message: 'Hello again', type: '', props: {}, hashtags: '', pending_post_id: '', metadata: {},
    } satisfies Post;
    vi.mocked(client.getPostsForChannel).mockResolvedValue({
      order: ['p1', 'p2', 'p1'], posts: { p1: post, p2: secondPost }, next_post_id: '', prev_post_id: '',
    });
    vi.mocked(client.getUsersByIds).mockResolvedValue([{
      id: 'u1', create_at: 0, update_at: 0, delete_at: 0, username: 'alice',
      first_name: '', last_name: '', nickname: '', email: '', auth_data: '',
      auth_service: '', roles: '', locale: 'en', notify_props: {},
    } satisfies User, {
      id: 'u2', create_at: 0, update_at: 0, delete_at: 0, username: 'bob',
      first_name: '', last_name: '', nickname: '', email: '', auth_data: '',
      auth_service: '', roles: '', locale: 'en', notify_props: {},
    } satisfies User]);

    const tool = findTool(messageTools, 'get_channel_messages');
    const result = await tool.handler(client, { channel_id: 'ch1' });

    expect(client.getUsersByIds).toHaveBeenCalledTimes(1);
    expect(client.getUsersByIds).toHaveBeenCalledWith(['u1', 'u2']);
    expect(result.content[0].text).toContain('Post ID: p1');
    expect(result.content[0].text).toContain('Author: @alice');
  });

  it('retries unresolved authors while caching successful resolutions', async () => {
    const post = {
      id: 'p1', create_at: 1000, update_at: 0, delete_at: 0, edit_at: 0,
      user_id: 'u1', channel_id: 'ch1', root_id: '', parent_id: '', original_id: '',
      message: 'Hello', type: '', props: {}, hashtags: '', pending_post_id: '', metadata: {},
    } satisfies Post;
    vi.mocked(client.getPostsForChannel).mockResolvedValue({
      order: ['p1'], posts: { p1: post }, next_post_id: '', prev_post_id: '',
    });
    const tool = findTool(messageTools, 'get_channel_messages');
    await tool.handler(client, { channel_id: 'ch1' });
    await tool.handler(client, { channel_id: 'ch1' });

    expect(client.getUsersByIds).toHaveBeenCalledTimes(2);
  });

  it('does not request a successfully cached author again', async () => {
    const post = {
      id: 'p1', create_at: 1000, update_at: 0, delete_at: 0, edit_at: 0,
      user_id: 'u1', channel_id: 'ch1', root_id: '', parent_id: '', original_id: '',
      message: 'Hello', type: '', props: {}, hashtags: '', pending_post_id: '', metadata: {},
    } satisfies Post;
    vi.mocked(client.getPostsForChannel).mockResolvedValue({
      order: ['p1'], posts: { p1: post }, next_post_id: '', prev_post_id: '',
    });
    vi.mocked(client.getUsersByIds).mockResolvedValue([{
      id: 'u1', create_at: 0, update_at: 0, delete_at: 0, username: 'alice',
      first_name: '', last_name: '', nickname: '', email: '', auth_data: '',
      auth_service: '', roles: '', locale: 'en', notify_props: {},
    } satisfies User]);

    const tool = findTool(messageTools, 'get_channel_messages');
    await tool.handler(client, { channel_id: 'ch1' });
    const secondResult = await tool.handler(client, { channel_id: 'ch1' });

    expect(client.getUsersByIds).toHaveBeenCalledTimes(1);
    expect(secondResult.content[0].text).toContain('Author: @alice');
  });

  it('falls back after a bulk author failure and retries on the next call', async () => {
    const post = {
      id: 'p1', create_at: 1000, update_at: 0, delete_at: 0, edit_at: 0,
      user_id: 'u1', channel_id: 'ch1', root_id: '', parent_id: '', original_id: '',
      message: 'Hello', type: '', props: {}, hashtags: '', pending_post_id: '', metadata: {},
    } satisfies Post;
    const user = {
      id: 'u1', create_at: 0, update_at: 0, delete_at: 0, username: 'alice',
      first_name: '', last_name: '', nickname: '', email: '', auth_data: '',
      auth_service: '', roles: '', locale: 'en', notify_props: {},
    } satisfies User;
    vi.mocked(client.getPostsForChannel).mockResolvedValue({
      order: ['p1'], posts: { p1: post }, next_post_id: '', prev_post_id: '',
    });
    vi.mocked(client.getUsersByIds)
      .mockRejectedValueOnce(new TimeApiError('upstream unavailable', 503))
      .mockResolvedValueOnce([user]);

    const tool = findTool(messageTools, 'get_channel_messages');
    const fallbackResult = await tool.handler(client, { channel_id: 'ch1' });
    const retryResult = await tool.handler(client, { channel_id: 'ch1' });

    expect(fallbackResult.content[0].text).toContain('Author: @u1');
    expect(retryResult.content[0].text).toContain('Author: @alice');
    expect(client.getUsersByIds).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a transport failure', new TimeTransportError('network unavailable')],
    ['HTTP 429', new TimeApiError('too many requests', 429)],
  ])('falls back after %s during bulk author lookup and retries the ID', async (_description, failure) => {
    const post = {
      id: 'p1', create_at: 1000, update_at: 0, delete_at: 0, edit_at: 0,
      user_id: 'u1', channel_id: 'ch1', root_id: '', parent_id: '', original_id: '',
      message: 'Hello', type: '', props: {}, hashtags: '', pending_post_id: '', metadata: {},
    } satisfies Post;
    const user = {
      id: 'u1', create_at: 0, update_at: 0, delete_at: 0, username: 'alice',
      first_name: '', last_name: '', nickname: '', email: '', auth_data: '',
      auth_service: '', roles: '', locale: 'en', notify_props: {},
    } satisfies User;
    vi.mocked(client.getPostsForChannel).mockResolvedValue({
      order: ['p1'], posts: { p1: post }, next_post_id: '', prev_post_id: '',
    });
    vi.mocked(client.getUsersByIds)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce([user]);

    const tool = findTool(messageTools, 'get_channel_messages');
    const fallbackResult = await tool.handler(client, { channel_id: 'ch1' });
    const retryResult = await tool.handler(client, { channel_id: 'ch1' });

    expect(fallbackResult.content[0].text).toContain('Author: @u1');
    expect(retryResult.content[0].text).toContain('Author: @alice');
    expect(client.getUsersByIds).toHaveBeenCalledTimes(2);
  });

  it('propagates unrelated programming errors from bulk author lookup', async () => {
    const post = {
      id: 'p1', create_at: 1000, update_at: 0, delete_at: 0, edit_at: 0,
      user_id: 'u1', channel_id: 'ch1', root_id: '', parent_id: '', original_id: '',
      message: 'Hello', type: '', props: {}, hashtags: '', pending_post_id: '', metadata: {},
    } satisfies Post;
    const programmingError = new TypeError('cannot read properties of undefined');
    vi.mocked(client.getPostsForChannel).mockResolvedValue({
      order: ['p1'], posts: { p1: post }, next_post_id: '', prev_post_id: '',
    });
    vi.mocked(client.getUsersByIds).mockRejectedValueOnce(programmingError);

    const tool = findTool(messageTools, 'get_channel_messages');

    await expect(tool.handler(client, { channel_id: 'ch1' })).rejects.toBe(programmingError);
  });

  it('get_channel_messages uses defaults', async () => {
    const tool = findTool(messageTools, 'get_channel_messages');
    await tool.handler(client, { channel_id: 'ch1' });
    expect(client.getPostsForChannel).toHaveBeenCalledWith('ch1', 0, 60);
  });

  it('get_channel_messages rejects per_page over the 200 cap', async () => {
    const tool = findTool(messageTools, 'get_channel_messages');
    await expect(
      tool.handler(client, { channel_id: 'ch1', per_page: 100000 })
    ).rejects.toThrow();
    expect(client.getPostsForChannel).not.toHaveBeenCalled();
  });

  it('get_channel_messages accepts per_page at the 200 cap', async () => {
    const tool = findTool(messageTools, 'get_channel_messages');
    await tool.handler(client, { channel_id: 'ch1', per_page: 200 });
    expect(client.getPostsForChannel).toHaveBeenCalledWith('ch1', 0, 200);
  });

  it('get_thread_messages calls getPostThread', async () => {
    const tool = findTool(messageTools, 'get_thread_messages');
    await tool.handler(client, { post_id: 'p1' });
    expect(client.getPostThread).toHaveBeenCalledWith('p1');
  });

  it('get_thread_messages resolves and formats reply authors', async () => {
    const post = {
      id: 'p2', create_at: 2000, update_at: 0, delete_at: 0, edit_at: 0,
      user_id: 'u2', channel_id: 'ch1', root_id: 'p1', parent_id: '', original_id: '',
      message: 'Reply', type: '', props: {}, hashtags: '', pending_post_id: '', metadata: {},
    } satisfies Post;
    vi.mocked(client.getPostThread).mockResolvedValue({
      order: ['p2'], posts: { p2: post }, next_post_id: '', prev_post_id: '',
    });
    vi.mocked(client.getUsersByIds).mockResolvedValue([{
      id: 'u2', create_at: 0, update_at: 0, delete_at: 0, username: 'bob',
      first_name: '', last_name: '', nickname: '', email: '', auth_data: '',
      auth_service: '', roles: '', locale: 'en', notify_props: {},
    } satisfies User]);

    const tool = findTool(messageTools, 'get_thread_messages');
    const result = await tool.handler(client, { post_id: 'p1' });

    expect(client.getUsersByIds).toHaveBeenCalledWith(['u2']);
    expect(result.content[0].text).toContain('Root ID: p1');
    expect(result.content[0].text).toContain('Author: @bob');
  });

  it('search_messages calls searchPosts', async () => {
    const tool = findTool(messageTools, 'search_messages');
    await tool.handler(client, { team_id: 't1', terms: 'hello' });
    expect(client.searchPosts).toHaveBeenCalledWith('t1', 'hello');
  });

  it('search_messages resolves and formats authors', async () => {
    const post = {
      id: 'p1', create_at: 1000, update_at: 0, delete_at: 0, edit_at: 0,
      user_id: 'u3', channel_id: 'ch1', root_id: '', parent_id: '', original_id: '',
      message: 'Found', type: '', props: {}, hashtags: '', pending_post_id: '', metadata: {},
    } satisfies Post;
    vi.mocked(client.searchPosts).mockResolvedValue({ order: ['p1'], posts: { p1: post } });
    vi.mocked(client.getUsersByIds).mockResolvedValue([{
      id: 'u3', create_at: 0, update_at: 0, delete_at: 0, username: 'carol',
      first_name: '', last_name: '', nickname: '', email: '', auth_data: '',
      auth_service: '', roles: '', locale: 'en', notify_props: {},
    } satisfies User]);

    const tool = findTool(messageTools, 'search_messages');
    const result = await tool.handler(client, { team_id: 't1', terms: 'Found' });

    expect(client.getUsersByIds).toHaveBeenCalledWith(['u3']);
    expect(result.content[0].text).toContain('Post ID: p1');
    expect(result.content[0].text).toContain('Author: @carol');
  });
});

describe('threadTools handlers', () => {
  let client: TimeClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('list_threads calls getUserThreads', async () => {
    const tool = findTool(threadTools, 'list_threads');
    await tool.handler(client, { team_id: 't1' }, userId);
    expect(client.getUserThreads).toHaveBeenCalledWith(userId, 't1');
  });

  it('list_threads normalizes a null thread collection before formatting', async () => {
    vi.mocked(client.getUserThreads).mockResolvedValue({
      threads: null,
      total: 0,
      total_unread_threads: 0,
      total_unread_mentions: 0,
    });

    const tool = findTool(threadTools, 'list_threads');
    const result = await tool.handler(client, { team_id: 't1' }, userId);

    expect(result.content[0].text).toBe('No threads found.');
  });

  it('list_threads accepts a legacy bare-array response', async () => {
    const legacyClient = createMockClient({
      getUserThreads: vi.fn().mockResolvedValue([]),
    });

    const tool = findTool(threadTools, 'list_threads');
    const result = await tool.handler(legacyClient, { team_id: 't1' }, userId);

    expect(result.content[0].text).toBe('No threads found.');
  });

  it('get_thread_stats calls getThreadsStats', async () => {
    const tool = findTool(threadTools, 'get_thread_stats');
    const result = await tool.handler(client, { team_id: 't1' }, userId);
    expect(client.getThreadsStats).toHaveBeenCalledWith(userId, 't1');
    expect(result.content[0].text).toContain('2');
    expect(result.content[0].text).toContain('1');
  });

  it('get_thread calls getUserThread', async () => {
    const tool = findTool(threadTools, 'get_thread');
    await tool.handler(client, { team_id: 't1', thread_id: 'th1' }, userId);
    expect(client.getUserThread).toHaveBeenCalledWith(userId, 't1', 'th1');
  });

  it('follow_thread calls startFollowingThread', async () => {
    const tool = findTool(threadTools, 'follow_thread');
    await tool.handler(client, { thread_id: 'th1' }, userId);
    expect(client.startFollowingThread).toHaveBeenCalledWith(userId, 'th1');
  });

  it('unfollow_thread calls stopFollowingThread', async () => {
    const tool = findTool(threadTools, 'unfollow_thread');
    await tool.handler(client, { thread_id: 'th1' }, userId);
    expect(client.stopFollowingThread).toHaveBeenCalledWith(userId, 'th1');
  });

  it('mark_thread_read calls updateThreadRead with timestamp', async () => {
    const tool = findTool(threadTools, 'mark_thread_read');
    await tool.handler(client, { team_id: 't1', thread_id: 'th1', timestamp: 1700000000000 }, userId);
    expect(client.updateThreadRead).toHaveBeenCalledWith(userId, 't1', 'th1', 1700000000000);
  });

  it('mark_thread_read defaults timestamp to now', async () => {
    const tool = findTool(threadTools, 'mark_thread_read');
    const before = Date.now();
    await tool.handler(client, { team_id: 't1', thread_id: 'th1' }, userId);
    const after = Date.now();
    const calledTs = (client.updateThreadRead as ReturnType<typeof vi.fn>).mock.calls[0][3];
    expect(calledTs).toBeGreaterThanOrEqual(before);
    expect(calledTs).toBeLessThanOrEqual(after);
  });
});

describe('channelTools handlers', () => {
  let client: TimeClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('list_channels calls getChannelsForUser', async () => {
    const tool = findTool(channelTools, 'list_channels');
    await tool.handler(client, { team_id: 't1' }, userId);
    expect(client.getChannelsForUser).toHaveBeenCalledWith(userId, 't1');
  });

  it('get_channel calls getChannel', async () => {
    const tool = findTool(channelTools, 'get_channel');
    await tool.handler(client, { channel_id: 'ch1' });
    expect(client.getChannel).toHaveBeenCalledWith('ch1');
  });

  it('search_channels calls searchChannels', async () => {
    const tool = findTool(channelTools, 'search_channels');
    await tool.handler(client, { team_id: 't1', term: 'dev' });
    expect(client.searchChannels).toHaveBeenCalledWith('t1', 'dev');
  });

  it('get_channel_unread calls getChannelUnread', async () => {
    const tool = findTool(channelTools, 'get_channel_unread');
    await tool.handler(client, { channel_id: 'ch1' }, userId);
    expect(client.getChannelUnread).toHaveBeenCalledWith(userId, 'ch1');
  });

  it('publishes the renamed tool with a host-friendly root schema', () => {
    const tool = findTool(channelTools, 'mark_channels_read');

    expect(channelTools.map((candidate) => candidate.name)).toContain('mark_channels_read');
    expect(channelTools.map((candidate) => candidate.name)).not.toContain('time_mark_channels_read');
    expect(tool.description).toContain('cannot be undone');
    expect(tool.description).toMatch(/public.*private.*DM.*group/i);
    expect(tool.description).toMatch(/followed threads.*excluded/i);
    expect(tool.description).toContain('mark_thread_read');

    expect(tool.inputSchema).toEqual({
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['all', 'selected'],
        },
        channel_ids: {
          type: 'array',
          minItems: 1,
          maxItems: 100,
          items: { type: 'string', minLength: 1, maxLength: 128 },
        },
      },
      required: ['mode'],
      additionalProperties: false,
    });
  });

  it('selected mode trims, deduplicates, preserves order, and sends one request per channel', async () => {
    const tool = findTool(channelTools, 'mark_channels_read');
    vi.mocked(client.markChannelsRead).mockResolvedValue({
      successes: ['ch1', 'ch2', 'ch3'],
      failures: [],
    });

    const result = await tool.handler(client, {
      mode: 'selected',
      channel_ids: [' ch1 ', 'ch2', 'ch1', '  ch2  ', 'ch3'],
    }, userId);

    expect(client.getAllChannelsForUser).not.toHaveBeenCalled();
    expect(client.markChannelsRead).toHaveBeenCalledTimes(1);
    expect(client.markChannelsRead).toHaveBeenCalledWith(userId, ['ch1', 'ch2', 'ch3']);
    expect(client.getUserThreads).not.toHaveBeenCalled();
    expect(client.updateThreadRead).not.toHaveBeenCalled();
    expect(result.content[0].text).toBe('Marked 3 channel(s) as read.');
  });

  it('all mode discovers O, P, D, and G channels, deduplicates, and sends one request per channel', async () => {
    const tool = findTool(channelTools, 'mark_channels_read');
    const channel = {
      id: 'base',
      create_at: 0,
      update_at: 0,
      delete_at: 0,
      team_id: '',
      type: 'O',
      display_name: '',
      name: '',
      header: '',
      purpose: '',
      last_post_at: 0,
      total_msg_count: 0,
      extra_update_at: 0,
      creator_id: '',
      scheme_id: '',
      group_constrained: false,
      shared: false,
    } satisfies Channel;
    vi.mocked(client.getAllChannelsForUser).mockResolvedValue([
      { ...channel, id: 'public', type: 'O' },
      { ...channel, id: 'private', type: 'P' },
      { ...channel, id: 'direct', type: 'D' },
      { ...channel, id: 'group', type: 'G' },
      { ...channel, id: 'private', type: 'P' },
    ]);
    vi.mocked(client.markChannelsRead).mockResolvedValue({
      successes: ['public', 'private', 'direct'],
      failures: [{ channelId: 'group', message: 'service unavailable', statusCode: 503 }],
    });

    const result = await tool.handler(client, { mode: 'all' }, userId);

    expect(client.getAllChannelsForUser).toHaveBeenCalledTimes(1);
    expect(client.getAllChannelsForUser).toHaveBeenCalledWith(userId);
    expect(client.getChannelsForUser).not.toHaveBeenCalled();
    expect(client.getTeamsForUser).not.toHaveBeenCalled();
    expect(client.markChannelsRead).toHaveBeenCalledTimes(1);
    expect(client.markChannelsRead).toHaveBeenCalledWith(
      userId,
      ['public', 'private', 'direct', 'group']
    );
    expect(client.getUserThreads).not.toHaveBeenCalled();
    expect(client.getThreadsStats).not.toHaveBeenCalled();
    expect(client.getUserThread).not.toHaveBeenCalled();
    expect(client.startFollowingThread).not.toHaveBeenCalled();
    expect(client.stopFollowingThread).not.toHaveBeenCalled();
    expect(client.updateThreadRead).not.toHaveBeenCalled();
    expect(result.content[0].text).toBe(
      'Marked 3 of 4 channel(s) as read.\nFailed channels:\n- group: service unavailable (status 503)'
    );
    expect(result).not.toHaveProperty('isError');
  });

  it('reports successful channels and every failed channel for a partial result', async () => {
    const tool = findTool(channelTools, 'mark_channels_read');
    vi.mocked(client.markChannelsRead).mockResolvedValue({
      successes: ['ch1', 'ch3'],
      failures: [
        { channelId: 'ch2', message: 'forbidden', statusCode: 403 },
        { channelId: 'ch4', message: 'network timeout' },
      ],
    });

    const result = await tool.handler(client, {
      mode: 'selected',
      channel_ids: ['ch1', 'ch2', 'ch3', 'ch4'],
    }, userId);

    expect(result.content[0].text).toBe(
      'Marked 2 of 4 channel(s) as read.\nFailed channels:\n- ch2: forbidden (status 403)\n- ch4: network timeout'
    );
    expect(result).not.toHaveProperty('isError');
  });

  it('reports every channel failure when no channel was marked read', async () => {
    const tool = findTool(channelTools, 'mark_channels_read');
    vi.mocked(client.markChannelsRead).mockResolvedValue({
      successes: [],
      failures: [
        { channelId: 'ch1', message: 'forbidden', statusCode: 403 },
        { channelId: 'ch2', message: 'request timed out' },
      ],
    });

    const result = await tool.handler(client, {
      mode: 'selected',
      channel_ids: ['ch1', 'ch2'],
    }, userId);

    expect(result.content[0].text).toBe(
      'Failed to mark 2 channel(s) as read.\nFailed channels:\n- ch1: forbidden (status 403)\n- ch2: request timed out'
    );
    expect(result).not.toHaveProperty('isError');
  });

  it('all mode with no channels returns a no-op without channel requests', async () => {
    const tool = findTool(channelTools, 'mark_channels_read');

    const result = await tool.handler(client, { mode: 'all' }, userId);

    expect(client.getAllChannelsForUser).toHaveBeenCalledTimes(1);
    expect(client.markChannelsRead).not.toHaveBeenCalled();
    expect(result.content[0].text).toBe('No channels available to mark as read.');
  });

  it('propagates all-mode discovery failures without mutation or fallback calls', async () => {
    const tool = findTool(channelTools, 'mark_channels_read');
    const discoveryError = new Error('discovery failed');
    vi.mocked(client.getAllChannelsForUser).mockRejectedValue(discoveryError);

    await expect(tool.handler(client, { mode: 'all' }, userId)).rejects.toBe(discoveryError);

    expect(client.getAllChannelsForUser).toHaveBeenCalledTimes(1);
    expect(client.markChannelsRead).not.toHaveBeenCalled();
    expect(client.getChannelsForUser).not.toHaveBeenCalled();
    expect(client.getTeamsForUser).not.toHaveBeenCalled();
  });

  it('propagates channel-read failures without discovery or fallback calls', async () => {
    const tool = findTool(channelTools, 'mark_channels_read');
    const readError = new Error('channel read failed');
    vi.mocked(client.markChannelsRead).mockRejectedValue(readError);

    await expect(tool.handler(client, {
      mode: 'selected',
      channel_ids: ['ch1'],
    }, userId)).rejects.toBe(readError);

    expect(client.markChannelsRead).toHaveBeenCalledTimes(1);
    expect(client.getAllChannelsForUser).not.toHaveBeenCalled();
    expect(client.getChannelsForUser).not.toHaveBeenCalled();
    expect(client.getTeamsForUser).not.toHaveBeenCalled();
  });

  it.each([
    ['101 channel IDs', Array.from({ length: 101 }, (_, index) => `channel-${index}`)],
    ['a 129-character channel ID', ['x'.repeat(129)]],
  ])('rejects selected mode with %s before any downstream call', async (_label, channelIds) => {
    const tool = findTool(channelTools, 'mark_channels_read');

    await expect(tool.handler(client, {
      mode: 'selected',
      channel_ids: channelIds,
    }, userId)).rejects.toThrow();

    expect(client.markChannelsRead).not.toHaveBeenCalled();
    expect(client.getAllChannelsForUser).not.toHaveBeenCalled();
    expect(client.getUserThreads).not.toHaveBeenCalled();
    expect(client.getThreadsStats).not.toHaveBeenCalled();
    expect(client.getUserThread).not.toHaveBeenCalled();
    expect(client.startFollowingThread).not.toHaveBeenCalled();
    expect(client.stopFollowingThread).not.toHaveBeenCalled();
    expect(client.updateThreadRead).not.toHaveBeenCalled();
  });

  it.each([
    ['missing mode', {}],
    ['invalid mode', { mode: 'invalid' }],
    ['channel_ids in all mode', { mode: 'all', channel_ids: ['ch1'] }],
    ['missing channel_ids in selected mode', { mode: 'selected' }],
    ['empty channel_ids in selected mode', { mode: 'selected', channel_ids: [] }],
    ['whitespace-only channel ID', { mode: 'selected', channel_ids: ['   '] }],
    ['unexpected property', { mode: 'selected', channel_ids: ['ch1'], unexpected: true }],
  ])('rejects %s before calling the client', async (_label, input) => {
    const tool = findTool(channelTools, 'mark_channels_read');

    await expect(tool.handler(client, input, userId)).rejects.toThrow();

    expect(client.getAllChannelsForUser).not.toHaveBeenCalled();
    expect(client.markChannelsRead).not.toHaveBeenCalled();
  });
});

describe('teamTools handlers', () => {
  let client: TimeClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('list_teams calls getTeamsForUser', async () => {
    const tool = findTool(teamTools, 'list_teams');
    await tool.handler(client, {}, userId);
    expect(client.getTeamsForUser).toHaveBeenCalledWith(userId);
  });

  it('get_team calls getTeam', async () => {
    const tool = findTool(teamTools, 'get_team');
    await tool.handler(client, { team_id: 't1' });
    expect(client.getTeam).toHaveBeenCalledWith('t1');
  });

  it('get_teams_unread calls getTeamsUnread', async () => {
    const tool = findTool(teamTools, 'get_teams_unread');
    await tool.handler(client, {}, userId);
    expect(client.getTeamsUnread).toHaveBeenCalledWith(userId);
  });

  it('get_team_unread calls getTeamUnread', async () => {
    const tool = findTool(teamTools, 'get_team_unread');
    await tool.handler(client, { team_id: 't1' }, userId);
    expect(client.getTeamUnread).toHaveBeenCalledWith(userId, 't1');
  });
});

describe('userTools handlers', () => {
  let client: TimeClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('get_me calls getMe', async () => {
    const tool = findTool(userTools, 'get_me');
    await tool.handler(client, {});
    expect(client.getMe).toHaveBeenCalled();
  });

  it('get_user calls getUser', async () => {
    const tool = findTool(userTools, 'get_user');
    await tool.handler(client, { user_id: 'u1' });
    expect(client.getUser).toHaveBeenCalledWith('u1');
  });

  it('search_users calls searchUsers', async () => {
    const tool = findTool(userTools, 'search_users');
    await tool.handler(client, { term: 'john' });
    expect(client.searchUsers).toHaveBeenCalledWith('john');
  });
});
