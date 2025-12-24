import { describe, expect, test } from 'vitest';
import {
  truncateBlurb,
  extractMilestoneName,
  MAX_BLURB_LENGTH,
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

  describe('extractMilestoneName', () => {
    test('extracts name from "- Name: <name>" format', () => {
      const milestone = `- Name: Discord Bot Image Attachment Support (Issue #7)
- Status: GIT WRAP-UP COMPLETE
- Required action: Execute push + PR commands`;
      expect(extractMilestoneName(milestone)).toBe(
        'Discord Bot Image Attachment Support (Issue #7)'
      );
    });

    test('extracts name from "* Name: <name>" format', () => {
      const milestone = `* Name: Docker Build Fix
* Status: Complete`;
      expect(extractMilestoneName(milestone)).toBe('Docker Build Fix');
    });

    test('extracts name without bullet point', () => {
      const milestone = `Name: Interview Depth Enhancement
Status: In Progress`;
      expect(extractMilestoneName(milestone)).toBe('Interview Depth Enhancement');
    });

    test('falls back to first line when no Name field', () => {
      const milestone = `Discord Bot Image Support
Some other details here`;
      expect(extractMilestoneName(milestone)).toBe('Discord Bot Image Support');
    });

    test('removes bullet from first line in fallback', () => {
      const milestone = `- Discord Bot Image Support
- Some other details`;
      expect(extractMilestoneName(milestone)).toBe('Discord Bot Image Support');
    });

    test('returns "Working..." for empty input', () => {
      expect(extractMilestoneName('')).toBe('Working...');
    });

    test('returns "Working..." for whitespace-only input', () => {
      expect(extractMilestoneName('   \n   ')).toBe('Working...');
    });
  });

  describe('generateStatusBlurb (integration)', () => {
    // These tests are marked as skipped because they require OpenAI API access
    // They can be run manually with valid API credentials

    const mockTeamStatus: TeamStatus = {
      content: `# TEAM Memory
## Active Milestone
- Name: Discord Bot Status Updates (Issue #11)
- Status: Implementation in progress
## Completed Work
Fixed Docker build, added image support`,
    };

    test.skip('generates blurb from team status', async () => {
      // This test requires OPENAI_API_KEY environment variable
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
