import { db } from "../../../prisma/prisma.js";
import {
  CreateStateBody,
  UpdateStateBody,
} from "@skerp/types";

import {
  ConflictError,
  NotFoundError,
} from "../../lib/error.js";

export const createStateService = async (
  data: CreateStateBody
) => {
  const existingState = await db.state.findUnique({
    where: {
      name: data.name,
    },
  });

  if (existingState) {
    throw new ConflictError(
      "State already exists"
    );
  }

  return db.state.create({
    data,
  });
};

export const getStatesService = async () => {
  return db.state.findMany({
    orderBy: {
      name: "asc",
    },
  });
};

export const getStateByIdService = async (
  id: string
) => {
  const state = await db.state.findUnique({
    where: {
      id,
    },
  });

  if (!state) {
    throw new NotFoundError(
      "State not found"
    );
  }

  return state;
};

export const updateStateService = async (
  id: string,
  data: UpdateStateBody
) => {
  await getStateByIdService(id);

  return db.state.update({
    where: {
      id,
    },
    data,
  });
};

export const deleteStateService = async (
  id: string
) => {
  await getStateByIdService(id);

  return db.state.delete({
    where: {
      id,
    },
  });
};