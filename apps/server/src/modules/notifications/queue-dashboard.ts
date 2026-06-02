import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import type { Router } from "express";
import { notificationDeliveryQueue, notificationFanoutQueue } from "./queue.js";

/**
 * Bull-board UI for inspecting the notification queues (waiting / active /
 * completed / failed jobs). Mounted behind auth in index.ts.
 *
 * Returns the express router serving the dashboard at the given base path.
 */
export const createQueueDashboard = (basePath: string): Router => {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(basePath);

  createBullBoard({
    queues: [
      new BullMQAdapter(notificationFanoutQueue),
      new BullMQAdapter(notificationDeliveryQueue),
    ],
    serverAdapter,
  });

  return serverAdapter.getRouter() as unknown as Router;
};
