import "./env.js"
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoute from "./router/auth/auth.route.js"
import employeeRoute from "./router/employee/employee.route.js"
import lookupRoute from "./router/lookup/lookup.route.js"
import { healthRouter } from "./modules/health/health.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import stateRoute from "./modules/state/state.route.js"
import cityRoute from "./modules/city/city.route.js"
import areaRoute from "./modules/area/area.route.js"
import transportRoute from "./modules/trasnport/transport.route.js"
import vehicleRoute from "./modules/vehicle/vehicle.route.js"
import sparePartRoute from "./modules/spare-parts/spare-parts.route.js"
import spareCategory from "./modules/spare-catgory/spareCategory.route.js"
import sparePartSupplier from "./modules/spare-partSuppiler/spare-partSuppiler.route.js"
import CustomerRoute from "./modules/customer/customer.route.js"
import CompanyRoute from "./modules/company/company.route.js"
import BranchRoute from "./modules/branch/branch.route.js"
import Routes from "./modules/route/route.routes.js"
import WarehousesRoute from "./modules/warehouse/warehouse.route.js"
const app = express();

// Dev origins for the admin (3001) and employee (3002) web apps.
const allowedOrigins = [
  "http://localhost:3001",
  "http://localhost:3002",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // IMPORTANT
  })
);
app.use(express.json());
app.use(cookieParser());
// routes
app.use("/health", healthRouter);
app.use("/auth", authRoute);
app.use("/employees", employeeRoute);
app.use("/states", stateRoute);
app.use("/cities",cityRoute)
app.use("/areas",areaRoute)
app.use("/transports",transportRoute)
app.use("/vehicles",vehicleRoute)
app.use("/spare-category",spareCategory)
app.use("/spare-parts", sparePartRoute);
app.use("/spare-part-suppliers",sparePartSupplier)
app.use("/customers",CustomerRoute)
app.use("/companies",CompanyRoute)
app.use("/branches", BranchRoute)
app.use("/routes",Routes)
app.use("/warehouses",WarehousesRoute)
app.use(errorMiddleware);
const PORT = 5000;

app.listen(PORT, () => {
  console.log(`SKERP server running on http://localhost:${PORT}`);
});
