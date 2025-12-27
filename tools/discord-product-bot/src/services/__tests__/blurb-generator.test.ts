import { describe, expect, test } from 'vitest';
import {
  truncateBlurb,
  parseAgentFromJobName,
  MAX_BLURB_LENGTH,
  AGENT_PERSONAS,
  AGENT_SHORT_NAMES,
  PHASE_TO_ACTIVITY_TYPE,
  formatElapsedTime,
} from '../blurb-generator.js';
import type { TeamStatus } from '../../types.js';

describe('blurb-generator', () => {
  describe('truncateBlurb', () => {
    test('returns blurb unchanged when under limit', () => {
      const blurb = 'Working on Discord bot';
      expect(truncateBlurb(blurb)).toBe(blurb);
    });

    test('returns blurb unchanged when exactly at limit', () => {
      const blurb = 'a'.repeat(MAX_BLURB_LENGTH);
      expect(truncateBlurb(blurb)).toBe(blurb);
      expect(truncateBlurb(blurb).length).toBe(MAX_BLURB_LENGTH);
    });

    test('truncates and adds ellipsis when over limit', () => {
      const blurb = 'a'.repeat(MAX_BLURB_LENGTH + 10);
      const result = truncateBlurb(blurb);
      expect(result.length).toBe(MAX_BLURB_LENGTH);
      expect(result.endsWith('...')).toBe(true);
    });

    test('handles empty string', () => {
      expect(truncateBlurb('')).toBe('');
    });
  });

  describe('parseAgentFromJobName', () => {
    test('parses "Run {agent-name} ({phase})" format', () => {
      const result = parseAgentFromJobName('Run software-engineer (pre)');
      expect(result).toEqual({
        agentName: 'software-engineer',
        phase: 'pre',
      });
    });

    test('parses main phase', () => {
      const result = parseAgentFromJobName('Run tech-lead (main)');
      expect(result).toEqual({
        agentName: 'tech-lead',
        phase: 'main',
      });
    });

    test('parses post phase', () => {
      const result = parseAgentFromJobName('Run test-engineer (post)');
      expect(result).toEqual({
        agentName: 'test-engineer',
        phase: 'post',
      });
    });

    test('parses "Notify - {Agent Name} ({Phase})" format', () => {
      const result = parseAgentFromJobName('Notify - Documentation Sheriff (Pre)');
      expect(result).toEqual({
        agentName: 'documentation-sheriff',
        phase: 'pre',
      });
    });

    test('parses Notify format with spaces in agent name', () => {
      const result = parseAgentFromJobName('Notify - Software Engineer (Main)');
      expect(result).toEqual({
        agentName: 'software-engineer',
        phase: 'main',
      });
    });

    test('returns null for unrecognized job names', () => {
      expect(parseAgentFromJobName('Build Docker Image')).toBeNull();
      expect(parseAgentFromJobName('Checkout repository')).toBeNull();
      expect(parseAgentFromJobName('Setup Node.js')).toBeNull();
    });

    test('handles case-insensitive matching', () => {
      const result = parseAgentFromJobName('RUN SOFTWARE-ENGINEER (PRE)');
      expect(result).toEqual({
        agentName: 'software-engineer',
        phase: 'pre',
      });
    });

    test('fallback: finds agent name in job string with phase', () => {
      const result = parseAgentFromJobName('Some job with software-engineer in it (review)');
      expect(result).toEqual({
        agentName: 'software-engineer',
        phase: 'review',
      });
    });

    test('fallback: defaults to main phase when no phase in parens', () => {
      const result = parseAgentFromJobName('Job for software-engineer');
      expect(result).toEqual({
        agentName: 'software-engineer',
        phase: 'main',
      });
    });

    // NEW: Tests for spaced agent names from GitHub workflow job names
    test('parses spaced agent name "Software Engineer (Main)"', () => {
      const result = parseAgentFromJobName('Software Engineer (Main)');
      expect(result).toEqual({
        agentName: 'software-engineer',
        phase: 'main',
      });
    });

    test('parses spaced agent name "Documentation Sheriff (Pre)"', () => {
      const result = parseAgentFromJobName('Documentation Sheriff (Pre)');
      expect(result).toEqual({
        agentName: 'documentation-sheriff',
        phase: 'pre',
      });
    });

    test('parses spaced agent name "Tech Lead (Review)"', () => {
      const result = parseAgentFromJobName('Tech Lead (Review)');
      expect(result).toEqual({
        agentName: 'tech-lead',
        phase: 'review',
      });
    });

    test('parses spaced agent name "Test Engineer (Post)"', () => {
      const result = parseAgentFromJobName('Test Engineer (Post)');
      expect(result).toEqual({
        agentName: 'test-engineer',
        phase: 'post',
      });
    });

    // NEW: Tests for nested workflow format (reusable workflows)
    test('parses nested workflow format "Software Engineer (Main) / Run software-engineer (main)"', () => {
      const result = parseAgentFromJobName('Software Engineer (Main) / Run software-engineer (main)');
      expect(result).toEqual({
        agentName: 'software-engineer',
        phase: 'main',
      });
    });

    test('parses nested workflow format "Documentation Sheriff (Pre) / Run documentation-sheriff (pre)"', () => {
      const result = parseAgentFromJobName('Documentation Sheriff (Pre) / Run documentation-sheriff (pre)');
      expect(result).toEqual({
        agentName: 'documentation-sheriff',
        phase: 'pre',
      });
    });
  });

  describe('AGENT_PERSONAS', () => {
    test('contains all expected agents', () => {
      expect(AGENT_PERSONAS['software-engineer']).toBe('Alex - Dev');
      expect(AGENT_PERSONAS['tech-lead']).toBe('Taylor - Lead');
      expect(AGENT_PERSONAS['test-engineer']).toBe('Jamie - QA');
      expect(AGENT_PERSONAS['documentation-sheriff']).toBe('Riley - Docs');
    });
  });

  describe('AGENT_SHORT_NAMES', () => {
    test('contains short names for all agents', () => {
      expect(AGENT_SHORT_NAMES['software-engineer']).toBe('Alex');
      expect(AGENT_SHORT_NAMES['tech-lead']).toBe('Taylor');
      expect(AGENT_SHORT_NAMES['test-engineer']).toBe('Jamie');
    });
  });

  describe('PHASE_TO_ACTIVITY_TYPE', () => {
    test('maps pre phase to Watching', () => {
      expect(PHASE_TO_ACTIVITY_TYPE['pre']).toBe('Watching');
    });

    test('maps main phase to Playing', () => {
      expect(PHASE_TO_ACTIVITY_TYPE['main']).toBe('Playing');
    });

    test('maps post phase to Playing', () => {
      expect(PHASE_TO_ACTIVITY_TYPE['post']).toBe('Playing');
    });

    test('maps review phase to Watching', () => {
      expect(PHASE_TO_ACTIVITY_TYPE['review']).toBe('Watching');
    });

    test('maps fix phase to Playing', () => {
      expect(PHASE_TO_ACTIVITY_TYPE['fix']).toBe('Playing');
    });

    test('maps test phase to Competing', () => {
      expect(PHASE_TO_ACTIVITY_TYPE['test']).toBe('Competing');
    });
  });

  describe('formatElapsedTime', () => {
    test('formats minutes under 60 as Xm', () => {
      expect(formatElapsedTime(5)).toBe('5m');
      expect(formatElapsedTime(30)).toBe('30m');
      expect(formatElapsedTime(59)).toBe('59m');
    });

    test('formats exactly 60 minutes as 1h', () => {
      expect(formatElapsedTime(60)).toBe('1h');
    });

    test('formats hours with no remaining minutes', () => {
      expect(formatElapsedTime(120)).toBe('2h');
      expect(formatElapsedTime(180)).toBe('3h');
    });

    test('formats hours with remaining minutes', () => {
      expect(formatElapsedTime(65)).toBe('1h5m');
      expect(formatElapsedTime(90)).toBe('1h30m');
      expect(formatElapsedTime(135)).toBe('2h15m');
    });

    test('handles fractional minutes by flooring', () => {
      expect(formatElapsedTime(5.7)).toBe('5m');
      expect(formatElapsedTime(65.9)).toBe('1h5m');
    });
  });

  describe('generateStatusBlurb (integration)', () => {
    // These tests are marked as skipped because they require OpenAI API access
    // They can be run manually with valid API credentials

    const mockTeamStatus: TeamStatus = {
      content: '', // TeamStatus content is no longer used - context comes from GitHub API
    };

    test.skip('generates blurb from GitHub workflow data', async () => {
      // This test requires OPENAI_API_KEY and GITHUB_TOKEN environment variables
      const { generateStatusBlurb } = await import('../blurb-generator.js');
      const blurb = await generateStatusBlurb(mockTeamStatus);
      expect(typeof blurb).toBe('string');
      expect(blurb.length).toBeLessThanOrEqual(MAX_BLURB_LENGTH);
    });
  });

  describe('MAX_BLURB_LENGTH constant', () => {
    test('is 100 characters', () => {
      expect(MAX_BLURB_LENGTH).toBe(100);
    });
  });
});
