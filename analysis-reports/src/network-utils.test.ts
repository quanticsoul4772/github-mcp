/**
 * Tests for network-utils: IP and host validation
 */
import { describe, it, expect } from 'vitest';
import {
  isDisallowedHost,
  isPrivateIPv4,
  isReservedIPv4,
  isDocumentationIPv4,
  isPrivateOrReservedIPv6,
  isPrivateOrReservedIP,
} from './network-utils.js';

describe('network-utils', () => {

  // ============================================================================
  // isDisallowedHost
  // ============================================================================

  describe('isDisallowedHost', () => {
    it.each([
      'localhost',
      'broadcasthost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '::',
      'ip6-localhost',
      'ip6-loopback',
    ])('should return true for %s', (host) => {
      expect(isDisallowedHost(host)).toBe(true);
    });

    it('should return false for public hostname', () => {
      expect(isDisallowedHost('github.com')).toBe(false);
    });

    it('should return false for public IP', () => {
      expect(isDisallowedHost('8.8.8.8')).toBe(false);
    });
  });

  // ============================================================================
  // isPrivateIPv4
  // ============================================================================

  describe('isPrivateIPv4', () => {
    it('should return true for 10.x.x.x (Class A private)', () => {
      expect(isPrivateIPv4(10, 0, 0, 1)).toBe(true);
      expect(isPrivateIPv4(10, 255, 255, 255)).toBe(true);
    });

    it('should return true for 172.16-31.x.x (Class B private)', () => {
      expect(isPrivateIPv4(172, 16, 0, 1)).toBe(true);
      expect(isPrivateIPv4(172, 31, 255, 255)).toBe(true);
    });

    it('should return false for 172.15 (outside range)', () => {
      expect(isPrivateIPv4(172, 15, 0, 1)).toBe(false);
    });

    it('should return false for 172.32 (outside range)', () => {
      expect(isPrivateIPv4(172, 32, 0, 1)).toBe(false);
    });

    it('should return true for 192.168.x.x (Class C private)', () => {
      expect(isPrivateIPv4(192, 168, 0, 1)).toBe(true);
      expect(isPrivateIPv4(192, 168, 255, 255)).toBe(true);
    });

    it('should return false for public IPs', () => {
      expect(isPrivateIPv4(8, 8, 8, 8)).toBe(false);
      expect(isPrivateIPv4(1, 1, 1, 1)).toBe(false);
    });
  });

  // ============================================================================
  // isReservedIPv4
  // ============================================================================

  describe('isReservedIPv4', () => {
    it('should return true for 127.x.x.x (loopback)', () => {
      expect(isReservedIPv4(127, 0, 0, 1)).toBe(true);
    });

    it('should return true for 0.x.x.x ("this" network)', () => {
      expect(isReservedIPv4(0, 0, 0, 0)).toBe(true);
    });

    it('should return true for multicast 224-239', () => {
      expect(isReservedIPv4(224, 0, 0, 1)).toBe(true);
      expect(isReservedIPv4(239, 255, 255, 255)).toBe(true);
    });

    it('should return true for reserved 240+', () => {
      expect(isReservedIPv4(240, 0, 0, 1)).toBe(true);
      expect(isReservedIPv4(255, 255, 255, 255)).toBe(true);
    });

    it('should return true for 169.254.x.x (link-local)', () => {
      expect(isReservedIPv4(169, 254, 0, 1)).toBe(true);
    });

    it('should return true for 100.64-127.x.x (carrier-grade NAT)', () => {
      expect(isReservedIPv4(100, 64, 0, 1)).toBe(true);
      expect(isReservedIPv4(100, 127, 255, 255)).toBe(true);
    });

    it('should return false for 100.63 (below carrier-grade NAT range)', () => {
      expect(isReservedIPv4(100, 63, 0, 1)).toBe(false);
    });

    it('should return false for public IPs', () => {
      expect(isReservedIPv4(8, 8, 8, 8)).toBe(false);
    });
  });

  // ============================================================================
  // isDocumentationIPv4
  // ============================================================================

  describe('isDocumentationIPv4', () => {
    it('should return true for 198.18.x.x (benchmarking)', () => {
      expect(isDocumentationIPv4(198, 18, 0)).toBe(true);
    });

    it('should return true for 198.19.x.x (benchmarking)', () => {
      expect(isDocumentationIPv4(198, 19, 0)).toBe(true);
    });

    it('should return true for 203.0.113.x (documentation)', () => {
      expect(isDocumentationIPv4(203, 0, 113)).toBe(true);
    });

    it('should return true for 192.0.2.x (documentation)', () => {
      expect(isDocumentationIPv4(192, 0, 2)).toBe(true);
    });

    it('should return true for 198.51.100.x (documentation)', () => {
      expect(isDocumentationIPv4(198, 51, 100)).toBe(true);
    });

    it('should return false for public IP', () => {
      expect(isDocumentationIPv4(8, 8, 8)).toBe(false);
    });
  });

  // ============================================================================
  // isPrivateOrReservedIPv6
  // ============================================================================

  describe('isPrivateOrReservedIPv6', () => {
    it('should return true for loopback ::1', () => {
      expect(isPrivateOrReservedIPv6('::1')).toBe(true);
    });

    it('should return true for unspecified ::', () => {
      expect(isPrivateOrReservedIPv6('::')).toBe(true);
    });

    it('should return true for unique local fc00::/7', () => {
      expect(isPrivateOrReservedIPv6('fc00::1')).toBe(true);
      expect(isPrivateOrReservedIPv6('fd00::1')).toBe(true);
    });

    it('should return true for link-local fe80::/10', () => {
      expect(isPrivateOrReservedIPv6('fe80::1')).toBe(true);
      expect(isPrivateOrReservedIPv6('fe9f::1')).toBe(true);
      expect(isPrivateOrReservedIPv6('feaf::1')).toBe(true);
      expect(isPrivateOrReservedIPv6('feb0::1')).toBe(true);
    });

    it('should return true for multicast ff00::/8', () => {
      expect(isPrivateOrReservedIPv6('ff02::1')).toBe(true);
    });

    it('should return true for documentation 2001:db8::/32', () => {
      expect(isPrivateOrReservedIPv6('2001:db8::1')).toBe(true);
      expect(isPrivateOrReservedIPv6('2001:0db8::1')).toBe(true);
    });

    it('should return true for IPv4-mapped ::ffff:', () => {
      expect(isPrivateOrReservedIPv6('::ffff:192.168.1.1')).toBe(true);
    });

    it('should return true for 6to4 2002::/16', () => {
      expect(isPrivateOrReservedIPv6('2002::1')).toBe(true);
    });

    it('should return false for public IPv6', () => {
      expect(isPrivateOrReservedIPv6('2600::1')).toBe(false);
    });
  });

  // ============================================================================
  // isPrivateOrReservedIP (main function)
  // ============================================================================

  describe('isPrivateOrReservedIP', () => {
    it('should return true for disallowed hosts', () => {
      expect(isPrivateOrReservedIP('localhost')).toBe(true);
      expect(isPrivateOrReservedIP('127.0.0.1')).toBe(true);
    });

    it('should return true for private IPv4', () => {
      expect(isPrivateOrReservedIP('192.168.1.100')).toBe(true);
      expect(isPrivateOrReservedIP('10.0.0.1')).toBe(true);
    });

    it('should return true for reserved IPv4', () => {
      expect(isPrivateOrReservedIP('169.254.0.1')).toBe(true);
    });

    it('should return true for invalid IPv4 octet > 255', () => {
      expect(isPrivateOrReservedIP('256.0.0.1')).toBe(true);
    });

    it('should return false for public IPv4', () => {
      expect(isPrivateOrReservedIP('8.8.8.8')).toBe(false);
      expect(isPrivateOrReservedIP('1.1.1.1')).toBe(false);
    });

    it('should return true for private IPv6', () => {
      expect(isPrivateOrReservedIP('fc00::1')).toBe(true);
      expect(isPrivateOrReservedIP('::1')).toBe(true);
    });

    it('should return false for public IPv6', () => {
      expect(isPrivateOrReservedIP('2600::1')).toBe(false);
    });

    it('should return false for regular domain name', () => {
      expect(isPrivateOrReservedIP('github.com')).toBe(false);
      expect(isPrivateOrReservedIP('api.example.com')).toBe(false);
    });
  });
});
