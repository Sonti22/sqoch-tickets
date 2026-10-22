import { hasErrors, orderTotal, validateOrder } from "./domain";
import type { OrderDraft } from "./domain";

export type Scenario = "success" | "sold-out";
export type Booking = OrderDraft & {
  id: string;
  total: number;
  createdAt: string;
};
export class SoldOutError extends Error {
  constructor() {
    super("Места закончились");
  }
}

/** In-memory mock: inventory and idempotency exist only in this instance/tab. */
export function createMockApi(initialSeats = 16, delayMs = 900) {
  let seats = initialSeats;
  const bookings = new Map<string, { fingerprint: string; booking: Booking }>();
  return {
    remaining: () => seats,
    async confirm(
      draft: OrderDraft,
      scenario: Scenario,
      requestId: string,
    ): Promise<Booking> {
      // Copy before yielding: later edits cannot change the submitted request.
      const snapshot = structuredClone(draft);
      snapshot.email = snapshot.email.trim();
      snapshot.participants = snapshot.participants.map((p) => ({
        ...p,
        name: p.name.trim(),
        age: p.age.trim(),
      }));
      if (hasErrors(validateOrder(snapshot)))
        throw new Error("Проверьте данные заказа");
      const fingerprint = JSON.stringify(snapshot);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const previous = bookings.get(requestId);
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new Error("Заказ с этим ключом уже существует");
        return structuredClone(previous.booking);
      }
      if (scenario === "sold-out") seats = 0;
      // Capacity check and decrement are synchronous after the async boundary.
      if (seats < snapshot.participants.length) throw new SoldOutError();
      seats -= snapshot.participants.length;
      const booking = {
        ...snapshot,
        id: `VG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        total: orderTotal(snapshot.participants),
        createdAt: new Date().toISOString(),
      };
      bookings.set(requestId, { fingerprint, booking });
      return structuredClone(booking);
    },
  };
}
