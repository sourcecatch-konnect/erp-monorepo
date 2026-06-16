"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { Area, CreateAreaBody, City } from "@skerp/types";
import { createAreaSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";
import SelectField from "../_shared/fields/SelectField";

import { IconMapPin } from "@tabler/icons-react";
declare global {
  interface Window {
    google?: {
      maps?: {
        Geocoder: new () => {
          geocode: (
            request: { address: string },
            callback: (
              results:
                | {
                    geometry?: {
                      viewport?: unknown;
                    };
                  }[]
                | null,
              status: string
            ) => void
          ) => void;
        };
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            options?: {
              fields?: string[];
              componentRestrictions?: { country: string };
              strictBounds?: boolean;
              bounds?: unknown;
            }
          ) => {
            addListener: (eventName: string, handler: () => void) => void;
            getPlace: () => {
              name?: string;
              place_id?: string;
              formatted_address?: string;
              geometry?: {
                location?: {
                  lat: () => number;
                  lng: () => number;
                };
              };
            };
            setBounds: (bounds: unknown) => void;
          };
        };
      };
    };
    initGoogleAutocomplete?: () => void;
  }
}
type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Area | null;
  cities: City[];
  onSubmit: (data: CreateAreaBody) => Promise<void>;
  isSubmitting?: boolean;
};

const defaultValues: CreateAreaBody = {
  name: "",
  cityId: "",
  googlePlaceId: null,
  formattedAddress: null,
  latitude: null,
  longitude: null,
};

export default function AreaForm({
  open,
  onOpenChange,
  row,
  cities,
  onSubmit,
  isSubmitting,
}: Props) {
  const form = useForm<CreateAreaBody>({
    resolver: zodResolver(createAreaSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (!open) return;

form.reset({
  name: row?.name ?? "",
  cityId: row?.cityId ?? "",
  googlePlaceId: row?.googlePlaceId ?? null,
  formattedAddress: row?.formattedAddress ?? null,
  latitude: row?.latitude ?? null,
  longitude: row?.longitude ?? null,
});
  }, [form, open, row]);
const areaInputRef = React.useRef<HTMLInputElement | null>(null);
const autocompleteRef = React.useRef<any>(null);

const selectedCityId = form.watch("cityId");
const selectedCity = cities.find((city) => city.id === selectedCityId);

React.useEffect(() => {
  if (!open) return;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("Google Maps API key is missing");
    return;
  }

  const scriptId = "google-maps-places-script";

  const initAutocomplete = () => {
    const inputElement = areaInputRef.current;
    if (!window.google?.maps?.places || !inputElement) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      inputElement,
      {
        fields: ["place_id", "name", "formatted_address", "geometry"],
        componentRestrictions: { country: "in" },
        strictBounds: true,
      } as any
    );

    inputElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter") e.preventDefault();
    });

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current.getPlace();

      form.setValue("name", place.name ?? "", {
        shouldDirty: true,
        shouldValidate: true,
      });

      form.setValue("googlePlaceId", place.place_id ?? null, {
        shouldDirty: true,
      });

      form.setValue("formattedAddress", place.formatted_address ?? null, {
        shouldDirty: true,
      });

      form.setValue("latitude", place.geometry?.location?.lat() ?? null, {
        shouldDirty: true,
      });

      form.setValue("longitude", place.geometry?.location?.lng() ?? null, {
        shouldDirty: true,
      });
    });
  };

  if (window.google?.maps?.places) {
    setTimeout(initAutocomplete, 100);
    return;
  }

  let script = document.getElementById(scriptId) as HTMLScriptElement | null;

  if (!script) {
    script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleAutocomplete`;
    script.async = true;
    script.defer = true;

    (window as any).initGoogleAutocomplete = initAutocomplete;
    document.head.appendChild(script);
  } else {
    script.addEventListener("load", () => setTimeout(initAutocomplete, 100));
  }

  return () => {
    delete (window as any).initGoogleAutocomplete;
  };
}, [open, form]);
React.useEffect(() => {
  if (!open || !selectedCity?.name || !window.google?.maps || !autocompleteRef.current) {
    return;
  }

  const geocoder = new window.google.maps.Geocoder();

  geocoder.geocode(
    {
      address: `${selectedCity.name}, India`,
    },
    (results: any, status: string) => {
      if (status !== "OK" || !results?.[0]?.geometry?.viewport) return;

      autocompleteRef.current.setBounds(results[0].geometry.viewport);
    }
  );
}, [open, selectedCity?.name]);
  return (
    <MasterFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Area" : "Add Area"}
      form={form}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      columns={2}
    >
      {/* AREA INFO SECTION */}
      <FormSection
        icon={<IconMapPin size={18} />}
        title="Area Information"
        description="Basic details of the area"
      >
      <SelectField<CreateAreaBody>
  name="cityId"
  label="City"
  options={cities.map((city) => ({
    label: city.name,
    value: city.id,
  }))}
  required
/>

<TextField<CreateAreaBody>
  name="name"
  label="Area Name"
  placeholder={selectedCity ? `Search area in ${selectedCity.name}` : "Select city first"}
  required
  inputRef={areaInputRef}
/>
      </FormSection>

    </MasterFormDialog>
  );
}