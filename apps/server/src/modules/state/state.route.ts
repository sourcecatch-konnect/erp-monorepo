import { Router } from "express";

import {
  createStateController,
  getStatesController,
  getStateByIdController,
  updateStateController,
  deleteStateController,
} from "./state.controller.js";

const router = Router();

// CREATE
router.post("/", createStateController);

// LIST
router.get("/", getStatesController);

// GET BY ID
router.get("/:id", getStateByIdController);

// UPDATE
router.patch("/:id", updateStateController);

// DELETE
router.delete("/:id", deleteStateController);

export default router;