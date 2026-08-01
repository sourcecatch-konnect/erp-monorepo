export const railRakeKeys = {
  all: ["rail-rakes"] as const,
  detail: (rakeId: string) => ["rail-rakes", "detail", rakeId] as const,
  incoming: ["rail-rakes", "incoming"] as const,
};
