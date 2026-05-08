import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchReleaseHealth, fetchSessionDetail } from './client.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(payload, ok = true, status = 200) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok,
    status,
    json: async () => payload
  })));
}

describe('api client', () => {
  it('requests release health from the release endpoint', async () => {
    const payload = { release: { readiness: 'ready', score: 100 } };
    mockFetch(payload);

    await expect(fetchReleaseHealth()).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith('/api/release/health', undefined);
  });

  it('encodes session detail ids before building the URL', async () => {
    mockFetch({ id: 'session 1/2' });

    await fetchSessionDetail('session 1/2');

    expect(fetch).toHaveBeenCalledWith('/api/sessions/session%201%2F2', undefined);
  });

  it('throws on non-2xx responses', async () => {
    mockFetch({ error: 'not_found' }, false, 404);

    await expect(fetchReleaseHealth()).rejects.toThrow('HTTP 404');
  });
});
