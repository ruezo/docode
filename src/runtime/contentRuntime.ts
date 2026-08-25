import { isLinuxDoLocation } from '../linuxdo/host';
import {
  detectLinuxDoCapabilities,
  LinuxDoCapabilityObserver,
  summarizeCapabilityDetection,
  type CapabilityStatusSummary,
  type LinuxDoCapabilityDetection,
} from '../linuxdo/capabilities';
import { LinuxDoRouteObserver, type LinuxDoRouteSubscriber } from '../linuxdo/routeObserver';
import {
  getLinuxDoRouteFamily,
  recognizeLinuxDoRoute,
  type LinuxDoRoute,
  type LinuxDoRouteFamily,
} from '../linuxdo/routes';
import {
  extractTopicList,
  summarizeTopicListExtraction,
  type TopicListExtraction,
  type TopicListStatusSummary,
} from '../linuxdo/topicListAdapter';
import {
  extractTopic,
  summarizeTopicExtraction,
  type TopicExtraction,
  type TopicStatusSummary,
} from '../linuxdo/topicAdapter';
import { LinuxDoViewStateObserver } from '../linuxdo/viewStateObserver';
import { CleanupRegistry, type Cleanup } from './cleanupRegistry';
import { GenerationClock } from './generationClock';
import { hasPresentationOwnershipMarker, NativePresentation } from './nativePresentation';
import { TabDisguise } from './tabDisguise';
import { DEFAULT_SIDEBAR_WIDTH } from '../settings/workbenchLayoutPreference';
import {
  DEFAULT_WORKBENCH_APPEARANCE,
  type WorkbenchAppearancePreference,
} from '../settings/workbenchAppearancePreference';
import {
  hasWorkbenchRoot,
  mountWorkbench,
  type MountedWorkbench,
} from '../ui/workbench/mountWorkbench';

const RUNTIME_MARKER = 'data-docode-runtime';

type RuntimeLocation = Pick<Location, 'hostname' | 'protocol'> & { readonly port?: string };

export interface BootstrapOptions {
  readonly document: Document;
  readonly initialAppearance?: WorkbenchAppearancePreference;
  readonly initialSidebarWidth?: number;
  readonly location: RuntimeLocation;
  readonly persistAppearance?: (preference: WorkbenchAppearancePreference) => Promise<void>;
  readonly persistSidebarWidth?: (width: number) => Promise<void>;
  readonly readEnabledState: () => Promise<boolean>;
  readonly signal?: AbortSignal;
  readonly useOriginalView?: () => Promise<void>;
}

export type BootstrapResult =
  | { readonly status: 'already-mounted'; readonly runtime: ContentRuntime }
  | { readonly status: 'disabled' }
  | { readonly status: 'marker-conflict' }
  | { readonly status: 'mounted'; readonly runtime: ContentRuntime }
  | { readonly status: 'unsupported-host' };

const activeRuntimes = new WeakMap<Document, ContentRuntime>();
const pendingBootstraps = new WeakMap<Document, Promise<BootstrapResult>>();

export class ContentRuntime {
  readonly #cleanups = new CleanupRegistry();
  readonly #capabilityGeneration = new GenerationClock();
  readonly #capabilityObserver: LinuxDoCapabilityObserver;
  readonly #generation = new GenerationClock();
  readonly #markerToken = globalThis.crypto.randomUUID();
  readonly #presentation: NativePresentation;
  readonly #routeObserver: LinuxDoRouteObserver | null;
  readonly #tabDisguise: TabDisguise;
  readonly #viewStateObserver: LinuxDoViewStateObserver;
  readonly #workbench: MountedWorkbench | null;
  #mounted = true;
  #workbenchRefreshFrame: number | null = null;
  #workbenchRefreshPending = false;

