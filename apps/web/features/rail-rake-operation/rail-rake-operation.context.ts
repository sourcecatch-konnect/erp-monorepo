import { PERMS } from "@skerp/types";

export type RailRakeOperationContext = "railhead" | "branch";

export const railRakeOperationContext = {
  railhead: {
    stage: "ORIGIN_RAILHEAD",
    title: "Rake & DC/WC at Rail Head",
    description: "Record the source railhead Rake movement and DC/WC.",
    basePath: "/vp-management/rake-at-rail-head",
    permissions: PERMS.RAKE_AT_RAIL_HEAD,
  },
  branch: {
    stage: "DESTINATION_BRANCH",
    title: "Rake & DC/WC at Branch",
    description: "Record the destination branch Rake movement and DC/WC.",
    basePath: "/vp-management/rake-at-branch",
    permissions: PERMS.RAKE_AT_BRANCH,
  },
} as const;
