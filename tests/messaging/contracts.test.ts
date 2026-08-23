import { describe, expect, it } from 'vitest';

import {
  CONTENT_MESSAGE_VERSION,
  getStatusRequest,
  isContentRequest,
  isContentResponse,
  restoreOriginalRequest,
  setEnabledRequest,
} from '../../src/messaging/contracts';

describe('content message contracts', () => {
  it('accepts only the finite request allow-list', () => {
    expect(isContentRequest(getStatusRequest())).toBe(true);
    expect(isContentRequest(setEnabledRequest(false))).toBe(true);
    expect(isContentRequest(restoreOriginalRequest())).toBe(true);
    expect(isContentRequest({ type: 'docode:set-enabled', version: 1 })).toBe(false);
    expect(
      isContentRequest({
        extra: true,
        type: 'docode:get-status',
        version: CONTENT_MESSAGE_VERSION,
      }),
    ).toBe(false);
    expect(isContentRequest({ type: 'execute', version: CONTENT_MESSAGE_VERSION })).toBe(false);
  });

  it('validates success and bounded error responses', () => {
    expect(
      isContentResponse({
        ok: true,
        status: {
          capabilities: {
            availableBookmarkCount: 0,
            availableCopyLinkCount: 1,
            availableLikeCount: 0,
            composerState: 'authentication-required',
            diagnosticCodes: ['authentication-required'],
            generation: 2,
            postCount: 1,
            replyState: 'authentication-required',
            state: 'ready',
            userState: 'logged-out',
          },
          enabled: true,
          mounted: true,
          route: { family: 'latest', generation: 0 },
          storageRecovered: false,
          supported: true,
          topic: {
            containsRequestedPost: true,
            errorCode: null,
            firstPostNumber: 1,
            hasMorePosts: true,
            issueCodes: [],
            lastPostNumber: 5,
            partialPostCount: 0,
            postCount: 5,
            requestedPostNumber: 5,
            state: 'ready',
          },
          topicList: {
            errorCode: null,
            issueCodes: [],
            partialTopicCount: 0,
            state: 'empty',
            topicCount: 0,
          },
        },
      }),
    ).toBe(true);
    expect(
      isContentResponse({
        ok: true,
        status: {
          capabilities: null,
          enabled: true,
          mounted: true,
          route: { family: 'topic', generation: 1 },
          storageRecovered: false,
          supported: true,
          topic: { html: '<script>unsafe</script>', state: 'ready' },
          topicList: null,
        },
      }),
    ).toBe(false);
    expect(isContentResponse({ error: { code: 'storage-error' }, ok: false })).toBe(true);
    expect(isContentResponse({ error: { code: 'arbitrary-error' }, ok: false })).toBe(false);
    expect(
      isContentResponse({
        error: { code: 'storage-error', details: 'unexpected' },
        ok: false,
      }),
    ).toBe(false);
    expect(
      isContentResponse({
        extra: true,
        ok: true,
        status: {
          capabilities: null,
          enabled: true,
          mounted: true,
          route: null,
          storageRecovered: false,
          supported: true,
          topic: null,
          topicList: null,
        },
      }),
    ).toBe(false);
  });
});
