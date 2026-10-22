import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Leaf,
  Mail,
  MapPin,
  Plus,
  ShieldCheck,
  Ticket,
  Users,
  X,
} from "lucide-react";
import {
  hasErrors,
  makeParticipant,
  orderTotal,
  ticketPrice,
  validateOrder,
} from "./domain";
import type { OrderDraft, ValidationErrors } from "./domain";
import { createMockApi, SoldOutError } from "./mock-api";
import type { Booking, Scenario } from "./mock-api";

type Step = "details" | "review" | "success" | "sold-out";
const money = (value: number) =>
  new Intl.NumberFormat("ru-RU").format(value) + " ₽";
const ageText = (value: string) => {
  const n = Number(value);
  return `${n} ${n % 10 === 1 && n % 100 !== 11 ? "год" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "года" : "лет"}`;
};

function Landscape() {
  return (
    <svg
      className="landscape"
      viewBox="0 0 640 350"
      role="img"
      aria-label="Солнце и зелёные холмы — иллюстрация фестиваля"
    >
      <defs>
        <pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".55" fill="#213c26" opacity=".11" />
        </pattern>
      </defs>
      <rect width="640" height="350" fill="#eac968" />
      <circle cx="466" cy="94" r="54" fill="#fae8ad" />
      <path d="M0 200 Q120 65 295 202 T640 150 V350 H0Z" fill="#8f9d65" />
      <path d="M0 280 Q170 105 380 255 T640 220 V350 H0Z" fill="#526a42" />
      <path d="M250 350 Q340 228 640 245 V350Z" fill="#2d4935" />
      <path
        d="M148 350 Q315 250 310 187"
        fill="none"
        stroke="#d7d9a8"
        strokeWidth="20"
      />
      <path
        d="M70 110q12-12 24 0m12-12q12-12 24 0"
        fill="none"
        stroke="#304731"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <g stroke="#f4e8ba" strokeWidth="3" fill="#e8c664">
        <path d="M530 315v-65m0 45-17-13m17-2 18-14" />
        <circle cx="530" cy="245" r="12" />
        <circle cx="519" cy="232" r="9" />
        <circle cx="539" cy="231" r="9" />
        <circle cx="545" cy="248" r="9" />
        <circle cx="516" cy="249" r="9" />
        <circle cx="530" cy="254" r="9" />
      </g>
      <rect width="640" height="350" fill="url(#grain)" />
    </svg>
  );
}

