/** Participant Journey distance must fit the shared numeric(12, 2) column. */
export const MAX_ERASMUS_DISTANCE_KM = 9_999_999_999.99;

/** A complete allocation is 100%, stored in millionths of one percent. */
export const TOTAL_ALLOCATION_PERCENTAGE_UNITS = BigInt(100_000_000);

/** Shared validation and form limit for Claim review/payment correction reasons. */
export const MAX_CLAIM_REASON_LENGTH = 2_000;
