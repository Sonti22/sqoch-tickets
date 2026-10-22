import { describe, expect, it } from "vitest";
import type { OrderDraft } from "./domain";
import { createMockApi, SoldOutError } from "./mock-api";

const draft = (id = "adult"): OrderDraft => ({
  participants: [{ id, name: "Анна", age: "30" }],
  email: "anna@example.com",
});

describe("mock booking API", () => {
  it("confirms a valid order and consumes exactly the requested number of seats", async () => {
    const api = createMockApi(4, 0);
    const input = draft();
    input.participants.push({ id: "child", name: "Миша", age: "13" });

    const booking = await api.confirm(input, "success", "request-1");

    expect(booking).toMatchObject({ ...input, total: 3_000 });
    expect(booking.id).toMatch(/^VG-[0-9A-F]{8}$/);
    expect(Number.isNaN(Date.parse(booking.createdAt))).toBe(false);
    expect(api.remaining()).toBe(2);
  });

  it("stores a trimmed snapshot while preserving the original draft", async () => {
    const api = createMockApi(4, 0);
    const input = {
      participants: [{ id: "adult", name: "  Анна Мария  ", age: " 30 " }],
      email: "  anna+event@example.com  ",
    };
    const original = structuredClone(input);

    const booking = await api.confirm(input, "success", "request-1");

    expect(booking.email).toBe("anna+event@example.com");
    expect(booking.participants).toEqual([
      { id: "adult", name: "Анна Мария", age: "30" },
    ]);
    expect(input).toEqual(original);
  });

  it("rejects invalid orders without consuming inventory or reserving the request key", async () => {
    const api = createMockApi(1, 0);
    const input = draft();
    input.participants[0].age = "13";

    await expect(api.confirm(input, "success", "request-1")).rejects.toThrow(
      "Проверьте данные заказа",
    );
    expect(api.remaining()).toBe(1);

    await expect(
      api.confirm(draft(), "success", "request-1"),
    ).resolves.toMatchObject({ total: 2_000 });
    expect(api.remaining()).toBe(0);
  });

  it("checks the sold-out scenario at confirmation time after the asynchronous delay", async () => {
    const api = createMockApi(2, 10);
    const confirmation = api.confirm(draft(), "sold-out", "request-1");
    const rejection = expect(confirmation).rejects.toBeInstanceOf(SoldOutError);

    expect(api.remaining()).toBe(2);
    await rejection;
    expect(api.remaining()).toBe(0);
  });

  it("rejects an order that cannot fit without partially consuming its seats", async () => {
    const api = createMockApi(1, 0);
    const input = draft();
    input.participants.push({ id: "child", name: "Миша", age: "13" });

    await expect(
      api.confirm(input, "success", "request-1"),
    ).rejects.toBeInstanceOf(SoldOutError);
    expect(api.remaining()).toBe(1);
  });

  it("returns the original booking on a retry without consuming seats twice", async () => {
    const api = createMockApi(1, 0);
    const first = await api.confirm(draft(), "success", "request-1");
    const retried = await api.confirm(draft(), "success", "request-1");

    expect(retried).toEqual(first);
    expect(retried).not.toBe(first);
    expect(api.remaining()).toBe(0);
  });

  it("deduplicates simultaneous requests with the same key and payload", async () => {
    const api = createMockApi(1, 0);
    const [first, duplicate] = await Promise.all([
      api.confirm(draft(), "success", "request-1"),
      api.confirm(draft(), "success", "request-1"),
    ]);

    expect(duplicate).toEqual(first);
    expect(api.remaining()).toBe(0);
  });

  it("rejects a changed payload under an already confirmed request key", async () => {
    const api = createMockApi(3, 0);
    await api.confirm(draft(), "success", "request-1");
    const changed = draft();
    changed.email = "another@example.com";

    await expect(api.confirm(changed, "success", "request-1")).rejects.toThrow(
      "Заказ с этим ключом уже существует",
    );
    expect(api.remaining()).toBe(2);
  });

  it("allows only one of two competing orders to book the last seat", async () => {
    const api = createMockApi(1, 0);
    const results = await Promise.allSettled([
      api.confirm(draft("first-adult"), "success", "request-1"),
      api.confirm(draft("second-adult"), "success", "request-2"),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(
      rejected?.status === "rejected" &&
        rejected.reason instanceof SoldOutError,
    ).toBe(true);
    expect(api.remaining()).toBe(0);
  });

  it("isolates the submitted request from edits to the draft while awaiting confirmation", async () => {
    const api = createMockApi(4, 10);
    const input = draft();
    const submitted = structuredClone(input);
    const confirmation = api.confirm(input, "success", "request-1");

    input.email = "changed@example.com";
    input.participants[0].name = "Другое имя";
    input.participants[0].age = "13";
    input.participants.push({ id: "extra", name: "Ещё один", age: "20" });

    const booking = await confirmation;
    expect(booking).toMatchObject({ ...submitted, total: 2_000 });
    expect(booking.participants).toHaveLength(1);
    expect(api.remaining()).toBe(3);
  });

  it("protects stored bookings from mutation of a previously returned object", async () => {
    const api = createMockApi(3, 0);
    const booking = await api.confirm(draft(), "success", "request-1");
    const original = structuredClone(booking);

    booking.email = "changed@example.com";
    booking.participants[0].name = "Другое имя";
    booking.participants.pop();
    booking.total = 0;

    expect(await api.confirm(draft(), "success", "request-1")).toEqual(
      original,
    );
    expect(api.remaining()).toBe(2);
  });
});
