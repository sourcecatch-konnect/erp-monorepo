"use client";

import * as React from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { IconMapPin, IconTrain } from "@tabler/icons-react";
import type { FleetVehicle, TrailPoint } from "@skerp/types";
import { cn } from "@/lib/utils";

import { formatLastUpdate } from "./tracking-ui";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
/** AdvancedMarker needs a map id; the demo id works without cloud styling. */
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const INDIA_CENTER = { lat: 22.9734, lng: 78.6569 };

type FleetMapProps = {
  vehicles: FleetVehicle[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  /** When set, the map renders this history trail instead of live markers. */
  trail?: TrailPoint[] | null;
  /** Index of the current playback point within `trail`. */
  trailIndex?: number;
};

/** Drives the camera in live mode: fit all markers once, then pan to selection. */
function LiveCamera({
  vehicles,
  selectedId,
}: {
  vehicles: FleetVehicle[];
  selectedId: number | null;
}) {
  const map = useMap();
  const fitted = React.useRef(false);

  React.useEffect(() => {
    if (!map || fitted.current) return;
    const located = vehicles.filter((v) => v.position);
    if (located.length === 0) return;

    const lats = located.map((v) => v.position!.latitude);
    const lngs = located.map((v) => v.position!.longitude);
    map.fitBounds(
      {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      },
      64,
    );
    fitted.current = true;
  }, [map, vehicles]);

  React.useEffect(() => {
    if (!map || selectedId == null) return;
    const target = vehicles.find((v) => v.id === selectedId);
    if (!target?.position) return;
    map.panTo({
      lat: target.position.latitude,
      lng: target.position.longitude,
    });
    if ((map.getZoom() ?? 0) < 12) map.setZoom(13);
  }, [map, selectedId, vehicles]);

  return null;
}

/** Overlays rail/transit lines — wagons always sit on a railway line. */
function RailLayer() {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");

  React.useEffect(() => {
    if (!map || !mapsLib) return;
    const layer = new mapsLib.TransitLayer();
    layer.setMap(map);
    return () => layer.setMap(null);
  }, [map, mapsLib]);

  return null;
}

/** Draws the full history polyline and fits the map to it once. */
function TrailLine({ trail }: { trail: TrailPoint[] }) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");

  React.useEffect(() => {
    if (!map || !mapsLib || trail.length === 0) return;

    const line = new mapsLib.Polyline({
      path: trail.map((p) => ({ lat: p.latitude, lng: p.longitude })),
      geodesic: true,
      strokeColor: "#2563EB",
      strokeOpacity: 0.85,
      strokeWeight: 4,
    });
    line.setMap(map);

    const lats = trail.map((p) => p.latitude);
    const lngs = trail.map((p) => p.longitude);
    map.fitBounds(
      {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      },
      64,
    );

    return () => line.setMap(null);
  }, [map, mapsLib, trail]);

  return null;
}

/** Assigned rakes use a train; unassigned devices use a tracker pin. */
function TrackerGlyph({
  online,
  assigned,
}: {
  online: boolean;
  assigned: boolean;
}) {
  return (
    <div
      className={cn(
        "flex size-8 translate-y-1/2 items-center justify-center rounded-full",
        "border-2 bg-card shadow-md",
        assigned
          ? online
            ? "border-green-600 text-green-700"
            : "border-slate-500 text-slate-600"
          : online
            ? "border-amber-500 text-amber-700"
            : "border-slate-400 text-slate-500",
      )}
    >
      {assigned ? (
        <IconTrain className="size-5" />
      ) : (
        <IconMapPin className="size-5" />
      )}
    </div>
  );
}

export function FleetMap({
  vehicles,
  selectedId,
  onSelect,
  trail,
  trailIndex = 0,
}: FleetMapProps) {
  if (!API_KEY) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable the live map.
      </div>
    );
  }

  const historyMode = Array.isArray(trail) && trail.length > 0;
  const located = vehicles.filter((v) => v.position);
  const selected = located.find((v) => v.id === selectedId) ?? null;
  const playPoint = historyMode
    ? trail[Math.min(trailIndex, trail.length - 1)]
    : null;

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        mapId={MAP_ID}
        defaultCenter={INDIA_CENTER}
        defaultZoom={5}
        gestureHandling="greedy"
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        className="h-full w-full"
      >
        <RailLayer />

        {historyMode ? (
          <>
            <TrailLine trail={trail} />
            {playPoint && (
              <AdvancedMarker
                position={{ lat: playPoint.latitude, lng: playPoint.longitude }}
                title="Wagon"
              >
                <TrackerGlyph online assigned />
              </AdvancedMarker>
            )}
          </>
        ) : (
          <>
            {located.map((v) => (
              <AdvancedMarker
                key={v.id}
                position={{
                  lat: v.position!.latitude,
                  lng: v.position!.longitude,
                }}
                title={
                  v.assignment
                    ? `${v.name} · ${v.assignment.installedOnVpNo ?? v.assignment.scheduleNumber}`
                    : `${v.name} · Unassigned tracker`
                }
                onClick={() => onSelect(v.id)}
              >
                <TrackerGlyph
                  online={v.status === "online"}
                  assigned={Boolean(v.assignment)}
                />
              </AdvancedMarker>
            ))}

            {selected?.position && (
              <InfoWindow
                position={{
                  lat: selected.position.latitude,
                  lng: selected.position.longitude,
                }}
                pixelOffset={[0, -36]}
                onCloseClick={() => onSelect(null)}
              >
                <div className="space-y-0.5 p-1">
                  <p className="text-sm font-semibold text-foreground">
                    {selected.name}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {selected.assignment
                      ? `${selected.assignment.scheduleNumber} · ${selected.assignment.installedOnVpNo ?? "VP not available"}`
                      : "Unassigned tracker · location only"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selected.position.speedKmph} km/h
                    {selected.vehicleNumber
                      ? ` · ${selected.vehicleNumber}`
                      : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatLastUpdate(selected.lastUpdate)}
                  </p>
                </div>
              </InfoWindow>
            )}

            <LiveCamera vehicles={located} selectedId={selectedId} />
          </>
        )}
      </Map>
    </APIProvider>
  );
}
