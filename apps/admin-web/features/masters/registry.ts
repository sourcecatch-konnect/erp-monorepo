import { cityApi } from "./city/city.service";
import { stateApi } from "./state/state.service";
import {
  CreateCityBody,
  CreateStateBody,
  UpdateCityBody,
  UpdateStateBody,
} from "@skerp/types";

/* ---------------- FIELD TYPES ---------------- */

type Field =
  | { name: string; label: string; type: "text" }
  | { name: string; label: string; type: "select"; optionsSource: string };

/* ---------------- MASTER CONFIG ---------------- */

type MasterConfig<TCreate, TUpdate> = {
  api: {
    create: (body: TCreate) => Promise<any>;
    update: (id: string, body: TUpdate) => Promise<any>;
    remove: (id: string) => Promise<void>;
  };
  queryKey: readonly string[];
  label: string;
  fields: Field[];
};

/* ---------------- REGISTRY ---------------- */

export const masterRegistry = {
  city: {
    api: cityApi,
    queryKey: ["cities"],
    label: "City",
    fields: [
      { name: "name", label: "City Name", type: "text" },
      {
        name: "stateId",
        label: "State",
        type: "select",
        optionsSource: "states",
      },
    ],
  },

  state: {
    api: stateApi,
    queryKey: ["states"],
    label: "State",
    fields: [{ name: "name", label: "State Name", type: "text" }],
  },
} satisfies {
  city: MasterConfig<CreateCityBody, UpdateCityBody>;
  state: MasterConfig<CreateStateBody, UpdateStateBody>;
};

/* ---------------- TYPES DERIVED FROM REGISTRY ---------------- */

export type MasterKey = keyof typeof masterRegistry;