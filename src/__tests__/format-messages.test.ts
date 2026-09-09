import { describe, it, expect } from 'vitest';
import { formatPostList, formatSearchResult } from '../tools/messages.js';
import type { Post, PostList } from '../types/time-api.js';

const makePost = (overrides: Partial<Post> & { id: string; message: string }): Post => ({
  create_at: 1000,
  update_at: 0,
  delete_at: 0,
  edit_at: 0,
  user_id: 'u1',
  channel_id: 'ch1',
  root_id: '',
  parent_id: '',
  original_id: '',
  type: '',
  props: {},
  hashtags: '',
  pending_post_id: '',
  metadata: {},
  ...overrides,
});

const makePostList = (posts: Post[], order?: string[]): PostList => ({
  order: order ?? posts.map((p) => p.id),
  posts: Object.fromEntries(posts.map((p) => [p.id, p])),
  next_post_id: '',
  prev_post_id: '',
});

describe('formatPostList', () => {
  it('returns "No messages found." for empty list', () => {
    const postList = makePostList([]);
    expect(formatPostList(postList)).toBe('No messages found.');
  });

  it('formats a single post', () => {
    const post = makePost({ id: 'p1', message: 'Hello', user_id: 'u1' });
    const postList = makePostList([post]);
    const result = formatPostList(postList, new Map([['u1', 'alice']]));
    expect(result).toContain('Hello');
    expect(result).toContain('Post ID: p1');
    expect(result).toContain('Author: @alice');
    expect(result).toContain('---');
  });

  it('formats multiple posts oldest first', () => {
    const p1 = makePost({ id: 'p1', message: 'First', create_at: 1000 });
    const p2 = makePost({ id: 'p2', message: 'Second', create_at: 2000 });
    const postList = makePostList([p1, p2], ['p2', 'p1']);
    const result = formatPostList(postList);
    const firstIdx = result.indexOf('First');
    const secondIdx = result.indexOf('Second');
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it('marks replies with "(reply)"', () => {
    const post = makePost({ id: 'p2', message: 'Reply', root_id: 'p1' });
    const postList = makePostList([post]);
    const result = formatPostList(postList, new Map([['u1', 'alice']]));
    expect(result).toContain('(reply)');
    expect(result).toContain('Root ID: p1');
  });

  it('does not mark root posts as replies', () => {
    const post = makePost({ id: 'p1', message: 'Root', root_id: '' });
    const postList = makePostList([post]);
    const result = formatPostList(postList);
    expect(result).not.toContain('(reply)');
    expect(result).not.toContain('Root ID:');
  });

  it('uses the raw user ID when an author is unresolved', () => {
    const post = makePost({ id: 'p1', message: 'Hello', user_id: 'missing-user' });

    const result = formatPostList(makePostList([post]), new Map());

    expect(result).toContain('Author: @missing-user');
  });

  it('deduplicates posts with same ID in order array', () => {
    const post = makePost({ id: 'p1', message: 'Root message' });
    const reply = makePost({ id: 'p2', message: 'Reply', root_id: 'p1' });
    const postList = makePostList(
      [post, reply],
      ['p1', 'p2', 'p1']
    );
    const result = formatPostList(postList);
    const count = (result.match(/Root message/g) || []).length;
    expect(count).toBe(1);
  });

  it('skips IDs in order that are missing from posts dict', () => {
    const post = makePost({ id: 'p1', message: 'Exists' });
    const postList: PostList = {
      order: ['p1', 'missing'],
      posts: { p1: post },
      next_post_id: '',
      prev_post_id: '',
    };
    const result = formatPostList(postList);
    expect(result).toContain('Exists');
    expect(result).not.toContain('undefined');
  });
});

describe('formatSearchResult', () => {
  it('returns "No messages found" for empty result', () => {
    const result = formatSearchResult({ order: [], posts: {} });
    expect(result).toBe('No messages found matching your search.');
  });

  it('formats search results with count', () => {
    const post = makePost({ id: 'p1', message: 'Found this', channel_id: 'ch1', user_id: 'u1' });
    const result = formatSearchResult({
      order: ['p1'],
      posts: { p1: post },
    }, new Map([['u1', 'alice']]));
    expect(result).toContain('Found 1 message(s)');
    expect(result).toContain('Found this');
    expect(result).toContain('ch1');
    expect(result).toContain('Post ID: p1');
    expect(result).toContain('Author: @alice');
  });

  it('uses the raw user ID for an unresolved search author', () => {
    const post = makePost({ id: 'p1', message: 'Found this', user_id: 'missing-user' });

    const result = formatSearchResult({ order: ['p1'], posts: { p1: post } }, new Map());

    expect(result).toContain('Author: @missing-user');
  });

  it('formats multiple search results', () => {
    const p1 = makePost({ id: 'p1', message: 'Older', channel_id: 'ch1', create_at: 1000 });
    const p2 = makePost({ id: 'p2', message: 'Newer', channel_id: 'ch2', create_at: 2000 });
    const result = formatSearchResult({
      order: ['p2', 'p1'],
      posts: { p1, p2 },
    });
    expect(result).toContain('Found 2 message(s)');
    expect(result.indexOf('Older')).toBeLessThan(result.indexOf('Newer'));
  });
});
