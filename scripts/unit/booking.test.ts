import { isBookingOverlapError } from "../../lib/booking";
import { eq, test } from "./harness";

// La regla Booking_no_overlap de Postgres llega como error de Prisma con el código 23P01
test("isBookingOverlapError reconoce el nombre de la restricción", () =>
  eq(isBookingOverlapError(new Error('conflicting key value violates exclusion constraint "Booking_no_overlap"')), true));
test("isBookingOverlapError reconoce el código 23P01", () => eq(isBookingOverlapError(new Error("Code: `23P01`. Message: …")), true));
test("isBookingOverlapError ignora otros errores", () => eq(isBookingOverlapError(new Error("Unique constraint failed")), false));
test("isBookingOverlapError ignora lo que no es un Error", () => eq(isBookingOverlapError("Booking_no_overlap"), false));
