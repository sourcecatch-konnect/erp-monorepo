/**
 * Cache namespace for `GET /billing/eligible-clients`. Eligibility is derived
 * from LR acknowledgement state, LR charges and bill lines, so every write on
 * the billing router *and* on the LR delivery/acknowledgement router bumps it
 * (see `invalidateCacheOnWrite` where those routers are declared).
 */
export const BILLING_ELIGIBILITY_CACHE = "billing-eligibility";
export const BILLING_ELIGIBILITY_TTL_SECONDS = 30;
