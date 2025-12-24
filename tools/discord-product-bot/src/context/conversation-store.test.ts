import { describe, it, expect, beforeEach } from 'vitest';
import {
  getContextKey,
  getConversationContext,
  addMessage,
  clearContext,
  getCacheStats,
  _testExports,
} from './conversation-store.js';

describe('conversation-store', () => {
  beforeEach(() => {
    // Clear the cache before each test
    _testExports.contextCache.clear();
  });

  describe('getContextKey', () => {
    it('returns threadId when present', () => {
      const result = getContextKey('channel-123', 'thread-456');
      expect(result).toBe('thread-456');
    });

    it('returns channelId when threadId is null', () => {
      const result = getContextKey('channel-123', null);
      expect(result).toBe('channel-123');
    });
  });

  describe('getConversationContext', () => {
    it('returns empty array for new context', () => {
      const result = getConversationContext('new-channel');
      expect(result).toEqual([]);
    });

    it('returns messages after adding them', () => {
      addMessage('test-channel', 'user', 'Hello', 'user-1', 'TestUser');
      const result = getConversationContext('test-channel');
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Hello');
      expect(result[0].role).toBe('user');
    });
  });

  describe('addMessage', () => {
    it('adds user message correctly', () => {
      addMessage('test-channel', 'user', 'Test message', 'user-123', 'Alice');

      const context = getConversationContext('test-channel');
      expect(context).toHaveLength(1);
      expect(context[0]).toMatchObject({
        role: 'user',
        content: 'Test message',
        authorId: 'user-123',
        authorName: 'Alice',
      });
      expect(context[0].timestamp).toBeDefined();
    });

    it('adds assistant message correctly', () => {
      addMessage('test-channel', 'assistant', 'Bot response', 'bot-123', 'Bot');

      const context = getConversationContext('test-channel');
      expect(context).toHaveLength(1);
      expect(context[0].role).toBe('assistant');
    });

    it('includes images when provided', () => {
      const images = [
        { url: 'http://example.com/img.png', name: 'test.png', contentType: 'image/png' },
      ];
      addMessage('test-channel', 'user', 'With image', 'user-1', 'User', images);

      const context = getConversationContext('test-channel');
      expect(context[0].images).toEqual(images);
    });

    it('maintains message order', () => {
      addMessage('test-channel', 'user', 'First', 'user-1', 'User');
      addMessage('test-channel', 'assistant', 'Second', 'bot-1', 'Bot');
      addMessage('test-channel', 'user', 'Third', 'user-1', 'User');

      const context = getConversationContext('test-channel');
      expect(context).toHaveLength(3);
      expect(context[0].content).toBe('First');
      expect(context[1].content).toBe('Second');
      expect(context[2].content).toBe('Third');
    });

    it('prunes old messages when limit is exceeded', () => {
      const limit = _testExports.MAX_MESSAGES_PER_CHANNEL;

      // Add more messages than the limit
      for (let i = 0; i < limit + 5; i++) {
        addMessage('test-channel', 'user', `Message ${i}`, 'user-1', 'User');
      }

      const context = getConversationContext('test-channel');
      expect(context).toHaveLength(limit);
      // First message should be pruned, so first remaining should be "Message 5"
      expect(context[0].content).toBe('Message 5');
      expect(context[limit - 1].content).toBe(`Message ${limit + 4}`);
    });
  });

  describe('clearContext', () => {
    it('removes context for a channel', () => {
      addMessage('test-channel', 'user', 'Hello', 'user-1', 'User');
      expect(getConversationContext('test-channel')).toHaveLength(1);

      clearContext('test-channel');
      expect(getConversationContext('test-channel')).toEqual([]);
    });

    it('does not affect other channels', () => {
      addMessage('channel-1', 'user', 'Hello 1', 'user-1', 'User');
      addMessage('channel-2', 'user', 'Hello 2', 'user-1', 'User');

      clearContext('channel-1');

      expect(getConversationContext('channel-1')).toEqual([]);
      expect(getConversationContext('channel-2')).toHaveLength(1);
    });
  });

  describe('getCacheStats', () => {
    it('returns correct size', () => {
      expect(getCacheStats().size).toBe(0);

      addMessage('channel-1', 'user', 'Hello', 'user-1', 'User');
      expect(getCacheStats().size).toBe(1);

      addMessage('channel-2', 'user', 'Hello', 'user-1', 'User');
      expect(getCacheStats().size).toBe(2);
    });

    it('returns correct maxSize', () => {
      expect(getCacheStats().maxSize).toBe(_testExports.MAX_CHANNELS);
    });
  });

  describe('separate contexts for channels and threads', () => {
    it('maintains separate contexts for different channels', () => {
      addMessage('channel-1', 'user', 'In channel 1', 'user-1', 'User');
      addMessage('channel-2', 'user', 'In channel 2', 'user-1', 'User');

      const context1 = getConversationContext('channel-1');
      const context2 = getConversationContext('channel-2');

      expect(context1).toHaveLength(1);
      expect(context2).toHaveLength(1);
      expect(context1[0].content).toBe('In channel 1');
      expect(context2[0].content).toBe('In channel 2');
    });

    it('thread context is separate from parent channel', () => {
      const channelKey = getContextKey('parent-channel', null);
      const threadKey = getContextKey('parent-channel', 'thread-123');

      addMessage(channelKey, 'user', 'In channel', 'user-1', 'User');
      addMessage(threadKey, 'user', 'In thread', 'user-1', 'User');

      expect(getConversationContext(channelKey)[0].content).toBe('In channel');
      expect(getConversationContext(threadKey)[0].content).toBe('In thread');
    });
  });
});
