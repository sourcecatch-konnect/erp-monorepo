"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { Area, CreateAreaBody, City } from "@skerp/types";
import { createAreaSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";

import { IconMapPin } from "@tabler/icons-react";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { areaApi } from "./area.service";
import { areaKeys } from "./area.key";
import CitySelectField from "../_shared/fields/CitySelectField";

declare global {
  interface Window {
    initGoogleAutocomplete?: () => void;
  }
}

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Area | null;
};

const defaultValues: CreateAreaBody = {
  name: "",
  cityId: "",
  googlePlaceId: null,
  formattedAddress: null,
  latitude: null,
  longitude: null,
};

const getAreaNameFromAddress = (address: string, cityName?: string) => {
  if (!cityName) return address;

  const areaName = address.split(cityName).at(0) ?? address;

  return areaName.replace(/,\s*$/, "").trim() || address;
};

export default function AreaForm({ open, onOpenChange, row }: Props) {
  const form = useForm<CreateAreaBody>({
    resolver: zodResolver(createAreaSchema),
    defaultValues,
  });

  const { create, update } = useMasterMutations({
    api: areaApi,
    queryKey: areaKeys.all,
    entityName: "Area",
  });

  const handleSubmit = async (data: CreateAreaBody) => {
    if (row) {
      await update.mutateAsync({ id: row.id, data });
    } else {
      await create.mutateAsync(data);
    }

    onOpenChange(false);
  };
  const areaInputRef = React.useRef<HTMLInputElement | null>(null);
  const autocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(
    null,
  );

  const [selectedCity, setSelectedCity] = React.useState<Pick<
    City,
    "id" | "name"
  > | null>(null);
  const previousCityIdRef = React.useRef<string>("");
  const latitude = form.watch("latitude");
  const longitude = form.watch("longitude");

  const hasMapLocation =
    typeof latitude === "number" && typeof longitude === "number";

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

    const initialCity = row?.city
      ? {
          id: row.city.id,
          name: row.city.name,
        }
      : null;

    setSelectedCity(initialCity);
    previousCityIdRef.current = row?.cityId ?? "";
  }, [form, open, row]);
  const handleCityChange = React.useCallback(
    (city: Pick<City, "id" | "name"> | null) => {
      const nextCityId = city?.id ?? "";
      const previousCityId = previousCityIdRef.current;

      setSelectedCity(city);

      if (previousCityId && previousCityId !== nextCityId) {
        form.setValue("name", "", {
          shouldDirty: true,
          shouldValidate: true,
        });

        form.setValue("googlePlaceId", null, {
          shouldDirty: true,
        });

        form.setValue("formattedAddress", null, {
          shouldDirty: true,
        });

        form.setValue("latitude", null, {
          shouldDirty: true,
        });

        form.setValue("longitude", null, {
          shouldDirty: true,
        });
      }

      previousCityIdRef.current = nextCityId;
    },
    [form],
  );
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
          strictBounds: false,
        },
      );

      inputElement.addEventListener("keydown", (event) => {
        if (event.key === "Enter") event.preventDefault();
      });

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace?.();

        if (!place) {
          return;
        }

        const selectedAddress = place.formatted_address ?? place.name ?? "";

        if (!selectedAddress) {
          return;
        }

        const areaName = getAreaNameFromAddress(
          selectedAddress,
          selectedCity?.name,
        );

        form.setValue("name", areaName, {
          shouldDirty: true,
          shouldValidate: true,
        });

        form.setValue("googlePlaceId", place.place_id ?? null, {
          shouldDirty: true,
        });

        form.setValue("formattedAddress", selectedAddress || null, {
          shouldDirty: true,
        });

        form.setValue("latitude", place.geometry?.location?.lat?.() ?? null, {
          shouldDirty: true,
        });

        form.setValue("longitude", place.geometry?.location?.lng?.() ?? null, {
          shouldDirty: true,
        });
      });
    };

    if (window.google?.maps?.places) {
      initAutocomplete();
      return;
    }

    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleAutocomplete`;
      script.async = true;
      script.defer = true;

      window.initGoogleAutocomplete = initAutocomplete;
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", initAutocomplete);
    }

    return () => {
      delete window.initGoogleAutocomplete;
    };
  }, [form, open, selectedCity?.name]);

  React.useEffect(() => {
    if (
      !open ||
      !selectedCity?.name ||
      !window.google?.maps ||
      !autocompleteRef.current
    ) {
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    const autocomplete = autocompleteRef.current;

    geocoder.geocode(
      { address: `${selectedCity.name}, India` },
      (results, status) => {
        if (status !== "OK" || !results?.[0]?.geometry?.viewport) return;

        autocomplete.setBounds(results[0].geometry.viewport);
        autocomplete.setOptions({
          strictBounds: false,
        });
      },
    );
  }, [open, selectedCity?.name]);

  return (
    <MasterFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Area" : "Add Area"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={create.isPending || update.isPending}
      columns={2}
    >
      <FormSection
        icon={<IconMapPin size={18} />}
        title="Area Information"
        description="Search and select the area from Google Places"
      >
        <CitySelectField<CreateAreaBody>
          name="cityId"
          label="City"
          required
          initialCity={
            row?.city
              ? {
                  id: row.city.id,
                  name: row.city.name,
                }
              : null
          }
          onCityChange={handleCityChange}
        />
        <TextField<CreateAreaBody>
          name="name"
          label="Area"
          placeholder={
            selectedCity
              ? `Search area in ${selectedCity.name}`
              : "Select city first"
          }
          required
          inputRef={areaInputRef}
          disabled={!selectedCity}
        />
        {hasMapLocation ? (
          <div className="col-span-2 overflow-hidden rounded-lg border bg-muted/20">
            <div className="border-b px-3 py-2">
              <p className="text-sm font-medium">Location Preview</p>
              <p className="text-xs text-muted-foreground">
                Map preview based on the selected Google location
              </p>
            </div>

            <iframe
              title="Area location map"
              className="h-[220px] w-full border-0"
              loading="lazy"
              src={`https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`}
            />
          </div>
        ) : null}
      </FormSection>
    </MasterFormDialog>
  );
}
