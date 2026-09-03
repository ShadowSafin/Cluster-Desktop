import { describe, expect, it } from 'vitest';
import {
  computeOffsets,
  findStartIndex,
  computeVisibleRange,
} from './virtualization.js';

describe('virtualization algorithms', () => {
  describe('computeOffsets', () => {
    it('returns empty offsets for 0 items', () => {
      const res = computeOffsets(0, () => 50);
      expect(res.offsets).toEqual([]);
      expect(res.totalHeight).toBe(0);
    });

    it('computes correct prefix sums for uniform height items', () => {
      const res = computeOffsets(5, () => 100);
      expect(res.offsets).toEqual([0, 100, 200, 300, 400]);
      expect(res.totalHeight).toBe(500);
    });

    it('computes correct prefix sums for variable height items', () => {
      const heights = [40, 60, 100, 50];
      const res = computeOffsets(4, (i) => heights[i]);
      expect(res.offsets).toEqual([0, 40, 100, 200]);
      expect(res.totalHeight).toBe(250);
    });
  });

  describe('findStartIndex binary search', () => {
    const offsets = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900];

    it('finds index 0 at scrollTop = 0', () => {
      expect(findStartIndex(offsets, 0)).toBe(0);
    });

    it('finds exact index when offset matches', () => {
      expect(findStartIndex(offsets, 300)).toBe(3);
    });

    it('finds predecessor index when between offsets', () => {
      expect(findStartIndex(offsets, 350)).toBe(3);
      expect(findStartIndex(offsets, 399)).toBe(3);
      expect(findStartIndex(offsets, 401)).toBe(4);
    });

    it('finds last index when scroll is beyond last offset', () => {
      expect(findStartIndex(offsets, 1200)).toBe(9);
    });
  });

  describe('computeVisibleRange', () => {
    const offsets = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];

    it('handles empty items correctly', () => {
      const res = computeVisibleRange({
        itemsCount: 0,
        offsets: [],
        scrollTop: 0,
        viewportHeight: 300,
        getHeight: () => 50,
      });
      expect(res.virtualItems).toHaveLength(0);
      expect(res.startIndex).toBe(0);
      expect(res.endIndex).toBe(0);
    });

    it('computes visible slice plus overscan', () => {
      // scrollTop = 100 (index 2). viewport = 150 (covers index 2, 3, 4, up to offset 250).
      // overscan = 2 -> start = max(0, 2 - 2) = 0.
      // end = min(10, 4 + 2) = 6.
      const res = computeVisibleRange({
        itemsCount: 11,
        offsets,
        scrollTop: 100,
        viewportHeight: 150,
        overscan: 2,
        getHeight: () => 50,
      });

      expect(res.startIndex).toBe(0);
      expect(res.endIndex).toBe(7);
      expect(res.virtualItems).toHaveLength(8);
      expect(res.virtualItems[0]).toEqual({ index: 0, start: 0, size: 50 });
      expect(res.virtualItems[2]).toEqual({ index: 2, start: 100, size: 50 });
      expect(res.virtualItems[6]).toEqual({ index: 6, start: 300, size: 50 });
    });

    it('handles large scale items efficiently (10,000 items)', () => {
      const largeOffsets = computeOffsets(10000, () => 80);
      const res = computeVisibleRange({
        itemsCount: 10000,
        offsets: largeOffsets.offsets,
        scrollTop: 400000, // around item 5000
        viewportHeight: 800,
        overscan: 4,
        getHeight: () => 80,
      });

      // Item 5000 is at offset 400,000.
      // 800px viewport covers 10 items (5000 to 5009).
      // with overscan 4 on each side, ~18 items rendered out of 10,000!
      expect(res.virtualItems.length).toBeLessThan(25);
      expect(res.startIndex).toBe(4996);
      expect(res.virtualItems[0].start).toBe(4996 * 80);
    });
  });
});
