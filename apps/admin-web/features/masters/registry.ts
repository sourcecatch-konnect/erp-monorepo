import { ComponentType } from "react";
import { IconBuilding, IconBuildingWarehouse, IconCategory, IconGitBranch, IconMapPin, IconMapPins, IconProps, IconTool, IconTruck, IconTruckDelivery, IconUsers, IconWorld } from "@tabler/icons-react";

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
  | "masters.company"
  | "masters.vehicle"
  | "masters.spare-category"
  | "masters.spare-part"
  | "masters.spare-part-supplier"
  | "masters.customer"
  | "masters.route"
  | "masters.branch"
  | "masters.warehouse";
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
},{
  slug: "spare-category",
  label: "Spare Category",
  icon: IconCategory,
  category: "Location",
  permissionKey: "masters.spare-category",
  page: () => import("./spare-category/page"),
},{
  slug: "spare-parts",
  label: "Spare Part",
  icon: IconTool,
  category: "Location",
  permissionKey: "masters.spare-part",
  page: () => import("./spare-parts/page"),
},{
  slug: "spare-part-supplier",
  label: "Spare Part Supplier",
  icon: IconTool,
  category: "Location",
  permissionKey: "masters.spare-part-supplier",
  page: () => import("./spare-partSuppiler/page"),
},
{
  slug: "customer",
  label: "Customer",
  icon: IconUsers,
  category: "Location",
  permissionKey: "masters.customer",
  page: () => import("./Customer/page"),
},
{
  slug: "company",
  label: "Company",
  icon: IconBuilding,
  category: "Location",
  permissionKey: "masters.company",
  page: () => import("./Company/page"),
},
{
  slug: "branch",
  label: "Branch",
  icon: IconGitBranch,
  category: "Location",
  permissionKey: "masters.branch",
  page: () => import("./branch/page"),
},
{
  slug: "route",
  label: "Route",
  icon: IconMapPins,
  category: "Location",
  permissionKey: "masters.route",
  page: () => import("./routes/page"),
},
{
  slug: "warehouse",
  label: "Warehouse",
  icon: IconBuildingWarehouse,
  category: "Location",
  permissionKey: "masters.warehouse",
  page: () => import("./warehouse/page"),
},
] satisfies MasterEntry[];

export type MasterKey = (typeof masterRegistry)[number]["slug"];
