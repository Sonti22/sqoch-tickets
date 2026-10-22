export interface Participant {
  id: string;
  name: string;
  age: string;
}

export interface OrderDraft {
  participants: Participant[];
  email: string;
}

export interface ValidationErrors {
  fields: Record<string, string>;
  global?: string;
}

const MIN_PARTICIPANTS = 1;
const MAX_PARTICIPANTS = 4;
const CHILD_AGE_LIMIT = 14;
const ADULT_AGE = 18;
const MAX_AGE = 120;

function parseAge(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const age = Number(trimmed);
  return Number.isInteger(age) && age >= 0 && age <= MAX_AGE ? age : null;
}

export function makeParticipant(): Participant {
  return { id: crypto.randomUUID(), name: "", age: "" };
}

export function ticketPrice(age: number): number {
  return age < CHILD_AGE_LIMIT ? 1_000 : 2_000;
}

export function orderTotal(participants: Participant[]): number {
  return participants.reduce((total, participant) => {
    const age = parseAge(participant.age);
    return total + (age === null ? 0 : ticketPrice(age));
  }, 0);
}

export function validateOrder(draft: OrderDraft): ValidationErrors {
  const errors: ValidationErrors = { fields: {} };
  const ages: number[] = [];

  if (
    draft.participants.length < MIN_PARTICIPANTS ||
    draft.participants.length > MAX_PARTICIPANTS
  ) {
    errors.fields.participants = "В заказе может быть от 1 до 4 участников.";
  }

  for (const participant of draft.participants) {
    if (!participant.name.trim()) {
      errors.fields[`${participant.id}.name`] = "Введите имя участника.";
    }

    const age = parseAge(participant.age);
    if (age === null) {
      errors.fields[`${participant.id}.age`] =
        "Укажите целый возраст от 0 до 120 лет.";
    } else {
      ages.push(age);
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
    errors.fields.email =
      "Введите корректный email, например name@example.com.";
  }

  if (
    ages.some((age) => age < CHILD_AGE_LIMIT) &&
    !ages.some((age) => age >= ADULT_AGE)
  ) {
    errors.global =
      "Для ребёнка младше 14 лет добавьте сопровождающего от 18 лет в этот заказ.";
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors.fields).length > 0 || Boolean(errors.global);
}
