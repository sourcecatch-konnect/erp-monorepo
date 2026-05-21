import { Router } from "express";

import {
  createCityController,
  getCitiesController,
  getCityByIdController,
  updateCityController,
  deleteCityController,
} from "./city.controller.js";

const router = Router();

// CREATE
router.post("/", createCityController);

// LIST
router.get("/", getCitiesController);

// GET BY ID
router.get("/:id", getCityByIdController);

// UPDATE
router.patch("/:id", updateCityController);

// DELETE
router.delete("/:id", deleteCityController);

export default router;