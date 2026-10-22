import { describe, expect, it } from "vitest";
import {
  hasErrors,
  makeParticipant,
  orderTotal,
  ticketPrice,
  validateOrder,
  type OrderDraft,
  type Participant,
} from "./domain";

const participant = (
  age = "18",
  name = "Анна",
  id = "person-1",
): Participant => ({
  id,
  name,
  age,
});

const draft = (
  participants = [participant()],
  email = "anna@example.com",
): OrderDraft => ({
  participants,
  email,
});

describe("ticket pricing", () => {
  it.each([
    [0, 1_000],
    [13, 1_000],
    [14, 2_000],
    [17, 2_000],
    [18, 2_000],
    [120, 2_000],
  ])("prices an age of %i at %i rubles", (age, price) => {
    expect(ticketPrice(age)).toBe(price);
  });

  it("calculates a mixed order without charging for incomplete or invalid ages", () => {
    expect(
      orderTotal([
        participant("35", "Анна", "adult"),
        participant("13", "Миша", "child"),
        participant("", "", "empty"),
        participant("14.5", "Иван", "invalid"),
      ]),
    ).toBe(3_000);
    expect(orderTotal([])).toBe(0);
  });

  it.each(["-1", "121", "Infinity", "NaN", "1e1", "+14", "14.0", "   "])(
    "does not price invalid age %s",
    (age) => {
      expect(orderTotal([participant(age)])).toBe(0);
    },
  );
});

describe("order validation", () => {
  it("accepts the minimum and maximum order sizes", () => {
    expect(hasErrors(validateOrder(draft()))).toBe(false);
    expect(
      hasErrors(
        validateOrder(
          draft(
            Array.from({ length: 4 }, (_, index) =>
              participant("18", "Гость", `p${index}`),
            ),
          ),
        ),
      ),
    ).toBe(false);
  });

  it.each([0, 5])("rejects %i participants", (count) => {
    const participants = Array.from({ length: count }, (_, index) =>
      participant("18", "Гость", `p${index}`),
    );
    expect(validateOrder(draft(participants)).fields.participants).toBeTruthy();
  });

  it.each([
    "",
    " ",
    "-1",
    "121",
    "14.5",
    "14.0",
    "1e1",
    "+14",
    "NaN",
    "Infinity",
    "abc",
  ])("rejects invalid age %j with an error tied to that participant", (age) => {
    expect(
      validateOrder(draft([participant(age)])).fields["person-1.age"],
    ).toBeTruthy();
  });

  it.each(["0", "13", "14", "17", "18", "120", " 18 "])(
    "accepts integer age %j",
    (age) => {
      expect(
        validateOrder(draft([participant(age)])).fields["person-1.age"],
      ).toBeUndefined();
    },
  );

  it.each(["", " ", "\t\n"])(
    "rejects an empty or whitespace-only name %j",
    (name) => {
      expect(
        validateOrder(draft([participant("18", name)])).fields["person-1.name"],
      ).toBeTruthy();
    },
  );

  it("accepts trimmed names and contact email without mutating the draft", () => {
    const input = draft(
      [participant("18", "  Анна Мария  ")],
      "  anna+event@example.com  ",
    );
    const snapshot = structuredClone(input);
    expect(hasErrors(validateOrder(input))).toBe(false);
    expect(input).toEqual(snapshot);
  });

  it.each([
    "",
    " ",
    "anna",
    "anna@",
    "@example.com",
    "anna@example",
    "a@@example.com",
    "anna @example.com",
  ])("rejects invalid contact email %j", (email) => {
    expect(
      validateOrder(draft([participant()], email)).fields.email,
    ).toBeTruthy();
  });

  it("requires an adult for a child travelling alone", () => {
    expect(validateOrder(draft([participant("13")])).global).toBeTruthy();
  });

  it("does not consider a 17-year-old an accompanying adult", () => {
    expect(
      validateOrder(
        draft([
          participant("13", "Миша", "child"),
          participant("17", "Иван", "teen"),
        ]),
      ).global,
    ).toBeTruthy();
  });

  it("allows a child with an accompanying participant aged exactly 18", () => {
    const input = draft([
      participant("13", "Миша", "child"),
      participant("18", "Анна", "adult"),
    ]);
    expect(hasErrors(validateOrder(input))).toBe(false);
    expect(orderTotal(input.participants)).toBe(3_000);
  });

  it("allows up to three children with one adult in the same order", () => {
    const input = draft([
      participant("0", "Миша", "child1"),
      participant("5", "Аня", "child2"),
      participant("13", "Вера", "child3"),
      participant("18", "Анна", "adult"),
    ]);
    expect(hasErrors(validateOrder(input))).toBe(false);
    expect(orderTotal(input.participants)).toBe(5_000);
  });

  it.each(["14", "17"])(
    "allows age %s without an adult under the documented child-ticket definition",
    (age) => {
      expect(hasErrors(validateOrder(draft([participant(age)])))).toBe(false);
    },
  );

  it("does not let an invalid adult age satisfy the accompaniment requirement", () => {
    const errors = validateOrder(
      draft([
        participant("13", "Миша", "child"),
        participant("121", "Анна", "adult"),
      ]),
    );
    expect(errors.global).toBeTruthy();
    expect(errors.fields["adult.age"]).toBeTruthy();
  });

  it("rechecks accompaniment after removing the adult from the order", () => {
    const input = draft([
      participant("8", "Миша", "child"),
      participant("38", "Анна", "adult"),
    ]);
    expect(hasErrors(validateOrder(input))).toBe(false);
    input.participants.pop();
    expect(validateOrder(input).global).toBeTruthy();
  });

  it("detects both field and order-level errors", () => {
    expect(hasErrors({ fields: {} })).toBe(false);
    expect(hasErrors({ fields: { email: "Invalid" } })).toBe(true);
    expect(hasErrors({ fields: {}, global: "Missing adult" })).toBe(true);
  });
});

describe("participant creation", () => {
  it("creates distinct blank participants for editable forms", () => {
    const first = makeParticipant();
    const second = makeParticipant();
    expect(first.id).not.toBe(second.id);
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.name).toBe("");
    expect(first.age).toBe("");
  });
});
