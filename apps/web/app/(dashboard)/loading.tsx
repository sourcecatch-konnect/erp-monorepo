import { TruckLoader } from "@skerp/ui/components/truck-loader";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <TruckLoader />
    </div>
  );
}
