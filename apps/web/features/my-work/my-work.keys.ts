import type { MyWorkQueueKey, MyWorkScope } from "@skerp/types";

export const myWorkKeys = {
  all: ["my-work"] as const,
  overview: ["my-work", "overview"] as const,
  rows: (queue: MyWorkQueueKey, scope: MyWorkScope) =>
    ["my-work", "rows", queue, scope] as const,
};
