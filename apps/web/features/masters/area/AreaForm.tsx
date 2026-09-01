"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type {
  Area,
  CreateAreaBody,
  CreateAreaFormInput,
  City,
} from "@skerp/types";
import { createAreaSchema } from "@skerp/validators";

import MasterFormDialog from "../_shared/MasterFormDialog";
import FormSection from "../_shared/fields/FormSection";
import TextField from "../_shared/fields/TextField";
import SwitchField from "../_shared/fields/SwitchField";

import {
  IconAlertTriangle,
  IconCheck,
  IconMapPin,
  IconTrain,
} from "@tabler/icons-react";
import { useMasterMutations } from "../_shared/hooks/useMasterMutation";
import { areaApi } from "./area.service";
import { areaKeys } from "./area.key";
import CitySelectField from "../_shared/fields/CitySelectField";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row?: Area | null;
};

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-places-script";
let googlePlacesLoadPromise: Promise<void> | null = null;

const loadGooglePlaces = (apiKey: string): Promise<void> => {
  if (window.google?.maps?.places) return Promise.resolve();
  if (googlePlacesLoadPromise) return googlePlacesLoadPromise;

  googlePlacesLoadPromise = new Promise<void>((resolve, reject) => {
    const finishLoading = async () => {
      try {
        if (!window.google?.maps) {
          throw new Error("Google Maps did not initialise");
        }

        if (!window.google.maps.places && window.google.maps.importLibrary) {
          await window.google.maps.importLibrary("places");
        }

        if (!window.google.maps.places) {
          throw new Error("Google Places library is unavailable");
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]',
    );

    if (existingScript) {
      existingScript.addEventListener("load", finishLoading, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Unable to load Google Maps")),
        { once: true },
      );

      if (window.google?.maps) void finishLoading();
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", finishLoading, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Unable to load Google Maps")),
      { once: true },
    );
    document.head.appendChild(script);
  }).catch((error) => {
    googlePlacesLoadPromise = null;
    throw error;
  });

  return googlePlacesLoadPromise;
};

const normalizeLocationName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("en-IN");
const getAddressComponent = (
  place: google.maps.places.PlaceResult,
  types: string[],
) =>
  place.address_components?.find((component) =>
    component.types.some((type) => types.includes(type)),
  )?.long_name;

const getAreaDisplayName = (
  place: google.maps.places.PlaceResult,
): string => {
  const placeName = place.name?.trim() ?? "";

  const locality = getAddressComponent(place, [
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
  ]);

  const city = getAddressComponent(place, [
    "locality",
    "postal_town",
    "administrative_area_level_3",
    "administrative_area_level_2",
  ]);

  const uniqueParts: string[] = [];

  for (const part of [placeName, locality, city]) {
    if (
      part &&
      !uniqueParts.some(
        (existing) =>
          normalizeLocationName(existing) === normalizeLocationName(part),
      )
    ) {
      uniqueParts.push(part);
    }
  }

  return uniqueParts.join(", ");
};
const placeMatchesCity = (
  place: google.maps.places.PlaceResult,
  cityName: string,
) => {
  const expectedCity = normalizeLocationName(cityName);
  const locationComponents = place.address_components ?? [];
  const relevantTypes = new Set([
    "locality",
    "postal_town",
    "administrative_area_level_2",
    "administrative_area_level_3",
    "sublocality",
    "sublocality_level_1",
  ]);

  const componentMatches = locationComponents.some(
    (component) =>
      component.types.some((type) => relevantTypes.has(type)) &&
      normalizeLocationName(component.long_name) === expectedCity,
  );

  if (componentMatches) return true;

  return normalizeLocationName(place.formatted_address ?? "").includes(
    expectedCity,
  );
};

const defaultValues: CreateAreaFormInput = {
  name: "",
  cityId: "",
  isRailHead: false,
  googlePlaceId: null,
  formattedAddress: null,
  latitude: null,
  longitude: null,
};

