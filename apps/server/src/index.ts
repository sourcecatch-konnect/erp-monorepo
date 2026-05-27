import "./env.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoute from "./router/auth/auth.route.js";
import employeeRoute from "./router/employee/employee.route.js";
import lookupRoute from "./router/lookup/lookup.route.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import WarehousesRoute from "./modules/warehouse/warehouse.route.js"
import goodsRoute from "./modules/goods/goods.route.js"
import labourRoute from "./modules/labour/labour.route.js"
import pumpRoute from "./modules/pump/pump.route.js"
import wagonRoute from "./modules/wagon/wagon.type.js"
import RailwayFreightRoute from "./modules/railwayFraightMatrix/railwayFreightMatrix.route.js"
import agreementRoute from "./modules/agreements/agreement.route.js"
import rateMatrixRoute from "./modules/rateMatrix/rateMatrix.route.js"
import stateRoute from "./modules/state/state.route.js";
import cityRoute from "./modules/city/city.route.js";
import areaRoute from "./modules/area/area.route.js";
import transportRoute from "./modules/transport/transport.route.js";
import vehicleRoute from "./modules/vehicle/vehicle.route.js";
import driverRoute from "./modules/driver/driver.route.js";
import sparePartRoute from "./modules/spare-parts/spare-parts.route.js";
import spareCategory from "./modules/spare-catgory/spareCategory.route.js";
import sparePartSupplier from "./modules/spare-partSuppiler/spare-partSuppiler.route.js";
import CustomerRoute from "./modules/customer/customer.route.js";
import CompanyRoute from "./modules/company/company.route.js";
import BranchRoute from "./modules/branch/branch.route.js";
import Routes from "./modules/route/route.routes.js";
import ewaybillRoute from "./modules/ewaybill/ewaybill.route.js";
import adminRoute from "./modules/admin/admin.route.js";
const app = express();

// Reflect any origin (LAN, ngrok, etc). Wildcard "*" can't be used with
// credentials: true, so we echo the incoming Origin header instead.
app.use(
  cors({
    origin: (origin, callback) => callback(null, origin ?? true),
    credentials: true, // IMPORTANT
  }),
);
app.use(express.json());
app.use(cookieParser());
// routes
app.use("/health", healthRouter);
app.use("/auth", authRoute);
app.use("/employees", employeeRoute);
app.use("/states", stateRoute);
app.use("/cities", cityRoute);
app.use("/areas", areaRoute);
app.use("/transports", transportRoute);
app.use("/vehicles", vehicleRoute);
app.use("/drivers", driverRoute);
app.use("/spare-category", spareCategory);
app.use("/spare-parts", sparePartRoute);
app.use("/spare-part-suppliers",sparePartSupplier)
app.use("/customers",CustomerRoute)
app.use("/companies",CompanyRoute)
app.use("/branches", BranchRoute)
app.use("/routes",Routes)
app.use("/warehouses",WarehousesRoute)
app.use("/labours",labourRoute)
app.use("/rateMatrix",rateMatrixRoute)
app.use("/railway-freight", RailwayFreightRoute);
app.use("/goods",goodsRoute)
app.use("/wagons",wagonRoute)
app.use("/agreements",agreementRoute)
app.use("/pumps",pumpRoute)
app.use("/ewaybills", ewaybillRoute);
app.use("/admin", adminRoute);
app.use(errorMiddleware);
const PORT = 5000;

app.listen(PORT, () => {
  console.log(`SKERP server running on http://localhost:${PORT}`);
});
