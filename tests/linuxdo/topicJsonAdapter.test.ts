import { describe, expect, it } from 'vitest';

import { extractTopicJsonPage, extractTopicJsonPosts } from '../../src/linuxdo/topicJsonAdapter';

describe('topicJsonAdapter', () => {
  it('reads reaction counts from the reactions plugin fields', () => {
    const posts = extractTopicJsonPosts(
      {
        post_stream: {
          posts: [
            post(100, 1, { reaction_users_count: 12 }),
            post(101, 2, { reactions: [{ count: 3 }, { count: 4 }, { count: 'x' }] }),
            post(102, 3, { reactions: 'invalid' }),
          ],
          stream: [100, 101, 102],
        },
      },
      42,
    );

    expect(posts?.map(({ reactionCount }) => reactionCount)).toEqual([12, 7, 0]);
  });

  it('validates the topic stream and normalizes same-topic posts', () => {
    const page = extractTopicJsonPage(
      {
        id: 42,
        title: 'Synthetic topic',
        post_stream: {
          posts: [post(100, 1), post(101, 2, { name: 'Alice Example', user_id: null })],
          stream: [100, 101, 102],
        },
      },
      42,
    );

    expect(page?.postIds).toEqual([100, 101, 102]);
    expect(page?.id).toBe(42);
    expect(page?.title).toBe('Synthetic topic');
    expect(page?.posts).toEqual([
      {
        avatarTemplate: '/user_avatar/linux.do/user-1/{size}/1.png',
        cooked: '<p>Post 1</p>',
        createdAt: '2026-08-20T12:00:00.000Z',
        displayName: 'user-1',
        id: 100,
        number: 1,
        reactionCount: 0,
        replyToPostNumber: null,
        topicId: 42,
        userId: 1,
        username: 'user-1',
      },
      {
        avatarTemplate: '/user_avatar/linux.do/user-2/{size}/1.png',
        cooked: '<p>Post 2</p>',
        createdAt: '2026-08-20T12:00:00.000Z',
        displayName: 'Alice Example',
        id: 101,
        number: 2,
        reactionCount: 0,
        replyToPostNumber: null,
        topicId: 42,
        userId: null,
        username: 'user-2',
      },
    ]);
  });

  it('rejects duplicate stream ids, foreign-topic posts, and malformed content', () => {
    expect(
      extractTopicJsonPage({ post_stream: { posts: [post(100, 1)], stream: [100, 100] } }, 42),
    ).toBeNull();
    expect(
      extractTopicJsonPosts({ post_stream: { posts: [{ ...post(100, 1), topic_id: 99 }] } }, 42),
    ).toBeNull();
    expect(
      extractTopicJsonPosts({ post_stream: { posts: [{ ...post(100, 1), cooked: null }] } }, 42),
    ).toBeNull();
  });

  it('accepts only a real earlier reply target floor', () => {
    expect(
      extractTopicJsonPosts(
        { post_stream: { posts: [post(101, 2, { reply_to_post_number: 1 })] } },
        42,
      )?.[0]?.replyToPostNumber,
    ).toBe(1);
    expect(
      extractTopicJsonPosts(
        { post_stream: { posts: [post(101, 2, { reply_to_post_number: '1' })] } },
        42,
      ),
    ).toBeNull();
    expect(
      extractTopicJsonPosts(
        { post_stream: { posts: [post(101, 2, { reply_to_post_number: 2 })] } },
        42,
      ),
    ).toBeNull();
  });
});

function post(id: number, postNumber: number, overrides: Record<string, unknown> = {}) {
  return {
    avatar_template: `/user_avatar/linux.do/user-${String(postNumber)}/{size}/1.png`,
    cooked: `<p>Post ${String(postNumber)}</p>`,
    created_at: '2026-08-20T12:00:00.000Z',
    id,
    name: '',
    post_number: postNumber,
    topic_id: 42,
    user_id: postNumber,
    username: `user-${String(postNumber)}`,
    ...overrides,
  };
}
