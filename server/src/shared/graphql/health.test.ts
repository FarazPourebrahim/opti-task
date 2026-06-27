import { describe, expect, it } from 'vitest';
import { healthResolvers } from './health.js';

describe('health resolver', () => {
  it('returns ok status with uptime and timestamp', () => {
    // Arrange
    const resolve = healthResolvers.Query.health;

    // Act
    const result = resolve();

    // Assert
    expect(result.status).toBe('ok');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
