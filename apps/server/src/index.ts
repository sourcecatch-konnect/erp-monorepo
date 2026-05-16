import "./env.js"
import express from "express";
import cors from "cors";

import authRoute from "./router/auth/auth.route.js"
import { healthRouter } from "./modules/health/health.routes.js";



const app = express();

app.use(
  cors({
    origin: "http://localhost:3001", // frontend URL
    credentials: true,              // IMPORTANT
  })
);
app.use(express.json());

// routes
app.use("/health", healthRouter);
app.use("/auth", authRoute);


const PORT = 5000;

app.listen(PORT, () => {
  console.log(`SKERP server running on http://localhost:${PORT}`);
});