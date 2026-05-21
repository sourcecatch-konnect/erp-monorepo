import { db } from "../../../prisma/prisma.js";
import {
  CreateCityBody,
  UpdateCityBody,
} from "@skerp/types";

import {
  ConflictError,
  NotFoundError,
} from "../../lib/error.js";

export const createCityService = async (data: CreateCityBody) => {
  const existingCity = await db.city.findFirst({
    where: {
      name: data.name,
      stateId: data.stateId,
    },
  });

  if (existingCity) {
    throw new ConflictError("City already exists");
  }

  return db.city.create({
    data,
  });
};

export const getCitiesService = async () => {
  return db.city.findMany({
    include: {
      state: true, // optional but useful
    },
    orderBy: {
      name: "asc",
    },
  });
};

export const getCityByIdService = async (id: string) => {
  const city = await db.city.findUnique({
    where: { id },
    include: {
      state: true,
    },
  });

  if (!city) {
    throw new NotFoundError("City not found");
  }

  return city;
};

export const updateCityService = async (id: string, data: UpdateCityBody) => {
  await getCityByIdService(id);

  return db.city.update({
    where: { id },
    data,
  });
};

export const deleteCityService = async (id: string) => {
  await getCityByIdService(id);

  return db.city.delete({
    where: { id },
  });
};