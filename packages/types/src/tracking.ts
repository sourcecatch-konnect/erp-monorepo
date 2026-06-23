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
};
