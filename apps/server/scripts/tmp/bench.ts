import { QUEUES } from "../../src/modules/my-work/queues.js";
const req = { ctx: { branchScope: "ALL", branchIds: [], permissions: new Set() } } as never;
const time = async (label: string, fn: () => Promise<unknown>) => {
  const runs: number[] = [];
  for (let i = 0; i < 4; i++) { const t = performance.now(); await fn(); runs.push(performance.now() - t); }
  runs.shift(); // first run warms the connection pool
  runs.sort((a, b) => a - b);
  console.log(label.padEnd(28), "median", Math.round(runs[1]!), "ms");
};
const now = new Date();
await time("overview (summarise x21)", () => Promise.all(QUEUES.map((q) => q.summarise(req, now))));
await time("list page 1 (band x21)", () => Promise.all(QUEUES.map((q) => q.band(req, { scope: "active", urgency: "all", search: "" }, 0, 10, now))));
process.exit(0);