  constructor(
    readonly document: Document,
    useOriginalView: (() => Promise<void>) | null = null,
    workbenchPreferences: {
      readonly initialAppearance: WorkbenchAppearancePreference;
      readonly initialSidebarWidth: number;
      readonly persistAppearance: (preference: WorkbenchAppearancePreference) => Promise<void>;
      readonly persistSidebarWidth: (width: number) => Promise<void>;
    } = {
      initialAppearance: DEFAULT_WORKBENCH_APPEARANCE,
      initialSidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      persistAppearance: () => Promise.resolve(),
      persistSidebarWidth: () => Promise.resolve(),
    },
  ) {
    this.#presentation = new NativePresentation(document, this.#markerToken);
    this.#capabilityObserver = new LinuxDoCapabilityObserver(document, () => {
      this.#capabilityGeneration.invalidate();
      this.#scheduleWorkbenchRefresh();
    });
    this.#routeObserver = document.defaultView
      ? new LinuxDoRouteObserver(document.defaultView)
      : null;
    this.#viewStateObserver = new LinuxDoViewStateObserver(document, () => {
      this.#scheduleWorkbenchRefresh();
    });
    document.documentElement.setAttribute(RUNTIME_MARKER, this.#markerToken);
    this.#cleanups.add(() => {
      if (document.documentElement.getAttribute(RUNTIME_MARKER) === this.#markerToken) {
        document.documentElement.removeAttribute(RUNTIME_MARKER);
      }
    });
    this.#cleanups.add(() => {
      this.#presentation.restore();
    });
    this.#workbench = isLinuxDoLocation(document.location)
      ? mountWorkbench(document, this.#markerToken, recognizeLinuxDoRoute(document.location.href), {
          initialAppearance: workbenchPreferences.initialAppearance,
          initialSidebarWidth: workbenchPreferences.initialSidebarWidth,
          onAppearanceChange: workbenchPreferences.persistAppearance,
          onSidebarWidthChange: workbenchPreferences.persistSidebarWidth,
          useOriginalView,
        })
      : null;
    if (this.#workbench) {
      this.#cleanups.add(() => {
        this.#workbench?.unmount();
      });
    }
    this.#capabilityObserver.start();
    this.#cleanups.add(() => {
      this.#capabilityObserver.stop();
    });
    this.#viewStateObserver.start();
    this.#cleanups.add(() => {
      this.#viewStateObserver.stop();
    });
    const settleWindow = document.defaultView;
    if (settleWindow) {
      for (const delay of [1_000, 3_000, 8_000]) {
        const timer = settleWindow.setTimeout(() => {
          this.#capabilityObserver.start();
          this.#scheduleWorkbenchRefresh();
        }, delay);
        this.#cleanups.add(() => {
          settleWindow.clearTimeout(timer);
        });
      }
    }
    if (document.readyState === 'loading') {
      const startObserversWhenReady = () => {
        this.#capabilityObserver.start();
        this.#viewStateObserver.start();
        this.#scheduleWorkbenchRefresh();
      };
      document.addEventListener('DOMContentLoaded', startObserversWhenReady, { once: true });
      this.#cleanups.add(() => {
        document.removeEventListener('DOMContentLoaded', startObserversWhenReady);
      });
    }
    this.#tabDisguise = new TabDisguise(
      document,
      isLinuxDoLocation(document.location) ? recognizeLinuxDoRoute(document.location.href) : null,
    );
    this.#tabDisguise.start();
    this.#cleanups.add(() => {
      this.#tabDisguise.stop();
    });
    if (this.#routeObserver) {
      this.#routeObserver.subscribe((change) => {
        this.#viewStateObserver.refresh();
        this.#tabDisguise.updateRoute(change.current);
        this.#workbench?.updateRoute(change.current, change.generation, change.source);
        if (change.source !== 'initial') {
          this.#capabilityGeneration.invalidate();
          this.#generation.invalidate();
        }
      });
      this.#routeObserver.start();
      this.#cleanups.add(() => {
        this.#routeObserver?.stop();
      });
    }
  }

  get isMounted(): boolean {
    return this.#mounted;
  }

  captureGeneration(): number {
    return this.#generation.capture();
  }

  invalidateStaleWork(): number {
    return this.#generation.invalidate();
  }

  isCurrentGeneration(generation: number): boolean {
    return this.#mounted && this.#generation.isCurrent(generation);
  }

  get currentRoute(): LinuxDoRoute | null {
    return this.#routeObserver?.current ?? null;
  }

  get routeGeneration(): number | null {
    return this.#routeObserver?.generation ?? null;
  }

  get topicList(): TopicListExtraction | null {
    const route = this.currentRoute;
    return route?.kind === 'topic-list' ? extractTopicList(this.document, route) : null;
  }

  get topic(): TopicExtraction | null {
    const route = this.currentRoute;
    if (route?.kind !== 'topic') return null;
    return this.#workbench?.readTopic(route) ?? extractTopic(this.document, route);
  }

  get capabilities(): LinuxDoCapabilityDetection | null {
    const route = this.currentRoute;
    return route?.kind === 'topic' ? detectLinuxDoCapabilities(this.document, route) : null;
  }

  get capabilityGeneration(): number {
    return this.#capabilityGeneration.capture();
  }

  subscribeToRoutes(subscriber: LinuxDoRouteSubscriber): Cleanup {
    if (!this.#mounted || !this.#routeObserver) return () => undefined;
    const unsubscribe = this.#routeObserver.subscribe(subscriber);
    this.registerCleanup(unsubscribe);
    return unsubscribe;
  }

  hideVerifiedNativeRegion(element: HTMLElement): boolean {
    if (!this.#mounted) return false;
    return this.#presentation.hideVerifiedRegion(element);
  }

  registerCleanup(cleanup: Cleanup): Cleanup {
    return this.#cleanups.add(cleanup);
  }

  #scheduleWorkbenchRefresh(): void {
    const activeWindow = this.document.defaultView;
    if (!this.#mounted || this.#workbenchRefreshPending || !activeWindow) return;
    this.#capabilityObserver.start();
    this.#workbenchRefreshPending = true;
    activeWindow.queueMicrotask(() => {
      if (!this.#mounted) {
        this.#workbenchRefreshPending = false;
        return;
      }
      const refresh = () => {
        this.#workbenchRefreshFrame = null;
        this.#workbenchRefreshPending = false;
        if (this.#mounted) this.#workbench?.refresh();
      };
      if (typeof activeWindow.requestAnimationFrame === 'function') {
        this.#workbenchRefreshFrame = activeWindow.requestAnimationFrame(refresh);
      } else {
        refresh();
      }
    });
  }

  unmount(): boolean {
    if (!this.#mounted) return false;
    this.#mounted = false;
    if (this.#workbenchRefreshFrame !== null) {
      this.document.defaultView?.cancelAnimationFrame(this.#workbenchRefreshFrame);
      this.#workbenchRefreshFrame = null;
    }
    this.#workbenchRefreshPending = false;
    this.#generation.invalidate();
    this.#cleanups.dispose();
    return true;
  }
}

export async function bootstrapContentRuntime(options: BootstrapOptions): Promise<BootstrapResult> {
  if (!isLinuxDoLocation(options.location)) return { status: 'unsupported-host' };

  const activeRuntime = activeRuntimes.get(options.document);
  if (activeRuntime?.isMounted) return { status: 'already-mounted', runtime: activeRuntime };

  const pendingBootstrap = pendingBootstraps.get(options.document);
  if (pendingBootstrap) {
    const result = await pendingBootstrap;
    return result.status === 'mounted'
      ? { status: 'already-mounted', runtime: result.runtime }
      : result;
  }

  const bootstrap = performBootstrap(options);
  pendingBootstraps.set(options.document, bootstrap);

  try {
    return await bootstrap;
  } finally {
    pendingBootstraps.delete(options.document);
  }
}

export function disableContentRuntime(document: Document): boolean {
  const runtime = activeRuntimes.get(document);
  if (!runtime) return false;

  activeRuntimes.delete(document);
  return runtime.unmount();
}

export function isContentRuntimeMounted(document: Document): boolean {
  return activeRuntimes.get(document)?.isMounted === true;
}

export function getContentRuntimeRouteStatus(
  document: Document,
): { readonly family: LinuxDoRouteFamily; readonly generation: number } | null {
  const runtime = activeRuntimes.get(document);
  const route = runtime?.currentRoute;
  const generation = runtime?.routeGeneration;
  return route && generation !== null && generation !== undefined
    ? { family: getLinuxDoRouteFamily(route), generation }
    : null;
}

export function getContentRuntimeTopicListStatus(
  document: Document,
): TopicListStatusSummary | null {
  const extraction = activeRuntimes.get(document)?.topicList;
  return extraction ? summarizeTopicListExtraction(extraction) : null;
}

export function getContentRuntimeTopicStatus(document: Document): TopicStatusSummary | null {
  const extraction = activeRuntimes.get(document)?.topic;
  return extraction ? summarizeTopicExtraction(extraction) : null;
}

export function getContentRuntimeCapabilityStatus(
  document: Document,
): CapabilityStatusSummary | null {
  const runtime = activeRuntimes.get(document);
  const detection = runtime?.capabilities;
  return detection ? summarizeCapabilityDetection(detection, runtime.capabilityGeneration) : null;
}

async function performBootstrap(options: BootstrapOptions): Promise<BootstrapResult> {
  if (!(await options.readEnabledState()) || options.signal?.aborted) {
    return { status: 'disabled' };
  }
  if (
    options.document.documentElement.hasAttribute(RUNTIME_MARKER) ||
    hasPresentationOwnershipMarker(options.document) ||
    hasWorkbenchRoot(options.document)
  ) {
    return { status: 'marker-conflict' };
  }

  const runtime = new ContentRuntime(options.document, options.useOriginalView ?? null, {
    initialAppearance: options.initialAppearance ?? DEFAULT_WORKBENCH_APPEARANCE,
    initialSidebarWidth: options.initialSidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
    persistAppearance: options.persistAppearance ?? (() => Promise.resolve()),
    persistSidebarWidth: options.persistSidebarWidth ?? (() => Promise.resolve()),
  });
  activeRuntimes.set(options.document, runtime);
  runtime.registerCleanup(() => {
    if (activeRuntimes.get(options.document) === runtime) {
      activeRuntimes.delete(options.document);
    }
  });

  return { status: 'mounted', runtime };
}
