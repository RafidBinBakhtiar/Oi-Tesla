import { describe, expect, it } from 'vitest';
import { ZONES } from '../../src/db/seedData';
import { bearingDeg, distanceM, headingDeltaDeg, travelSeconds } from '../../src/domain/geo';

const at = (code: string) => {
  const sub = ZONES.flatMap((z) => z.subLocations).find((s) => s.code === code);
  if (!sub) throw new Error(code);
  return sub;
};

const banani = at('BANANI_RD_11');
const mohakhali = at('MOHAKHALI');
const gulshan1 = at('GULSHAN_1');

describe('geo — the numbers quoted in docs/design.md', () => {
  it('measures the story distances in whole metres', () => {
    expect(distanceM(banani, mohakhali)).toBe(1789); // Nusrat
    expect(distanceM(banani, gulshan1)).toBe(1935); // Rafiq
    expect(distanceM(mohakhali, gulshan1)).toBe(1675);
  });

  it('is symmetric and zero for the same point', () => {
    expect(distanceM(mohakhali, banani)).toBe(distanceM(banani, mohakhali));
    expect(distanceM(banani, banani)).toBe(0);
  });

  it('gives compass bearings', () => {
    expect(bearingDeg(banani, mohakhali)).toBeCloseTo(194.2, 1);
    expect(bearingDeg(banani, gulshan1)).toBeCloseTo(140.9, 1);
    expect(bearingDeg({ lat: 23, lng: 90 }, { lat: 23.1, lng: 90 })).toBeCloseTo(0, 5); // due north
    expect(bearingDeg({ lat: 23, lng: 90 }, { lat: 23, lng: 90.1 })).toBeCloseTo(90, 5); // due east
  });

  it('computes the smallest heading difference across north', () => {
    expect(headingDeltaDeg(350, 10)).toBe(20);
    expect(headingDeltaDeg(10, 350)).toBe(20);
    expect(headingDeltaDeg(0, 180)).toBe(180);
    expect(headingDeltaDeg(194.2, 140.9)).toBeCloseTo(53.3, 1);
  });

  it('converts metres to seconds at 20 km/h', () => {
    expect(travelSeconds(1000)).toBeCloseTo(180);
    expect(travelSeconds(1529)).toBeCloseTo(275.22);
  });
});
