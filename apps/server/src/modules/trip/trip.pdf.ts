// apps/api/src/features/trips/trip.pdf.ts
import { Prisma } from "../../../generated/prisma/index.js";
import type { PdfDocument } from "../../templetes/pdf/pdf.type.js";
import path from "node:path";
import { imageToBase64Src } from "../_shared/pdf.helper.js";

const headerImageSrc = imageToBase64Src(
    path.resolve(process.cwd(), "public/skt_logo.svg")
);

export const tripPdfInclude = {
    vehicle: { select: { id: true, vehicleNumber: true } },
    driver: { select: { id: true, name: true } },
    route: {
        select: {
            id: true,
            sourceCity: { select: { id: true, name: true } },
            destinationCity: { select: { id: true, name: true } },
        },
    },
    consignor: { select: { id: true, name: true, shortName: true } },
    createdBy: { select: { id: true, firstName: true, lastName: true } },

} satisfies Prisma.VehicleTripInclude;

export type TripPdfData = Prisma.VehicleTripGetPayload<{
    include: typeof tripPdfInclude;
}>;

const formatDate = (date: Date | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-IN");
};

const formatDateTime = (date: Date | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
};

const pdfValue = (value: unknown): string | number | null | undefined => {
    if (value === null || value === undefined || value === "") return undefined;
    return String(value);
};

export const buildTripPdfDocument = (trip: TripPdfData): PdfDocument => {
    const routeLabel =
        trip.route?.sourceCity?.name && trip.route?.destinationCity?.name
            ? `${trip.route.sourceCity.name} → ${trip.route.destinationCity.name}`
            : "-";

    const createdByName = trip.createdBy
        ? `${trip.createdBy.firstName} ${trip.createdBy.lastName}`
        : undefined;
    const tripDetailsTitle = trip.tripName
        ? `Trip Details - ${trip.tripName}`
        : "Trip Details";

    const shouldShowStartedAt =
        trip.status === "InTransit" || trip.status === "Completed";
    const pdfAmount = (value: unknown): string | undefined => {
        if (value === null || value === undefined || value === "") return undefined;

        const amount = Number(value);
        if (Number.isNaN(amount)) return undefined;

        return `${amount.toLocaleString("en-IN")} /-`;
    };
    // const clientScheduleFields = [
    //     { label: "Client", value: pdfValue(trip.consignor?.name) },
    //     { label: "Rake Date", value: formatDate(trip.rakeDate) },
    //     ...(shouldShowStartedAt
    //         ? [{ label: "Started At", value: formatDateTime(trip.startDateTime) }]
    //         : []),
    // ];
    return {
        layout: "compact-form",
        title: "Trip Sheet",
        documentNo: trip.tripNumber,
        date: formatDate(trip.createdAt),
        status: trip.status,

        // Meta row below the status-history table
        createdAt: formatDateTime(trip.createdAt),
        createdBy: createdByName,

        company: {
            headerImageSrc,
            name: "S K TRANS LINES PVT. LTD.",
            address:
                "Corporate Off.: S K TOWER, A-52, Ground Floor, Ayodhya Nagar Road, OLD MIDC, Jalgaon - 425003",
            cin: "U63000MH2004PTC148258",
            email: "customercare@sktranslines.com",
            website: "www.sktranslines.com",
        },

        footerContacts: [
            { city: "Guwahati", phone: "9435568914" },
            { city: "Kolkata", phone: "8336925540" },
            { city: "Mumbai", phone: "91+2572270651" },
            { city: "Nashik", phone: "9422770142" },
            { city: "Pondicherry", phone: "9626709983" },
            { city: "Pune", phone: "9373770144" },
        ],
        sections: [
            {
                title: tripDetailsTitle,
                columns: 3,
                fields: [
                    { label: "Trip Type", value: trip.tripType === "lr" ? "LR" : "Rake (DC)" },
                    { label: "Route", value: routeLabel },
                    { label: "Empty Trip", value: trip.isTripEmpty ? "Yes" : "No" },
                ],
            },
            {
                title: "Vehicle & Driver",
                columns: 2,
                fields: [
                    { label: "Vehicle", value: pdfValue(trip.vehicle?.vehicleNumber) },
                    { label: "Driver", value: pdfValue(trip.driver?.name) },
                    { label: "Opening KM", value: pdfValue(trip.openingKm) },
                    { label: "Onward Freight", value: pdfAmount(trip.onwardFreight) },
                ],
            },
            {
                title: "Client & Schedule",
                columns: 2,
                fields: [
                    { label: "Client", value: pdfValue(trip.consignor?.name) },
                    { label: "Rake Date", value: formatDate(trip.rakeDate) },
                    ...(shouldShowStartedAt
                        ? [{ label: "Started At", value: formatDateTime(trip.startDateTime) }]
                        : []),
                ],
            },
        ],

        tables: [],

        signatures: ["Driver", "Operations", "Accounts"],
    };
};