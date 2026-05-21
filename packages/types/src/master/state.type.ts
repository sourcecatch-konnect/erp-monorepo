export interface State {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateStateBody = {
  name: string;
};

export type UpdateStateBody = {
  name?: string;
};