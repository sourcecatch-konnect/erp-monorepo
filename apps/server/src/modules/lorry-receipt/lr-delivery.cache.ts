/**
 * Cache namespace for `GET /lorry-receipts/worklists/delivery-stats`.
 * Delivery/acknowledgement writes (this module) and LR-group writes (which also
 * create deliveries) invalidate it; the TTL covers anything else.
 */
export const LR_DELIVERY_STATS_CACHE = "lr-delivery-stats";
export const LR_DELIVERY_STATS_TTL_SECONDS = 30;
