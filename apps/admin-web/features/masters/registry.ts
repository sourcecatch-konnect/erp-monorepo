import { ComponentType } from "react";
import { IconBox, IconBuilding, IconBuildingWarehouse, IconCategory, IconGitBranch,IconGasStation ,IconMapPin, IconMapPins, IconProps, IconSteeringWheel, IconTool, IconTruck, IconTruckDelivery, IconUsers, IconWorld, IconTrain } from "@tabler/icons-react";

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
  | "masters.wagon"
  | "masters.company"
  | "masters.vehicle"
  | "masters.spare-category"
  | "masters.spare-part"
  | "masters.spare-part-supplier"
  | "masters.customer"
  | "masters.route"
  | "masters.branch"
  | "masters.driver"
  | "masters.labour"
  | "masters.rate-matrix"
  | "masters.agreement"
  | "masters.goods"
  | "masters.railwayFreightMatrix"
  | "masters.warehouse"
  | "masters.pump";
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
  {
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
  {
    slug: "driver",
    label: "Driver",
    icon: IconSteeringWheel,
    category: "Location",
    permissionKey: "masters.driver",
    page: () => import("./driver/page"),
  },
  {
  slug: "labour",
  label: "Labour",
  icon: IconUsers,
  category: "Location",
  permissionKey: "masters.labour",
  page: () => import("./labour/page"),
},{
  slug: "goods",
  label: "Goods",
  icon: IconBox, // or IconPackage if you prefer
  category: "Location",
  permissionKey: "masters.goods",
  page: () => import("./Goods/page"),
},
{
  slug: "pumps",
  label: "Pump",
  icon: IconGasStation,
  category: "Location",
  permissionKey: "masters.pump",
  page: () => import("./Pump/page"),
},
{
  slug: "wagons",
  label: "Wagon",
  icon: IconTrain,
  category: "Location",
  permissionKey: "masters.wagon",
  page: () => import("./wagon/page"),
},
{
  slug: "railway-freight",
  label: "Railway Freight",
  icon: IconTrain,
  category: "Location",
  permissionKey: "masters.railwayFreightMatrix", // or create: "masters.railway-freight"
  page: () => import("./railwayfreightMatrix/page"),
},{
  slug: "agreement",
  label: "Agreement",
  icon: IconBuilding,
  category: "Location",
  permissionKey: "masters.agreement", // or better: "masters.agreement"
  page: () => import("./Agreements/page"),
},{
  slug: "rate-matrix",
  label: "Rate Matrix",
  icon: IconGitBranch, // or IconGitBranch / IconCategory if you prefer
  category: "Location",
  permissionKey: "masters.rate-matrix", // or better: "masters.rate-matrix"
  page: () => import("./rateMatrix/page"),
},
] satisfies MasterEntry[];

export type MasterKey = (typeof masterRegistry)[number]["slug"];
