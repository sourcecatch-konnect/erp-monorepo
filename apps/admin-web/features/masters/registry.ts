import { ComponentType } from "react";
import { IconMapPin, IconMapPins, IconProps, IconSteeringWheel, IconTruck, IconTruckDelivery, IconWorld } from "@tabler/icons-react";

export type MasterCategory = "Location";

export type MasterEntry = {
  slug: string;
  label: string;
  icon: ComponentType<IconProps>;
  category: MasterCategory;
permissionKey:
  | "masters.state"
  | "masters.city"
  | "masters.area"
  | "masters.transport"
  | "masters.vehicle"
  | "masters.driver";
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
  },{
    slug: "area",
    label: "Area",
    icon: IconMapPins,
    category: "Location",
    permissionKey: "masters.area",
    page: () => import("./area/page"),
  },
  {
    slug: "transport",
    label: "Transport",
    icon: IconTruckDelivery,
    category: "Location",
    permissionKey: "masters.transport",
    page: () => import("./transport/page"),
  },{
  slug: "vehicle",
  label: "Vehicle",
  icon: IconTruck,
  category: "Location",
  permissionKey: "masters.vehicle",
  page: () => import("./vehicle/page"),
},
  {
    slug: "driver",
    label: "Driver",
    icon: IconSteeringWheel,
    category: "Location",
    permissionKey: "masters.driver",
    page: () => import("./driver/page"),
  },
] satisfies MasterEntry[];

export type MasterKey = (typeof masterRegistry)[number]["slug"];
