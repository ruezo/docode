import type { CapabilityStatusSummary } from '../linuxdo/capabilities';
import type { LinuxDoRouteFamily } from '../linuxdo/routes';
import type { TopicListStatusSummary } from '../linuxdo/topicListAdapter';
import type { TopicStatusSummary } from '../linuxdo/topicAdapter';

export const CONTENT_MESSAGE_VERSION = 1 as const;

export interface ContentRuntimeStatus {
  readonly capabilities: CapabilityStatusSummary | null;
  readonly enabled: boolean;
  readonly mounted: boolean;
  readonly route: {
    readonly family: LinuxDoRouteFamily;
    readonly generation: number;
  } | null;
  readonly storageRecovered: boolean;
  readonly supported: true;
  readonly topic: TopicStatusSummary | null;
  readonly topicList: TopicListStatusSummary | null;
}

export type ContentRequest =
  | { readonly type: 'docode:get-status'; readonly version: typeof CONTENT_MESSAGE_VERSION }
  | {
      readonly enabled: boolean;
      readonly type: 'docode:set-enabled';
      readonly version: typeof CONTENT_MESSAGE_VERSION;
    }
  | { readonly type: 'docode:restore-original'; readonly version: typeof CONTENT_MESSAGE_VERSION };

export type ContentResponse =
  | { readonly ok: true; readonly status: ContentRuntimeStatus }
  | {
      readonly error: {
        readonly code: 'invalid-request' | 'runtime-conflict' | 'storage-error';
      };
      readonly ok: false;
    };

export function getStatusRequest(): ContentRequest {
  return { type: 'docode:get-status', version: CONTENT_MESSAGE_VERSION };
}

export function setEnabledRequest(enabled: boolean): ContentRequest {
  return { enabled, type: 'docode:set-enabled', version: CONTENT_MESSAGE_VERSION };
}

export function restoreOriginalRequest(): ContentRequest {
  return { type: 'docode:restore-original', version: CONTENT_MESSAGE_VERSION };
}

export function isContentRequest(value: unknown): value is ContentRequest {
  if (!isRecord(value) || value.version !== CONTENT_MESSAGE_VERSION) return false;

  if (value.type === 'docode:get-status' || value.type === 'docode:restore-original') {
    return Object.keys(value).length === 2;
  }

  return (
    value.type === 'docode:set-enabled' &&
    typeof value.enabled === 'boolean' &&
    Object.keys(value).length === 3
  );
}

export function isContentResponse(value: unknown): value is ContentResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false;

  if (value.ok) {
    return Object.keys(value).length === 2 && isContentRuntimeStatus(value.status);
  }
  if (
    Object.keys(value).length !== 2 ||
    !isRecord(value.error) ||
    Object.keys(value.error).length !== 1 ||
    typeof value.error.code !== 'string'
  ) {
    return false;
  }
  return ['invalid-request', 'runtime-conflict', 'storage-error'].includes(value.error.code);
}

function isContentRuntimeStatus(value: unknown): value is ContentRuntimeStatus {
  return (
    isRecord(value) &&
    Object.keys(value).length === 8 &&
    value.supported === true &&
    isContentCapabilityStatus(value.capabilities) &&
    typeof value.enabled === 'boolean' &&
    typeof value.mounted === 'boolean' &&
    isContentRouteStatus(value.route) &&
    typeof value.storageRecovered === 'boolean' &&
    isContentTopicStatus(value.topic) &&
    isContentTopicListStatus(value.topicList)
  );
}

