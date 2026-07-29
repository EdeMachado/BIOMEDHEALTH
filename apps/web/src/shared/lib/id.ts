function fallbackId(): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `id-${Date.now().toString(36)}-${randomPart}`;
}

export function generateId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    try {
      return cryptoApi.randomUUID();
    } catch {
      // Fallback em ambientes com suporte parcial de Web Crypto.
    }
  }

  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      return `id-${hex}`;
    } catch {
      // Fallback final para manter o fluxo demonstrativo operacional.
    }
  }

  return fallbackId();
}
