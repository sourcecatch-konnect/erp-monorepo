import { ComponentType } from "react";
import { IconMapPin, IconProps, IconWorld } from "@tabler/icons-react";

export type MasterCategory = "Location";

export type MasterEntry = {
  slug: string;
  label: string;
  icon: ComponentType<IconProps>;
  category: MasterCategory;
  permissionKey: "masters.state" | "masters.city";
  page: () => Promise<{ default: ComponentType }>;
};

export const masterRegistry = [
  {
    slug: "state",
    label: "State",
    icon: IconWorld,
    category: "Location",
    permissionKey: "masters.state",
    page: () => import("./state/page"),
  },
  {
    slug: "city",
    label: "City",
    icon: IconMapPin,
    category: "Location",
    permissionKey: "masters.city",
    page: () => import("./city/page"),
  },
] satisfies MasterEntry[];

export type MasterKey = (typeof masterRegistry)[number]["slug"];
