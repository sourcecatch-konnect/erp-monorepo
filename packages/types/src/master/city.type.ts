export interface City {
  id: string;
  name: string;
  stateId: string;
   state?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}
export type CreateCityBody = {
  name: string;
  stateId: string;
};

export type UpdateCityBody = {
  name?: string;
  stateId?: string;
};