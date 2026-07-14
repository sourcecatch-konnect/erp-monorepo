import "./lib/bigint-json.js";
import "./env.js";
import express from "express";
import { createServer } from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoute from "./router/auth/auth.route.js";
import employeeRoute from "./router/employee/employee.route.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import WarehousesRoute from "./modules/warehouse/warehouse.route.js";
import goodsRoute from "./modules/goods/goods.route.js";
import unitOfMeasureRoute from "./modules/unit-of-measure/unit-of-measure.route.js";
import labourRoute from "./modules/labour/labour.route.js";
import pumpRoute from "./modules/pump/pump.route.js";
import wagonRoute from "./modules/wagon/wagon.route.js";
import RailwayFreightRoute from "./modules/railwayFraightMatrix/railwayFreightMatrix.route.js";
import agreementRoute from "./modules/agreements/agreement.route.js";
import rateMatrixRoute from "./modules/rateMatrix/rateMatrix.route.js";
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
import vehicleTypeRoute from "./modules/vehicleType/vehicleType.route.js";
import orderRoute from "./modules/order/order.route.js";
import tripRoute from "./modules/trip/trip.route.js";
import vehicleJourneyRoute from "./modules/vehicle-journey/vehicle-journey.route.js";
import tripExpenseRoute from "./modules/trip-expense/trip-expense.route.js";
import driverAdvanceRoute from "./modules/trip-expense/driver-advance.route.js";
import logSlipRoute from "./modules/log-slip/log-slip.route.js";
import lorryReceiptRoute from "./modules/lorry-receipt/lorry-receipt.route.js";
import lrDeliveryRoute from "./modules/lorry-receipt/lr-delivery.route.js";
import lrGroupRoute from "./modules/lr-group/lr-group.route.js";
import CompanyRoute from "./modules/company/company.route.js";
import BranchRoute from "./modules/branch/branch.route.js";
import Routes from "./modules/route/route.routes.js";
import ewaybillRoute from "./modules/ewaybill/ewaybill.route.js";
import adminRoute from "./modules/admin/admin.route.js";
import notificationRoute from "./modules/notifications/notification.route.js";
import attachmentRoute from "./modules/attachments/attachment.route.js";
import trackingRoute from "./modules/tracking/tracking.route.js";
import vpScheduleRoute from "./modules/vp-schedule/vp-schedule.route.js";
import creditorRoute from "./modules/creditor/creditor.route.js";
import cashAccountRoute from "./modules/cash-account/cash-account.route.js";
import cashPlanningRoute from "./modules/cash-planning/cash-planning.route.js";
import { initNotificationRealtime } from "./modules/notifications/realtime.js";
import { initTrackingRealtime } from "./modules/tracking/tracking.realtime.js";
import { startNotificationWorkers } from "./modules/notifications/worker.js";
import { startDeliverySweeps } from "./modules/lorry-receipt/lr-delivery.sweeps.js";
import { seedNotificationDefaults } from "./modules/notifications/notification.seed.js";
import { createQueueDashboard } from "./modules/notifications/queue-dashboard.js";
import MRRRRoute from "./modules/mrrr/mrrr.route.js";
import { authMiddleware } from "./middlewares/auth.middlware.js";
import { getRedisConnectionOptions } from "./modules/notifications/redis.js";
import { ensurePermissionCatalog } from "./auth/permission-catalog.js";
import grnRoute from "./modules/grn/grn.route.js";
import tablePrefRoute from "./modules/user-pref/table-pref.route.js";
const app = express();

// Reflect any origin (LAN, ngrok, etc). Wildcard "*" can't be used with
// credentials: true, so we echo the incoming Origin header instead.
app.use(
  cors({
    origin: (origin, callback) => callback(null, origin ?? true),
    credentials: true, // IMPORTANT
  }),
);
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  }),
);
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
app.use("/vehicle-types", vehicleTypeRoute);
app.use("/orders", orderRoute);
app.use("/trips", tripRoute);
app.use("/vehicle-journeys", vehicleJourneyRoute);
app.use("/trip-expenses", tripExpenseRoute);
app.use("/driver-advances", driverAdvanceRoute);
app.use("/log-slips", logSlipRoute);
app.use("/tracking", trackingRoute);
// Delivery/ack router first: it owns literal subpaths (e.g. /worklists/...)
// that the main router's GET /:id would otherwise swallow.
app.use("/lorry-receipts", lrDeliveryRoute);
app.use("/lorry-receipts", lorryReceiptRoute);
app.use("/lr-groups", lrGroupRoute);
app.use("/drivers", driverRoute);
app.use("/spare-category", spareCategory);
app.use("/spare-parts", sparePartRoute);
app.use("/spare-part-suppliers", sparePartSupplier);
app.use("/customers", CustomerRoute);
app.use("/companies", CompanyRoute);
app.use("/branches", BranchRoute);
app.use("/routes", Routes);
app.use("/warehouses", WarehousesRoute);
app.use("/labours", labourRoute);
app.use("/rateMatrix", rateMatrixRoute);
app.use("/railway-freight", RailwayFreightRoute);
app.use("/goods", goodsRoute);
app.use("/unit-of-measures", unitOfMeasureRoute);
app.use("/wagons", wagonRoute);
app.use("/agreements", agreementRoute);
app.use("/pumps", pumpRoute);
app.use("/creditors", creditorRoute);
app.use("/cash-accounts", cashAccountRoute);
app.use("/cash-planning", cashPlanningRoute);
app.use("/ewaybills", ewaybillRoute);
app.use("/admin", adminRoute);
app.use("/notifications", notificationRoute);
app.use("/attachments", attachmentRoute);
app.use("/vp-schedules", vpScheduleRoute);
app.use("/mrrr", MRRRRoute);
app.use("/grn", grnRoute);
app.use("/me/table-prefs", tablePrefRoute);
// BullMQ dashboard — inspect notification queues at /admin/queues (login required)
app.use("/admin/queues", authMiddleware, createQueueDashboard("/admin/queues"));
app.use(errorMiddleware);
// Fix BigInt serialization
app.set("json replacer", (_key: string, value: unknown) =>
  typeof value === "bigint" ? Number(value) : value,
);
const PORT = Number(process.env.PORT || 5000);
const server = createServer(app);

async function bootstrap() {
  await ensurePermissionCatalog();

  const io = initNotificationRealtime(server);
  initTrackingRealtime(io);
  startNotificationWorkers();
  startDeliverySweeps();

  seedNotificationDefaults().catch((error) => {
    console.error("[notifications] Failed to seed defaults:", error);
  });

  server.listen(PORT, () => {
    console.log(`SKERP server running on http://localhost:${PORT}`);

    const redis = getRedisConnectionOptions();
    console.log(
      `[notifications] BullMQ workers connected to Redis at ${redis.host}:${redis.port} — dashboard at http://localhost:${PORT}/admin/queues`,
    );
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
