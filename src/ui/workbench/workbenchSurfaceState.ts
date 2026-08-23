import type { CodiconName } from '../icons/codicon';
import { detectLinuxDoCapabilities, type ComposerCapability } from '../../linuxdo/capabilities';
import { extractTopicList, type TopicListExtraction } from '../../linuxdo/topicListAdapter';
import { extractTopic } from '../../linuxdo/topicAdapter';
import type { NativePostContentResolver, TopicExtraction } from '../../linuxdo/topicAdapter';
import type { LinuxDoRoute } from '../../linuxdo/routes';
import {
  createTopicDetailDocument,
  type TopicDetailDocument,
} from '../../views/topic/topicDetailDocument';
import {
  createTopicListDocument,
  type TopicListDocument,
} from '../../views/topicList/topicListDocument';

export type WorkbenchSurfaceStateKind = 'empty' | 'error' | 'loading' | 'ready' | 'unsupported';

export interface WorkbenchSurfaceState {
  readonly code: string | null;
  readonly description: string;
  readonly icon: CodiconName | null;
  readonly kind: WorkbenchSurfaceStateKind;
  readonly retryLabel: 'Refresh' | 'Retry' | null;
  readonly title: string;
}

export interface WorkbenchViewSnapshot {
  readonly nativeComposer: ComposerCapability | null;
  readonly surfaceState: WorkbenchSurfaceState;
  readonly topicDetailDocument: TopicDetailDocument | null;
  readonly topicListDocument: TopicListDocument | null;
}

export interface WorkbenchViewSnapshotOptions {
  readonly deferTopicListCompatibilityError?: boolean;
  readonly deferTopicCompatibilityError?: boolean;
  readonly resolveNativeContent?: NativePostContentResolver | undefined;
}

const READY_STATE: WorkbenchSurfaceState = {
  code: null,
  description: '',
  icon: null,
  kind: 'ready',
  retryLabel: null,
  title: '',
};

export function createWorkbenchSurfaceState(
  document: Document,
  route: LinuxDoRoute,
): WorkbenchSurfaceState {
  return createWorkbenchViewSnapshot(document, route).surfaceState;
}

export function createWorkbenchViewSnapshot(
  document: Document,
  route: LinuxDoRoute,
  options: WorkbenchViewSnapshotOptions = {},
): WorkbenchViewSnapshot {
  if (route.kind === 'topic-list') {
    const extractedTopicList = extractTopicList(document, route);
    const extraction: TopicListExtraction =
      options.deferTopicListCompatibilityError && extractedTopicList.state === 'error'
        ? { issues: [], state: 'loading', topics: [] }
        : extractedTopicList;
    return {
      nativeComposer: null,
      surfaceState: createTopicListSurfaceState(extraction),
      topicDetailDocument: null,
      topicListDocument: createTopicListDocument(route, extraction),
    };
  }

  if (route.kind === 'topic') {
    const extractedTopic = extractTopic(document, route, {
      resolveNativeContent: options.resolveNativeContent,
    });
    const extraction: TopicExtraction =
      options.deferTopicCompatibilityError && extractedTopic.state === 'error'
        ? { issues: [], posts: [], state: 'loading', topic: null }
        : extractedTopic;
    const capabilities = detectLinuxDoCapabilities(document, route);
    const topicDetailDocument = createTopicDetailDocument(route, extraction, capabilities);
    const nativeComposer = capabilities.state === 'ready' ? capabilities.composer : null;
    switch (extraction.state) {
      case 'ready':
        return snapshot(READY_STATE, topicDetailDocument, nativeComposer);
      case 'loading':
        return snapshot(
          state(
            'loading',
            'topic-loading',
            'Loading topic…',
            'Waiting for Linux DO to finish rendering this topic.',
            'loading',
          ),
          topicDetailDocument,
          nativeComposer,
        );
      case 'error':
        return snapshot(
          state(
            'error',
            extraction.code,
            'Unable to read this topic',
            topicErrorDescription(extraction.code),
            'error',
            'Retry',
          ),
          topicDetailDocument,
          nativeComposer,
        );
    }
  }

  if (route.kind === 'search') return snapshot(READY_STATE);

  if (route.kind === 'unsupported') {
    return snapshot(
      state(
        'unsupported',
        route.reason,
        'Unsupported route',
        'DOCode does not support this Linux DO page. The original site remains available.',
        'warning',
      ),
    );
  }

  return snapshot(
    state(
      'unsupported',
      'view-not-implemented',
      'View not available',
      'This Linux DO view does not have a DOCode renderer yet. The original site remains available.',
      'info',
    ),
  );
}

function createTopicListSurfaceState(extraction: TopicListExtraction): WorkbenchSurfaceState {
  switch (extraction.state) {
    case 'ready':
      return READY_STATE;
    case 'loading':
      return state(
        'loading',
        'topic-list-loading',
        'Loading topics…',
        'Waiting for Linux DO to finish rendering this view.',
        'loading',
      );
    case 'empty':
      return state(
        'empty',
        'topic-list-empty',
        'No topics',
        'Linux DO returned no topics for this view.',
        'info',
        'Refresh',
      );
    case 'error':
      return state(
        'error',
        extraction.code,
        'Unable to read topics',
        topicListErrorDescription(extraction.code),
        'error',
        'Retry',
      );
  }
}

function snapshot(
  surfaceState: WorkbenchSurfaceState,
  topicDetailDocument: TopicDetailDocument | null = null,
  nativeComposer: ComposerCapability | null = null,
): WorkbenchViewSnapshot {
  return { nativeComposer, surfaceState, topicDetailDocument, topicListDocument: null };
}

function state(
  kind: Exclude<WorkbenchSurfaceStateKind, 'ready'>,
  code: string,
  title: string,
  description: string,
  icon: CodiconName,
  retryLabel: WorkbenchSurfaceState['retryLabel'] = null,
): WorkbenchSurfaceState {
  return { code, description, icon, kind, retryLabel, title };
}

function topicListErrorDescription(code: string): string {
  return code === 'topic-rows-unreadable'
    ? 'The Linux DO topic rows could not be read safely.'
    : 'Linux DO did not expose the expected topic list.';
}

function topicErrorDescription(code: string): string {
  switch (code) {
    case 'post-stream-not-found':
      return 'Linux DO did not expose the expected post stream.';
    case 'post-stream-unreadable':
      return 'The Linux DO post stream could not be read safely.';
    case 'topic-metadata-not-found':
      return 'Linux DO did not expose readable topic metadata.';
    default:
      return 'The current Linux DO topic could not be read safely.';
  }
}
