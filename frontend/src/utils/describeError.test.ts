import { describe, it, expect } from 'vitest';
import { ApiError } from '../api/api';
import { describeError } from './describeError';

describe('describeError', () => {
  it('uses the backend message verbatim for ApiError', () => {
    const msg = describeError(new ApiError(400, '角色名稱不可為空。'), '儲存角色失敗。');
    expect(msg).toBe('角色名稱不可為空。');
  });

  it('wraps a generic Error with the fallback for context', () => {
    const msg = describeError(new Error('boom'), '儲存角色失敗。');
    expect(msg).toBe('儲存角色失敗。（boom）');
  });

  it('returns the fallback for non-Error values', () => {
    expect(describeError('nope', '儲存角色失敗。')).toBe('儲存角色失敗。');
    expect(describeError(undefined, '儲存角色失敗。')).toBe('儲存角色失敗。');
  });
});