function isContentCapabilityStatus(value: unknown): value is ContentRuntimeStatus['capabilities'] {
  if (value === null) return true;
  if (!isRecord(value) || Object.keys(value).length !== 10) return false;
  const validDiagnosticCodes = [
    'authentication-required',
    'composer-not-found',
    'current-user-conflict',
    'current-user-unresolved',
    'native-control-disabled',
    'native-control-not-found',
    'post-identity-missing',
    'unsupported-route',
  ];
  return (
    ['ready', 'unsupported'].includes(String(value.state)) &&
    ['authentication-required', 'closed', 'open', 'unavailable'].includes(
      String(value.composerState),
    ) &&
    ['authentication-required', 'available', 'disabled', 'unavailable'].includes(
      String(value.replyState),
    ) &&
    ['logged-in', 'logged-out', 'unknown'].includes(String(value.userState)) &&
    Array.isArray(value.diagnosticCodes) &&
    value.diagnosticCodes.every(
      (code) => typeof code === 'string' && validDiagnosticCodes.includes(code),
    ) &&
    isNonNegativeInteger(value.availableBookmarkCount) &&
    isNonNegativeInteger(value.availableCopyLinkCount) &&
    isNonNegativeInteger(value.availableLikeCount) &&
    isNonNegativeInteger(value.generation) &&
    isNonNegativeInteger(value.postCount)
  );
}

function isContentTopicStatus(value: unknown): value is ContentRuntimeStatus['topic'] {
  if (value === null) return true;
  if (!isRecord(value) || Object.keys(value).length !== 10) return false;
  const validIssueCodes = [
    'duplicate-post',
    'missing-post-author',
    'missing-post-content',
    'missing-post-identity',
    'missing-post-permalink',
  ];
  const validErrorCodes = [
    'post-stream-not-found',
    'post-stream-unreadable',
    'topic-metadata-not-found',
    'unsupported-route',
  ];
  return (
    ['error', 'loading', 'ready'].includes(String(value.state)) &&
    (value.errorCode === null ||
      (typeof value.errorCode === 'string' && validErrorCodes.includes(value.errorCode))) &&
    Array.isArray(value.issueCodes) &&
    value.issueCodes.every((code) => typeof code === 'string' && validIssueCodes.includes(code)) &&
    typeof value.containsRequestedPost === 'boolean' &&
    isNullablePositiveInteger(value.firstPostNumber) &&
    typeof value.hasMorePosts === 'boolean' &&
    isNullablePositiveInteger(value.lastPostNumber) &&
    isNonNegativeInteger(value.partialPostCount) &&
    isNonNegativeInteger(value.postCount) &&
    isNullablePositiveInteger(value.requestedPostNumber)
  );
}

function isContentTopicListStatus(value: unknown): value is ContentRuntimeStatus['topicList'] {
  if (value === null) return true;
  if (!isRecord(value) || Object.keys(value).length !== 5) return false;
  const validIssueCodes = [
    'duplicate-topic',
    'missing-activity',
    'missing-participants',
    'missing-reply-count',
    'missing-topic-identity',
    'missing-view-count',
  ];
  const validErrorCodes = ['topic-list-not-found', 'topic-rows-unreadable', 'unsupported-route'];
  return (
    ['empty', 'error', 'loading', 'ready'].includes(String(value.state)) &&
    (value.errorCode === null ||
      (typeof value.errorCode === 'string' && validErrorCodes.includes(value.errorCode))) &&
    Array.isArray(value.issueCodes) &&
    value.issueCodes.every((code) => typeof code === 'string' && validIssueCodes.includes(code)) &&
    isNonNegativeInteger(value.partialTopicCount) &&
    isNonNegativeInteger(value.topicCount)
  );
}

function isContentRouteStatus(value: unknown): value is ContentRuntimeStatus['route'] {
  if (value === null) return true;
  if (!isRecord(value) || Object.keys(value).length !== 2) return false;
  return (
    typeof value.generation === 'number' &&
    Number.isSafeInteger(value.generation) &&
    value.generation >= 0 &&
    typeof value.family === 'string' &&
    [
      'category',
      'category-index',
      'hot',
      'latest',
      'new',
      'search',
      'tag',
      'tag-index',
      'top',
      'topic',
      'unread',
      'unsupported',
      'user',
    ].includes(value.family)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null || (isNonNegativeInteger(value) && value > 0);
}
