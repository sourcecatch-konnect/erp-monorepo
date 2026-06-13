export const paiseToRupees = (value: number) => value / 100;

export const formatRupees = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(value);

export const formatPaise = (value: number) =>
  formatRupees(paiseToRupees(value));
