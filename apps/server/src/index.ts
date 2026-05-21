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
app.use("/", lookupRoute);
app.use("/states", stateRoute);
app.use("/cities",cityRoute)
app.use(errorMiddleware);
const PORT = 5000;

app.listen(PORT, () => {
  console.log(`SKERP server running on http://localhost:${PORT}`);
});
