// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://linux.do/t/synthetic-topic/42" }

import { describe, expect, it } from 'vitest';

import { LinuxDoLikeApiClient } from '../../src/linuxdo/postActionApiClient';

interface RecordedRequest {
  readonly body: string | null;
  readonly headers: Headers;
  readonly method: string;
  readonly url: string;
}

interface StubResponse {
  readonly payload?: unknown;
  readonly status?: number;
  readonly url?: string;
}

function createStubFetch(responses: StubResponse[]) {
  const requests: RecordedRequest[] = [];
  const fetchStub = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url;
    const stub = responses.shift();
    if (!stub) throw new Error(`Unexpected request: ${url}`);
    requests.push({
      body: init?.body instanceof URLSearchParams ? init.body.toString() : null,
      headers: new Headers(init?.headers),
      method: init?.method ?? 'GET',
      url,
    });
    const status = stub.status ?? 200;
    const response = {
      json: () => Promise.resolve(stub.payload ?? {}),
      ok: status >= 200 && status < 300,
      status,
      url: stub.url ?? url,
    };
    return Promise.resolve(response as unknown as Response);
  };
  return { fetchStub, requests };
}

function likeState(acted: boolean, canUndo?: boolean): StubResponse {
  return {
    payload: {
      actions_summary: [
        { acted, can_undo: canUndo ?? true, count: 3, id: 2 },
        { count: 0, id: 8 },
      ],
      id: 100,
    },
  };
}

const CSRF: StubResponse = { payload: { csrf: 'token-123' } };

describe('LinuxDoLikeApiClient', () => {
  it('creates a Like through the Linux DO post-action endpoint', async () => {
    const { fetchStub, requests } = createStubFetch([likeState(false), CSRF, { payload: {} }]);
    const client = new LinuxDoLikeApiClient(document, { fetch: fetchStub });

    await expect(client.toggle(100)).resolves.toEqual({ active: true, kind: 'confirmed' });
    expect(requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'GET https://linux.do/posts/100.json',
      'GET https://linux.do/session/csrf.json',
      'POST https://linux.do/post_actions.json',
    ]);
    const write = requests[2];
    expect(write?.headers.get('X-CSRF-Token')).toBe('token-123');
    expect(write?.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(write?.body).toBe('flag_topic=false&id=100&post_action_type_id=2');
  });

  it('removes an existing Like through the delete endpoint', async () => {
    const { fetchStub, requests } = createStubFetch([likeState(true), CSRF, { payload: {} }]);
    const client = new LinuxDoLikeApiClient(document, { fetch: fetchStub });

    await expect(client.toggle(100)).resolves.toEqual({ active: false, kind: 'confirmed' });
    expect(requests[2]).toMatchObject({
      method: 'DELETE',
      url: 'https://linux.do/post_actions/100.json?post_action_type_id=2',
    });
  });

  it('reports authentication before mutating when the post state is forbidden', async () => {
    const { fetchStub, requests } = createStubFetch([{ status: 403 }]);
    const client = new LinuxDoLikeApiClient(document, { fetch: fetchStub });

    await expect(client.toggle(100)).resolves.toMatchObject({
      code: 'authentication-required',
      kind: 'failed',
      retryable: false,
    });
    expect(requests).toHaveLength(1);
  });

  it('refuses to remove a Like that Linux DO has locked', async () => {
    const { fetchStub, requests } = createStubFetch([likeState(true, false)]);
    const client = new LinuxDoLikeApiClient(document, { fetch: fetchStub });

    await expect(client.toggle(100)).resolves.toMatchObject({
      code: 'native-control-disabled',
      kind: 'failed',
      retryable: false,
    });
    expect(requests).toHaveLength(1);
  });

  it('rejects responses that resolve outside the Linux DO origin', async () => {
    const { fetchStub } = createStubFetch([
      { payload: {}, url: 'https://evil.example/posts/100.json' },
    ]);
    const client = new LinuxDoLikeApiClient(document, { fetch: fetchStub });

    await expect(client.toggle(100)).resolves.toMatchObject({
      code: 'native-dispatch-failed',
      kind: 'failed',
      retryable: false,
    });
  });

  it('surfaces the Linux DO error message when the mutation is rejected', async () => {
    const { fetchStub } = createStubFetch([
      likeState(false),
      CSRF,
      { payload: { errors: ['You are not permitted to like your own post.'] }, status: 403 },
    ]);
    const client = new LinuxDoLikeApiClient(document, { fetch: fetchStub });

    await expect(client.toggle(100)).resolves.toMatchObject({
      code: 'native-dispatch-failed',
      kind: 'failed',
      message: 'You are not permitted to like your own post.',
      retryable: false,
    });
  });

  it('reports an aborted toggle without issuing requests', async () => {
    const { fetchStub, requests } = createStubFetch([]);
    const client = new LinuxDoLikeApiClient(document, { fetch: fetchStub });
    const controller = new AbortController();
    controller.abort();

    await expect(client.toggle(100, controller.signal)).resolves.toMatchObject({
      code: 'aborted',
      kind: 'failed',
    });
    expect(requests).toHaveLength(0);
  });
});
