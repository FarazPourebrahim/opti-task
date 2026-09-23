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
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(Number.isNaN(result.timestamp.getTime())).toBe(false);
  });
});