export default function AreaForm({ open, onOpenChange, row }: Props) {
  const form = useForm<CreateAreaFormInput, unknown, CreateAreaBody>({
    resolver: zodResolver(createAreaSchema),
    defaultValues,
  });
  const initialCity = React.useMemo<Pick<City, "id" | "name"> | null>(
    () =>
      row?.city
        ? {
          id: row.city.id,
          name: row.city.name,
        }
        : null,
    [row?.city?.id, row?.city?.name],
  );
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
  const selectedCityRef = React.useRef<Pick<City, "id" | "name"> | null>(null);

  const [selectedCity, setSelectedCity] = React.useState<Pick<
    City,
    "id" | "name"
  > | null>(null);
  const [googleLoadError, setGoogleLoadError] = React.useState<string | null>(
    null,
  );
  const [locationWarning, setLocationWarning] = React.useState<string | null>(
    null,
  );
  const previousCityIdRef = React.useRef<string>("");
  const areaName = form.watch("name");
  const googlePlaceId = form.watch("googlePlaceId");
  const formattedAddress = form.watch("formattedAddress");
  const latitude = form.watch("latitude");
  const longitude = form.watch("longitude");

  const hasMapLocation =
    typeof latitude === "number" && typeof longitude === "number";
  const hasLinkedGoogleLocation = Boolean(
    googlePlaceId && formattedAddress && hasMapLocation,
  );

  const linkedGoogleNameRef = React.useRef<string | null>(null);
  const clearGoogleLocation = React.useCallback(() => {
    linkedGoogleNameRef.current = null;

    form.setValue("googlePlaceId", null, { shouldDirty: true });
    form.setValue("formattedAddress", null, { shouldDirty: true });
    form.setValue("latitude", null, { shouldDirty: true });
    form.setValue("longitude", null, { shouldDirty: true });

    setLocationWarning(null);
  }, [form]);
  React.useEffect(() => {
    if (!open) return;

    form.reset({
      name: row?.name ?? "",
      cityId: row?.cityId ?? "",
      isRailHead: row?.isRailHead ?? false,
      googlePlaceId: row?.googlePlaceId ?? null,
      formattedAddress: row?.formattedAddress ?? null,
      latitude: row?.latitude ?? null,
      longitude: row?.longitude ?? null,
    });

    setSelectedCity(initialCity);
    selectedCityRef.current = initialCity;
    previousCityIdRef.current = row?.cityId ?? "";

    setGoogleLoadError(null);
    setLocationWarning(null);
  }, [
    open,
    row?.id,
    initialCity,
    form,
  ]);

  const handleCityChange = React.useCallback(
    (city: Pick<City, "id" | "name"> | null) => {
      const nextCityId = city?.id ?? "";
      const previousCityId = previousCityIdRef.current;

      // The paginated City selector can briefly report no resolved option while
      // it loads an existing form value. Do not treat that transient state as a
      // deliberate city change and erase a saved Google location.
      if (!city && form.getValues("cityId")) return;

      setSelectedCity(city);
      selectedCityRef.current = city;

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

        setLocationWarning(null);
      }

      previousCityIdRef.current = nextCityId;
    },
    [form],
  );

  React.useEffect(() => {
    if (!open) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      setGoogleLoadError(
        "Google location search is unavailable because the Maps API key is not configured.",
      );
      return;
    }

    let disposed = false;
    let autocomplete: google.maps.places.Autocomplete | null = null;
    let placeChangedListener: google.maps.MapsEventListener | null = null;
    let inputElement: HTMLInputElement | null = null;

    const preventEnterSubmit = (event: KeyboardEvent) => {
      if (event.key === "Enter") event.preventDefault();
    };

    const initialiseAutocomplete = async () => {
      try {
        await loadGooglePlaces(apiKey);
        if (disposed) return;

        inputElement = areaInputRef.current;
        if (!inputElement) return;

        autocomplete = new window.google.maps.places.Autocomplete(
          inputElement,
          {
            fields: [
              "place_id",
              "name",
              "formatted_address",
              "geometry",
              "address_components",
            ],
            componentRestrictions: { country: "in" },
            strictBounds: false,
          },
        );
        autocompleteRef.current = autocomplete;
        inputElement.addEventListener("keydown", preventEnterSubmit);

        placeChangedListener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete?.getPlace();

          const selectedAreaName = place ? getAreaDisplayName(place) : "";

          const selectedAddress =
            place?.formatted_address?.trim() ?? selectedAreaName;
          const selectedLatitude = place?.geometry?.location?.lat();
          const selectedLongitude = place?.geometry?.location?.lng();

          if (
            !place ||
            !selectedAreaName ||
            !place.place_id ||
            typeof selectedLatitude !== "number" ||
            typeof selectedLongitude !== "number"
          ) {
            clearGoogleLocation();

            form.setError("name", {
              type: "manual",
              message: "Select a complete location from the Google suggestions.",
            });

            return;
          }

          const currentCity = selectedCityRef.current;

          if (!currentCity) {
            clearGoogleLocation();

            form.setError("name", {
              type: "manual",
              message: "Select the City before selecting a Google location.",
            });

            return;
          }

          const locationDoesNotMatchCity = !placeMatchesCity(
            place,
            currentCity.name,
          );

          setLocationWarning(
            locationDoesNotMatchCity
              ? `Google identifies this location outside ${currentCity.name}. It will still be mapped under the selected ERP City.`
              : null,
          );

          linkedGoogleNameRef.current = selectedAreaName;

          form.clearErrors("name");
          setLocationWarning(null);

          form.setValue("name", selectedAreaName, {
            shouldDirty: true,
            shouldValidate: true,
          });

          form.setValue("googlePlaceId", place.place_id, {
            shouldDirty: true,
          });

          form.setValue("formattedAddress", selectedAddress, {
            shouldDirty: true,
          });

          form.setValue("latitude", selectedLatitude, {
            shouldDirty: true,
          });

          form.setValue("longitude", selectedLongitude, {
            shouldDirty: true,
          });
        });
        const currentCityName = selectedCityRef.current?.name;
        if (currentCityName) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode(
            { address: `${currentCityName}, India` },
            (results, status) => {
              if (
                disposed ||
                status !== "OK" ||
                !results?.[0]?.geometry?.viewport
              ) {
                return;
              }

              autocomplete?.setBounds(results[0].geometry.viewport);
            },
          );
        }

        setGoogleLoadError(null);
      } catch {
        if (!disposed) {
          setGoogleLoadError(
            "Google location search could not be loaded. You can still enter the Area manually.",
          );
        }
      }
    };

    void initialiseAutocomplete();

    return () => {
      disposed = true;
      placeChangedListener?.remove();
      if (inputElement) {
        inputElement.removeEventListener("keydown", preventEnterSubmit);
      }
      if (autocompleteRef.current === autocomplete) {
        autocompleteRef.current = null;
      }
    };
  }, [clearGoogleLocation, form, open]);

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
        autocomplete?.setBounds(results[0].geometry.viewport);

        autocomplete.setOptions({
          strictBounds: true,
        });
      },
    );
  }, [open, selectedCity?.name]);

  return (
    <MasterFormDialog<CreateAreaFormInput, CreateAreaBody>
      open={open}
      onOpenChange={onOpenChange}
      title={row ? "Edit Area" : "Add Area"}
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={create.isPending || update.isPending}
      columns={2}
      contentClassName="w-[95vw] sm:!max-w-5xl min-h-[75vh]"
    >
      <FormSection
        icon={<IconMapPin size={18} />}
        title="Area Information"
        description="Search and select the area from Google Places"
      >
        <CitySelectField<CreateAreaFormInput>
          name="cityId"
          label="City"
          required
          initialCity={initialCity}
          onCityChange={handleCityChange}
        />
        <TextField<CreateAreaFormInput>
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
          onValueChange={(value) => {
            const linkedName = linkedGoogleNameRef.current;

            if (
              linkedName &&
              normalizeLocationName(value) !== normalizeLocationName(linkedName)
            ) {
              clearGoogleLocation();
            }

            form.clearErrors("name");
          }}
        />
        <SwitchField<CreateAreaFormInput>
          name="isRailHead"
          label="Rail Head"
          description="Mark this area as a railway loading or unloading point"
          icon={<IconTrain size={14} />}
        />
        <div className="col-span-2">
          {googleLoadError ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <IconAlertTriangle className="mt-0.5 shrink-0" size={15} />
              <span>{googleLoadError}</span>
            </div>
          ) : hasLinkedGoogleLocation ? (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              <IconCheck className="mt-0.5 shrink-0" size={15} />
              <div>
                <p className="font-medium">Google location linked</p>
                <p className="mt-0.5 break-words opacity-80">
                  {formattedAddress}
                </p>
              </div>
            </div>
          ) : areaName ? (
            <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <IconMapPin className="mt-0.5 shrink-0" size={15} />
              <span>
                Manual Area — select a Google suggestion to link its address and
                coordinates.
              </span>
            </div>
          ) : null}

          {locationWarning ? (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <IconAlertTriangle className="mt-0.5 shrink-0" size={15} />
              <span>{locationWarning}</span>
            </div>
          ) : null}
        </div>
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
