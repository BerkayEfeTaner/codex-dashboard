function createTtlCache(ttlMs) {
  let expiresAt = 0;
  let value;

  return {
    get(loader) {
      const now = Date.now();
      if (expiresAt > now) return value;
      value = loader();
      expiresAt = now + ttlMs;
      return value;
    },
    clear() {
      expiresAt = 0;
      value = undefined;
    }
  };
}

module.exports = { createTtlCache };
