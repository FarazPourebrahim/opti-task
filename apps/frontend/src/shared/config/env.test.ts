import { describe, expect, it } from 'vitest';
import { env, parseEnv } from './env';

describe('env config', () => {
  it('parses a valid configuration', () => {
    // Arrange
    const raw = {
      VITE_API_URL: 'https://api.optitask.test/graphql',
      VITE_WS_URL: 'wss://api.optitask.test/graphql',
    };

    // Act
    const result = parseEnv(raw);

    // Assert
    expect(result.VITE_API_URL).toBe('https://api.optitask.test/graphql');
    expect(result.VITE_WS_URL).toBe('wss://api.optitask.test/graphql');
  });

  it('exposes the loaded configuration to the app', () => {
    expect(env.VITE_API_URL).toMatch(/^https?:\/\//);
    expect(env.VITE_WS_URL).toMatch(/^wss?:\/\//);
  });

  it('fails loudly when a variable is missing, naming the variable', () => {
    // Arrange
    const raw = { VITE_WS_URL: 'ws://localhost:4000/graphql' };

    // Act / Assert
    expect(() => parseEnv(raw)).toThrowError(/VITE_API_URL/);
  });

  it('rejects a non-absolute API URL', () => {
    const raw = {
      VITE_API_URL: '/graphql',
      VITE_WS_URL: 'ws://localhost:4000/graphql',
    };

    expect(() => parseEnv(raw)).toThrowError(/absolute URL/);
  });

  it('rejects a websocket URL that does not use the ws protocol', () => {
    // A http:// value here would connect nowhere and fail only at subscribe
    // time, so it is caught at boot instead.
    const raw = {
      VITE_API_URL: 'http://localhost:4000/graphql',
      VITE_WS_URL: 'http://localhost:4000/graphql',
    };

    expect(() => parseEnv(raw)).toThrowError(/ws:\/\/ or wss:\/\//);
  });

  it('points the developer at .env.example when configuration is invalid', () => {
    expect(() => parseEnv({})).toThrowError(/\.env\.example/);
  });
});
