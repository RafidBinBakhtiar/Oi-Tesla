/**
 * Business constants in one place. Every number here is documented in
 * docs/design.md; tests pin the Nusrat/Rafiq examples to these values.
 */
export const RULES = {
  /** ৳30 flag fall per ride request. */
  BASE_FARE_PAISA: 3_000,
  /** ৳20 per km per seat = 2 paisa per metre per seat. */
  DISTANCE_PAISA_PER_METRE_PER_SEAT: 2,
  /** Discount on the distance charge when the pool carries ≥ 2 ride requests. */
  POOL_DISCOUNT_PERCENT: 25,

  /** Battery-rickshaw cruising speed used to turn metres into seconds. */
  AVG_SPEED_KMH: 20,
  /** A request may join a pool only if its heading is within this of the pool's. */
  MAX_HEADING_DELTA_DEG: 60,
  /** No pooled rider may be delayed by more than this versus riding alone. */
  MAX_DETOUR_SECONDS: 300,

  MAX_SEATS_PER_REQUEST: 3,
} as const;