function App() {
  const [draft, setDraft] = useState<OrderDraft>(() => ({
    participants: [makeParticipant()],
    email: "",
  }));
  const [step, setStep] = useState<Step>("details");
  const [errors, setErrors] = useState<ValidationErrors>({ fields: {} });
  const [scenario, setScenario] = useState<Scenario>("success");
  const [pending, setPending] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [notice, setNotice] = useState("");
  const api = useRef(createMockApi());
  const lock = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const requestId = useRef(crypto.randomUUID());
  const total = orderTotal(draft.participants);

  useEffect(() => {
    if (step !== "details") titleRef.current?.focus();
  }, [step]);

  function updateParticipant(id: string, field: "name" | "age", value: string) {
    setDraft((current) => ({
      ...current,
      participants: current.participants.map((p) =>
        p.id === id ? { ...p, [field]: value } : p,
      ),
    }));
    setErrors({ fields: {} });
  }
  function review(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateOrder(draft);
    setErrors(validation);
    if (hasErrors(validation)) {
      // Focus the first field with an error; global accompaniment errors stay visible below the group.
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLInputElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }
    setNotice("");
    setStep("review");
  }
  async function confirm() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setNotice("");
    try {
      const result = await api.current.confirm(
        draft,
        scenario,
        requestId.current,
      );
      setBooking(result);
      setStep("success");
    } catch (error) {
      if (error instanceof SoldOutError) setStep("sold-out");
      else
        setNotice(
          error instanceof Error
            ? error.message
            : "Не удалось оформить заказ. Попробуйте ещё раз.",
        );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  function retry() {
    api.current = createMockApi();
    requestId.current = crypto.randomUUID();
    setScenario("success");
    setStep("review");
  }
  function changeScenario(value: Scenario) {
    // An explicit demo switch starts a fresh inventory scenario, preserving the form.
    api.current = createMockApi();
    requestId.current = crypto.randomUUID();
    setScenario(value);
  }
  function restart() {
    api.current = createMockApi();
    requestId.current = crypto.randomUUID();
    setDraft({ participants: [makeParticipant()], email: "" });
    setBooking(null);
    setScenario("success");
    setErrors({ fields: {} });
    setStep("details");
    setNotice("");
  }
  function download() {
    if (!booking) return;
    const content = `ВНЕ ГОРОДА · ДЕМО-БИЛЕТЫ\nЗаказ ${booking.id}\n24 июля 2027, 12:00–21:00 · Парк «Сосны»\n\n${booking.participants.map((p, i) => `${i + 1}. ${p.name}, ${ageText(p.age)} — ${money(ticketPrice(Number(p.age)))}`).join("\n")}\n\nИтого: ${money(booking.total)}\nЭто демонстрационный заказ. Документ не даёт права входа. Реального списания и отправки email не было.`;
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${booking.id}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href="./" aria-label="Вне города — главная">
          <span className="brand-icon">
            <Leaf size={23} strokeWidth={1.8} />
          </span>
          <span>
            вне города<span className="brand-dot">®</span>
          </span>
        </a>
        <span className="header-caption">
          маленькое путешествие в большой день
        </span>
        <span className="header-tag">
          <span /> Лето ближе, чем кажется
        </span>
      </header>
      <main className="shell">
        <div className="breadcrumb">
          <span>Фестиваль</span>
          <ChevronRight size={13} />
          <span>Билеты</span>
          <ChevronRight size={13} />
          <strong>Оформление</strong>
        </div>
        <div className="page-heading">
          <div>
            <div className="eyebrow">ПЛАНЫ НА ХОРОШИЙ ДЕНЬ</div>
            <h1>
              Увидимся <span>вне города.</span>
            </h1>
            <p>Музыка, тёплый ветер и время вместе. Осталось выбрать, с кем.</p>
          </div>
          <div className="heading-stamp">
            <Ticket size={25} />
            <span>
              Ваше лето.
              <br />
              Ваши билеты.
            </span>
          </div>
        </div>
        <div className="checkout-layout">
          <section className="checkout-card" aria-label="Оформление заказа">
            <ol className="steps" aria-label="Этапы оформления">
              <li className={step === "details" ? "active" : "done"}>
                <span>{step === "details" ? "1" : <Check size={14} />}</span>
                Участники
              </li>
              <li
                className={
                  step === "review" || step === "sold-out"
                    ? "active"
                    : step === "success"
                      ? "done"
                      : ""
                }
              >
                <span>{step === "success" ? <Check size={14} /> : "2"}</span>
                Проверка
              </li>
              <li className={step === "success" ? "active" : ""}>
                <span>3</span>Готово
              </li>
            </ol>
            {step === "details" && (
              <form onSubmit={review} noValidate>
                <div className="section-heading">
                  <div>
                    <h2>Кто идёт с вами?</h2>
                    <p>Добавьте от 1 до 4 участников в один заказ.</p>
                  </div>
                  <span className="count">{draft.participants.length} / 4</span>
                </div>
                <div className="participants">
                  {draft.participants.map((p, index) => {
                    const validAge =
                      /^\d+$/.test(p.age.trim()) && Number(p.age) <= 120;
                    return (
                      <fieldset className="participant" key={p.id}>
                        <legend>Участник {index + 1}</legend>
                        <div className="participant-top">
                          <span className="participant-label">
                            <Users size={15} />
                            Участник {index + 1}
                          </span>
                          {validAge && (
                            <span
                              className={`rate ${Number(p.age) < 14 ? "child" : ""}`}
                            >
                              {Number(p.age) < 14 ? "Детский" : "Полный"} ·{" "}
                              {money(ticketPrice(Number(p.age)))}
                            </span>
                          )}
                          {draft.participants.length > 1 && (
                            <button
                              className="icon-button remove"
                              type="button"
                              aria-label={`Удалить участника ${index + 1}`}
                              onClick={() => {
                                setDraft((c) => ({
                                  ...c,
                                  participants: c.participants.filter(
                                    (item) => item.id !== p.id,
                                  ),
                                }));
                                setErrors({ fields: {} });
                              }}
                            >
                              <X size={17} />
                            </button>
                          )}
                        </div>
                        <div className="participant-fields">
                          <div className="field">
                            <label htmlFor={`${p.id}-name`}>
                              Имя участника
                            </label>
                            <input
                              id={`${p.id}-name`}
                              value={p.name}
                              autoComplete="off"
                              maxLength={80}
                              placeholder="Например, Саша"
                              aria-invalid={Boolean(
                                errors.fields[`${p.id}.name`],
                              )}
                              aria-describedby={
                                errors.fields[`${p.id}.name`]
                                  ? `${p.id}-name-error`
                                  : undefined
                              }
                              onChange={(e) =>
                                updateParticipant(p.id, "name", e.target.value)
                              }
                            />
                            {errors.fields[`${p.id}.name`] && (
                              <span
                                className="field-error"
                                id={`${p.id}-name-error`}
                              >
                                {errors.fields[`${p.id}.name`]}
                              </span>
                            )}
                          </div>
                          <div className="field age-field">
                            <label htmlFor={`${p.id}-age`}>Возраст, лет</label>
                            <input
                              id={`${p.id}-age`}
                              value={p.age}
                              inputMode="numeric"
                              autoComplete="off"
                              maxLength={3}
                              placeholder="0–120"
                              aria-invalid={Boolean(
                                errors.fields[`${p.id}.age`],
                              )}
                              aria-describedby={
                                errors.fields[`${p.id}.age`]
                                  ? `${p.id}-age-error`
                                  : undefined
                              }
                              onChange={(e) =>
                                updateParticipant(p.id, "age", e.target.value)
                              }
                            />
                            {errors.fields[`${p.id}.age`] && (
                              <span
                                className="field-error"
                                id={`${p.id}-age-error`}
                              >
                                {errors.fields[`${p.id}.age`]}
                              </span>
                            )}
                          </div>
                        </div>
                      </fieldset>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="add-button"
                  disabled={draft.participants.length >= 4}
                  onClick={() => {
                    setDraft((c) => ({
                      ...c,
                      participants: [...c.participants, makeParticipant()],
                    }));
                    setErrors({ fields: {} });
                  }}
                >
                  <Plus size={17} />
                  {draft.participants.length >= 4
                    ? "В заказе максимум 4 участника"
                    : "Добавить участника"}
                </button>
                <div className="family-note">
                  <ShieldCheck size={19} />
                  <p>
                    Младше 14 лет — только со взрослым от 18 лет в этом же
                    заказе.
                  </p>
                </div>
                {errors.global && (
                  <p role="alert" className="error-box">
                    {errors.global}
                  </p>
                )}
                {errors.fields.participants && (
                  <p role="alert" className="error-box">
                    {errors.fields.participants}
                  </p>
                )}
                <div className="contact">
                  <h3>Куда отправить билеты?</h3>
                  <p>Один email для всего заказа.</p>
                  <div className="field">
                    <label htmlFor="email">Контактный email</label>
                    <div className="input-icon">
                      <Mail size={17} />
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={draft.email}
                        placeholder="you@example.com"
                        maxLength={254}
                        aria-invalid={Boolean(errors.fields.email)}
                        aria-describedby={
                          errors.fields.email ? "email-error" : "email-note"
                        }
                        onChange={(e) => {
                          setDraft((c) => ({ ...c, email: e.target.value }));
                          setErrors({ fields: {} });
                        }}
                      />
                    </div>
                    {errors.fields.email && (
                      <span className="field-error" id="email-error">
                        {errors.fields.email}
                      </span>
                    )}
                    <span className="input-note" id="email-note">
                      В демоверсии письма не отправляются.
                    </span>
                  </div>
                </div>
                <div className="form-bottom">
                  <p>
                    <ShieldCheck size={14} />
                    Данные можно изменить на следующем шаге
                  </p>
                  <button className="button primary" type="submit">
                    Проверить заказ
                    <ArrowRight size={18} />
                  </button>
                </div>
              </form>
            )}
            {step === "review" && (
              <div className="review">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">ЕЩЁ ОДИН ШАГ</div>
                    <h2 ref={titleRef} tabIndex={-1}>
                      Всё верно?
                    </h2>
                    <p>Проверьте участников и email перед подтверждением.</p>
                  </div>
                  <span className="review-icon">
                    <Ticket size={24} />
                  </span>
                </div>
                <div className="review-list">
                  {draft.participants.map((p) => (
                    <div key={p.id}>
                      <span className="person-avatar">
                        {p.name.trim()[0]?.toUpperCase()}
                      </span>
                      <div>
                        <strong>{p.name.trim()}</strong>
                        <small>
                          {ageText(p.age)} ·{" "}
                          {Number(p.age) < 14
                            ? "Детский билет"
                            : "Полный билет"}
                        </small>
                      </div>
                      <b>{money(ticketPrice(Number(p.age)))}</b>
                    </div>
                  ))}
                </div>
                <div className="review-email">
                  <Mail size={18} />
                  <div>
                    <span>Контактный email</span>
                    <strong>{draft.email.trim()}</strong>
                  </div>
                </div>
                <div className="review-total">
                  <span>
                    Итого за {draft.participants.length}{" "}
                    {draft.participants.length === 1 ? "билет" : "билета"}
                  </span>
                  <strong>{money(total)}</strong>
                </div>
                <p className="review-hint">
                  <ShieldCheck size={17} />
                  Наличие мест проверим в момент подтверждения. Оплата в
                  демоверсии не требуется.
                </p>
                {notice && (
                  <p role="alert" className="error-box">
                    {notice}
                  </p>
                )}
                <div className="review-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={pending}
                    onClick={() => setStep("details")}
                  >
                    <ArrowLeft size={17} />
                    Изменить данные
                  </button>
                  <button
                    className="button primary"
                    type="button"
                    disabled={pending}
                    onClick={confirm}
                  >
                    {pending ? (
                      <>
                        <span className="spinner" />
                        Проверяем места…
                      </>
                    ) : (
                      <>
                        Подтвердить заказ
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </div>
                <p className="secure-caption" role="status">
                  {pending
                    ? "Оформляем заказ. Пожалуйста, подождите."
                    : "Это демонстрационный заказ. Списания денег не будет."}
                </p>
              </div>
            )}
            {step === "success" && booking && (
              <div className="result">
                <div className="result-icon success">
                  <Check size={34} />
                </div>
                <div className="eyebrow">МОЖНО НАЧИНАТЬ ПРЕДВКУШАТЬ</div>
                <h2 ref={titleRef} tabIndex={-1}>
                  Вы идёте на фестиваль!
                </h2>
                <p>
                  Демонстрационный заказ оформлен.
                  <br />
                  Сохраните билеты и планируйте свой день.
                </p>
                <div className="confirmation">
                  <div>
                    <span>Номер заказа</span>
                    <strong>{booking.id}</strong>
                  </div>
                  <div>
                    <span>Участников</span>
                    <strong>{booking.participants.length}</strong>
                  </div>
                  <div>
                    <span>Стоимость</span>
                    <strong>{money(booking.total)}</strong>
                  </div>
                </div>
                <div className="success-email">
                  <Mail size={18} />
                  <span>{booking.email}</span>
                </div>
                <p className="demo-disclaimer">
                  Письмо не отправлено, деньги не списаны.
                  <br />
                  Демо-билеты не дают права входа.
                </p>
                <button
                  type="button"
                  className="button primary"
                  onClick={download}
                >
                  <ArrowDownToLine size={18} />
                  Скачать демо-билеты
                </button>
                <button type="button" className="text-button" onClick={restart}>
                  Оформить новый заказ
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
            {step === "sold-out" && (
              <div className="result">
                <div className="result-icon sold-out">
                  <Ticket size={33} />
                </div>
                <div className="eyebrow">ИНOГДА ПЛАНЫ МЕНЯЮТСЯ</div>
                <h2 ref={titleRef} tabIndex={-1}>
                  Ох, места закончились
                </h2>
                <p>
                  Пока вы заполняли данные, последние билеты забрали. Заказ не
                  создан, деньги не списаны.
                </p>
                <div className="saved-note">
                  <ShieldCheck size={20} />
                  <span>
                    Мы сохранили введённые данные.
                    <br />
                    Вы можете вернуться к заказу.
                  </span>
                </div>
                <button
                  className="button primary"
                  type="button"
                  onClick={() => setStep("details")}
                >
                  <ArrowLeft size={17} />
                  Вернуться к данным
                </button>
                <button className="text-button" type="button" onClick={retry}>
                  Повторить с доступными местами
                  <ArrowRight size={15} />
                </button>
                <p className="demo-disclaimer">
                  Повтор запускает новый сценарий с моковыми местами.
                </p>
              </div>
            )}
          </section>
          <aside className="order-sidebar" aria-label="Ваш заказ">
            <article className="event-card">
              <div className="event-art">
                <Landscape />
                <span className="event-badge">
                  <span /> ОДИН ДЕНЬ. МНОГО СЧАСТЬЯ.
                </span>
                <div className="poster-title">
                  вне
                  <br />
                  <span>города</span>
                  <span className="poster-star">✳</span>
                </div>
                <span className="poster-date">24 / 07</span>
              </div>
              <div className="event-info">
                <span className="eyebrow">СЕМЕЙНЫЙ ФЕСТИВАЛЬ</span>
                <h2>Лето, которое запомнится</h2>
                <p>
                  <Clock3 size={16} />
                  24 июля 2027 · 12:00–21:00
                </p>
                <p>
                  <MapPin size={16} />
                  Парк «Сосны», Москва
                </p>
                <div className="event-divider" />
                <div className="price-row">
                  <span>
                    Полный<span>от 14 лет</span>
                  </span>
                  <strong>2 000 ₽</strong>
                </div>
                <div className="price-row">
                  <span>
                    Детский<span>младше 14 лет</span>
                  </span>
                  <strong>1 000 ₽</strong>
                </div>
                <div
                  className="sidebar-total"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <div>
                    <span>Ваш заказ</span>
                    <small>
                      {draft.participants.length}{" "}
                      {draft.participants.length === 1
                        ? "участник"
                        : "участника"}
                    </small>
                  </div>
                  <strong data-testid="order-total">{money(total)}</strong>
                </div>
                <div className="no-fees">
                  <Check size={14} />
                  Без сервисного сбора
                </div>
              </div>
            </article>
            <p className="sidebar-note">
              <Leaf size={19} />
              <span>
                Больше впечатлений.
                <br />
                Меньше городской суеты.
              </span>
            </p>
          </aside>
        </div>
        <details className="demo-controls">
          <summary>Демо · проверить сценарии</summary>
          <div>
            <label htmlFor="scenario">Наличие мест при подтверждении</label>
            <select
              id="scenario"
              disabled={pending || step === "success"}
              value={scenario}
              onChange={(e) => changeScenario(e.target.value as Scenario)}
            >
              <option value="success">Места доступны — успешный заказ</option>
              <option value="sold-out">
                Места закончатся перед подтверждением
              </option>
            </select>
            <p>
              Учебный интерфейс на моковых данных. Места не бронируются во время
              ввода. Смена сценария восстанавливает моковые места.
            </p>
          </div>
        </details>
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          <Leaf size={15} />
          вне города
        </span>
        <span>Сделано для хороших воспоминаний</span>
        <span>Демонстрационный проект · 2026</span>
      </footer>
    </>
  );
}

export default App;
