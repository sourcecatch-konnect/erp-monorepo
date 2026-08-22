/**
 * VP (Vehicle Position) tracker types.
 *
 * Onelap's API is the Traccar GPS-server REST API. The server module
 * (`apps/server/src/modules/tracking`) logs into Onelap, fetches devices +
 * positions, and flattens them into the shapes below for the web feature.
 * Raw Traccar fields we don't use are dropped here.
 */

export type DeviceStatus = "online" | "offline" | "unknown";

export type DevicePosition = {
  /** Traccar position id. */
  positionId: number;
  latitude: number;
  longitude: number;
  /** Converted from Traccar knots to km/h. */
  speedKmph: number;
  /** Heading in degrees, 0 = north. */
  course: number;
  /** Reverse-geocoded address, when Onelap provides one. */
  address: string | null;
  /** ISO timestamp of the GPS fix. */
  fixTime: string | null;
};

/** A single breadcrumb in a history trail (`/api/reports/mini-route`). */
export type TrailPoint = {
  latitude: number;
  longitude: number;
  speedKmph: number;
  course: number;
  fixTime: string | null;
};

/** Live position pushed over the WebSocket; merged into the fleet by deviceId. */
export type LivePosition = {
  deviceId: number;
  latitude: number;
  longitude: number;
  speedKmph: number;
  course: number;
  fixTime: string | null;
};

export type FleetVehicle = {
  /** Onelap device id. */
  id: number;
  /** Device label, e.g. "SK-160". */
  name: string;
  /** GPS hardware IMEI. */
  uniqueId: string;
  status: DeviceStatus;
  /** ISO timestamp of the last device contact. */
  lastUpdate: string | null;
  /** Battery percentage (0–100) when reported. */
  battery: number | null;
  /** Vehicle number from device attributes, when set. */
  vehicleNumber: string | null;
  phone: string | null;
  /** Subscription validity date (YYYY-MM-DD). */
  validity: string | null;
  /** Latest known position, or null if the device has never reported one. */
  position: DevicePosition | null;
  /**
   * ERP rake journey currently represented by this physical tracker.
   * When absent, the location belongs only to an unassigned tracker and must
   * not be presented as the confirmed location of a wagon.
   */
  assignment?: TrackingAssignment;
};

export type TrackingAssignment = {
  id: string;
  vpScheduleId: string;
  scheduleNumber: string;
  scheduleName: string;
  installedOnMrRrRowId: string;
  installedOnVpNo: string | null;
  mrRrNumber: string | null;
  assignedAt: string;
  releasedAt: string | null;
  rake: {
    id: string;
    rakeNumber: string;
    status: string;
  } | null;
  route: {
    fromBranch: { id: string; name: string };
    toBranch: { id: string; name: string };
    sourceArea: { id: string; name: string };
    destinationArea: { id: string; name: string };
  };
};
