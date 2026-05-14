import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSessionDetail, fetchSummary } from './client.js';

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
  it('encodes session detail ids before building the URL', async () => {
    mockFetch({ id: 'session 1/2' });

    await fetchSessionDetail('session 1/2');

    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/sessions\/session%201%2F2\?_=\d+$/), { cache: 'no-store' });
  });

  it('throws on non-2xx responses', async () => {
    mockFetch({ error: 'not_found' }, false, 404);

    await expect(fetchSummary()).rejects.toThrow('HTTP 404');
  });
});
