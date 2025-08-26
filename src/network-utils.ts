/**
 * Network and IP validation utilities
 * Contains functions for validating IP addresses and network security checks
 */

export function isDisallowedHost(host: string): boolean {
  const disallowedHosts = new Set([
    'localhost',
    'broadcasthost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '::',
    'ip6-localhost',
    'ip6-loopback',
  ]);
  return disallowedHosts.has(host);
}

export function isPrivateIPv4(a: number, b: number, c: number, d: number): boolean {
  // 10.0.0.0/8 - Private
  if (a === 10) return true;

  // 172.16.0.0/12 - Private
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 - Private
  if (a === 192 && b === 168) return true;

  return false;
}

export function isReservedIPv4(a: number, b: number, c: number, d: number): boolean {
  // 127.0.0.0/8 - Loopback
  if (a === 127) return true;

  // 0.0.0.0/8 - "This" Network
  if (a === 0) return true;

  // 224.0.0.0/4 - Multicast
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 - Reserved for future use
  if (a >= 240) return true;

  // 169.254.0.0/16 - Link-local
  if (a === 169 && b === 254) return true;

  // 100.64.0.0/10 - Carrier-grade NAT
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

export function isDocumentationIPv4(a: number, b: number, c: number): boolean {
  // 198.18.0.0/15 - Benchmarking
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 203.0.113.0/24 - Documentation
  if (a === 203 && b === 0 && c === 113) return true;

  // 192.0.2.0/24 - Documentation
  if (a === 192 && b === 0 && c === 2) return true;

  // 198.51.100.0/24 - Documentation
  if (a === 198 && b === 51 && c === 100) return true;

  return false;
}

export function isPrivateOrReservedIPv6(normalizedHost: string): boolean {
  // Loopback and unspecified
  if (normalizedHost === '::1' || normalizedHost === '::') return true;

  // fc00::/7 - Unique local addresses (private)
  if (normalizedHost.startsWith('fc') || normalizedHost.startsWith('fd')) return true;

  // fe80::/10 - Link-local
  if (
    normalizedHost.startsWith('fe8') ||
    normalizedHost.startsWith('fe9') ||
    normalizedHost.startsWith('fea') ||
    normalizedHost.startsWith('feb')
  )
    return true;

  // ff00::/8 - Multicast
  if (normalizedHost.startsWith('ff')) return true;

  // 2001:db8::/32 - Documentation
  if (normalizedHost.startsWith('2001:db8') || normalizedHost.startsWith('2001:0db8')) return true;

  // ::ffff:0:0/96 - IPv4-mapped IPv6 addresses
  if (normalizedHost.includes('::ffff:')) return true;

  // 2002::/16 - 6to4 (may expose internal networks)
  if (normalizedHost.startsWith('2002:')) return true;

  return false;
}

export function isPrivateOrReservedIP(host: string): boolean {
  // Check disallowed hosts first
  if (isDisallowedHost(host)) {
    return true;
  }

  // Check IPv4 addresses
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = host.match(ipv4Pattern);

  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);

    // Validate each octet is in range 0-255
    if (a > 255 || b > 255 || c > 255 || d > 255) {
      return true; // Invalid IPv4 format
    }

    return isPrivateIPv4(a, b, c, d) || isReservedIPv4(a, b, c, d) || isDocumentationIPv4(a, b, c);
  }

  // Check IPv6 addresses
  if (host.includes(':')) {
    const normalizedHost = host.toLowerCase();
    return isPrivateOrReservedIPv6(normalizedHost);
  }

  return false;
}