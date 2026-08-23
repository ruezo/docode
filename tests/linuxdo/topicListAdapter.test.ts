// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/" }

import { afterEach, describe, expect, it } from 'vitest';

import { extractTopicList } from '../../src/linuxdo/topicListAdapter';
import { recognizeLinuxDoRoute } from '../../src/linuxdo/routes';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

describe('extractTopicList', () => {
  it('extracts topic identity, metadata, exact counts, activity, and observed stable states', () => {
    setDocumentUrl('/hot');
    document.body.innerHTML = topicTable(`
      <tr data-topic-id="42" class="topic-list-item pinned has-excerpt">
        <td class="main-link">
          <h2><a class="title" href="/t/synthetic-topic/42">Synthetic topic</a></h2>
          <a href="/c/develop/4">Develop</a>
          <a href="/tag/testing/7">Testing</a>
        </td>
        <td class="posters">
          <a data-user-card="first-user" href="/u/first-user"></a>
          <a class="latest" data-user-card="last-user" href="/u/last-user"></a>
        </td>
        <td class="posts"><a href="/t/synthetic-topic/42/1" aria-label="1,234 replies"><span>1.2k</span></a></td>
        <td class="views"><span title="Viewed 5,678 times">5.7k</span></td>
        <td class="activity"><a href="/t/synthetic-topic/42/19"><span data-time="1700000000000">2 hours</span></a></td>
      </tr>
    `);

    const result = extractTopicList(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toEqual({
      issues: [],
      state: 'ready',
      topics: [
        {
          activity: {
            label: '2 hours',
            lastPostNumber: 19,
            timestamp: '2023-11-14T22:13:20.000Z',
            url: 'https://linux.do/t/synthetic-topic/42/19',
          },
          category: {
            id: 4,
            name: 'Develop',
            slug: 'develop',
            url: 'https://linux.do/c/develop/4',
          },
          completeness: 'complete',
          hasExcerpt: true,
          id: 42,
          participants: [
            {
              isLatestPoster: false,
              isOriginalPoster: true,
              url: 'https://linux.do/u/first-user',
              username: 'first-user',
            },
            {
              isLatestPoster: true,
              isOriginalPoster: false,
              url: 'https://linux.do/u/last-user',
              username: 'last-user',
            },
          ],
          pinned: true,
          readState: 'unknown',
          replyCount: { precision: 'exact', value: 1234 },
          tags: [
            {
              id: 7,
              name: 'Testing',
              slug: 'testing',
              url: 'https://linux.do/tag/testing/7',
            },
          ],
          title: 'Synthetic topic',
          url: 'https://linux.do/t/synthetic-topic/42',
          viewCount: { precision: 'exact', value: 5678 },
        },
      ],
    });
  });

  it('returns a partial topic with bounded issues when optional cells are absent', () => {
    document.body.innerHTML = topicTable(`
      <tr data-topic-id="43" class="topic-list-item">
        <td><a href="/t/partial-topic/43">Partial topic</a></td>
      </tr>
    `);

    const result = extractTopicList(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      issues: [
        { code: 'missing-participants', rowIndex: 0 },
        { code: 'missing-reply-count', rowIndex: 0 },
        { code: 'missing-view-count', rowIndex: 0 },
        { code: 'missing-activity', rowIndex: 0 },
      ],
      state: 'ready',
      topics: [{ completeness: 'partial', id: 43, title: 'Partial topic' }],
    });
  });

  it('distinguishes loading, empty, unsupported, missing-table, and unreadable-row states', () => {
    document.body.innerHTML = '<main aria-busy="true"></main>';
    expect(extractTopicList(document, recognizeLinuxDoRoute(window.location.href))).toEqual({
      issues: [],
      state: 'loading',
      topics: [],
    });

    document.body.innerHTML = topicTable('');
    expect(extractTopicList(document, recognizeLinuxDoRoute(window.location.href))).toEqual({
      issues: [],
      state: 'empty',
      topics: [],
    });

    expect(extractTopicList(document, recognizeLinuxDoRoute('https://linux.do/u/user'))).toEqual({
      code: 'unsupported-route',
      issues: [],
      state: 'error',
      topics: [],
    });

    document.body.innerHTML = '<main>Changed markup</main>';
    expect(extractTopicList(document, recognizeLinuxDoRoute(window.location.href))).toEqual({
      code: 'topic-list-not-found',
      issues: [],
      state: 'error',
      topics: [],
    });

    document.body.innerHTML = `<main>Changed markup</main>
      <div data-docode-workbench-root><div role="progressbar"></div></div>`;
    expect(extractTopicList(document, recognizeLinuxDoRoute(window.location.href))).toEqual({
      code: 'topic-list-not-found',
      issues: [],
      state: 'error',
      topics: [],
    });

    document.body.innerHTML = topicTable('<tr><td>No topic identity</td></tr>');
    expect(extractTopicList(document, recognizeLinuxDoRoute(window.location.href))).toEqual({
      code: 'topic-rows-unreadable',
      issues: [{ code: 'missing-topic-identity', rowIndex: 0 }],
      state: 'error',
      topics: [],
    });
  });

  it('rejects conflicting and duplicate identities without leaking row content into diagnostics', () => {
    document.body.innerHTML = topicTable(`
      <tr data-topic-id="44"><td><a href="/t/conflict/45">Conflict</a></td></tr>
      <tr data-topic-id="46"><td><a href="/t/first/46">First</a></td></tr>
      <tr data-topic-id="46"><td><a href="/t/duplicate/46">Duplicate</a></td></tr>
      <tr data-topic-id="47"><td><a href="https://example.com/t/foreign/47">Foreign</a></td></tr>
    `);

    const result = extractTopicList(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      issues: [
        { code: 'missing-topic-identity', rowIndex: 0 },
        { code: 'missing-participants', rowIndex: 1 },
        { code: 'missing-reply-count', rowIndex: 1 },
        { code: 'missing-view-count', rowIndex: 1 },
        { code: 'missing-activity', rowIndex: 1 },
        { code: 'missing-participants', rowIndex: 2 },
        { code: 'missing-reply-count', rowIndex: 2 },
        { code: 'missing-view-count', rowIndex: 2 },
        { code: 'missing-activity', rowIndex: 2 },
        { code: 'duplicate-topic', rowIndex: 2 },
        { code: 'missing-topic-identity', rowIndex: 3 },
      ],
      state: 'ready',
      topics: [{ id: 46, title: 'First' }],
    });
    expect(JSON.stringify(result.issues)).not.toContain('Conflict');
    expect(JSON.stringify(result.issues)).not.toContain('Foreign');
  });

  it('falls back to compact visible counts and preserves their precision', () => {
    document.body.innerHTML = topicTable(`
      <tr data-topic-id="48">
        <td><a href="/t/counts/48">Counts</a></td>
        <td class="posters"><a href="/u/user"></a></td>
        <td class="posts">1.2k</td>
        <td class="views">2.5m</td>
        <td class="activity"><a href="/t/counts/48/2">now</a></td>
      </tr>
    `);

    const result = extractTopicList(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      state: 'ready',
      topics: [
        {
          replyCount: { precision: 'compact', value: 1200 },
          viewCount: { precision: 'compact', value: 2_500_000 },
        },
      ],
    });
  });

  it('preserves only verified Discourse read-state signals', () => {
    document.body.innerHTML = topicTable(`
      <tr data-topic-id="50" class="visited"><td><a href="/t/read/50">Read</a></td></tr>
      <tr data-topic-id="51" class="unread-posts"><td><a href="/t/unread/51">Unread</a></td></tr>
      <tr data-topic-id="52" class="unseen-topic"><td><a href="/t/new/52">New</a></td></tr>
      <tr data-topic-id="53"><td><a href="/t/unknown/53">Unknown</a></td></tr>
      <tr data-topic-id="54"><td><a href="/t/badge-unread/54">Badge unread</a><a class="badge-notification unread-posts" href="/t/badge-unread/54/2">1</a></td></tr>
    `);

    const result = extractTopicList(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      state: 'ready',
      topics: [
        { id: 50, readState: 'read' },
        { id: 51, readState: 'unread' },
        { id: 52, readState: 'new' },
        { id: 53, readState: 'unknown' },
        { id: 54, readState: 'unread' },
      ],
    });
  });

  it('accepts the semantic unread title link that targets the first unread post', () => {
    setDocumentUrl('/unread');
    document.body.innerHTML = topicTable(`
      <tr data-topic-id="55" class="topic-list-item unread-posts">
        <td class="main-link">
          <a class="title raw-link raw-topic-link" href="/t/unread-topic/55/8">Unread topic</a>
          <a class="badge-notification unread-posts" href="/t/unread-topic/55/8">3</a>
        </td>
        <td class="posters"><a href="/u/user"></a></td>
        <td class="posts">7</td>
        <td class="views">120</td>
        <td class="activity"><a href="/t/unread-topic/55/10">now</a></td>
      </tr>
    `);

    const result = extractTopicList(document, recognizeLinuxDoRoute(window.location.href));

    expect(result).toMatchObject({
      issues: [],
      state: 'ready',
      topics: [
        {
          id: 55,
          readState: 'unread',
          title: 'Unread topic',
          url: 'https://linux.do/t/unread-topic/55/8',
        },
      ],
    });
  });

  it('does not mistake a post-count or activity deep link for a missing title', () => {
    document.body.innerHTML = topicTable(`
      <tr data-topic-id="56">
        <td class="posts"><a href="/t/missing-title/56/1">4</a></td>
        <td class="activity"><a href="/t/missing-title/56/5">now</a></td>
      </tr>
    `);

    expect(extractTopicList(document, recognizeLinuxDoRoute(window.location.href))).toMatchObject({
      code: 'topic-rows-unreadable',
      issues: [{ code: 'missing-topic-identity', rowIndex: 0 }],
      state: 'error',
    });
  });
});

function topicTable(rows: string): string {
  return `<main><table class="topic-list"><tbody>${rows}</tbody></table></main>`;
}

function setDocumentUrl(pathname: string): void {
  window.history.replaceState({}, '', pathname);
}
