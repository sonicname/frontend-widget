import { describe, it, expect } from 'vitest';
import buildGreeting from '../../src/features/greeting.lazy';

describe('greeting lazy feature', () => {
  it('default export builds a greeting string', () => {
    expect(buildGreeting('World')).toBe('Hello, World!');
  });
});
