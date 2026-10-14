"use strict";

// Данные из брифа. Цены «от» — для каталога, таблица по радиусам — для калькулятора.
const CATEGORIES = ["Все", "Шиномонтаж", "Балансировка", "Ремонт", "Хранение"];

const SERVICES = [
  { id: "mount", name: "Шиномонтаж комплекта", cat: "Шиномонтаж", price: 1600, desc: "Снятие, монтаж и установка четырёх колёс." },
  { id: "mount-one", name: "Шиномонтаж одного колеса", cat: "Шиномонтаж", price: 450, desc: "Если меняете одну шину или проверяете колесо." },
  { id: "runflat", name: "Монтаж шин Run Flat", cat: "Шиномонтаж", price: 2600, desc: "Усиленные шины на специальном станке." },
  { id: "balance", name: "Балансировка комплекта", cat: "Балансировка", price: 800, desc: "Убирает биение руля на скорости." },
  { id: "balance-one", name: "Балансировка одного колеса", cat: "Балансировка", price: 250, desc: "После ремонта или замены грузика." },
  { id: "puncture", name: "Ремонт прокола", cat: "Ремонт", price: 500, desc: "Жгут или грибок — по типу повреждения." },
  { id: "cut", name: "Ремонт бокового пореза", cat: "Ремонт", price: 1200, desc: "Вулканизация с заплатой изнутри." },
  { id: "valve", name: "Замена вентиля", cat: "Ремонт", price: 150, desc: "Резиновый или металлический вентиль." },
  { id: "storage", name: "Хранение шин на сезон", cat: "Хранение", price: 3000, desc: "Отапливаемый склад, чехлы, фото при приёме." },
  { id: "storage-wheels", name: "Хранение колёс на дисках", cat: "Хранение", price: 3600, desc: "С дисками — на отдельных стеллажах." },
];

const MOUNT_BY_RADIUS = { 13: 1600, 14: 1600, 15: 1800, 16: 2000, 17: 2400, 18: 2800, 19: 3200, 20: 3600 };
const CAR_FACTOR = { car: 1, crossover: 1.2, suv: 1.4 };
const BALANCE = 800;
const REPAIR = 500;
const STORAGE = 3000;
const OPEN_HOUR = 9;
const LAST_SLOT_HOUR = 20; // работаем до 21:00, последняя запись — на 20:00
const THEMES = { classic: "Классика", bold: "Контраст" };
const THEME_KEY = "koleso-theme";
const BOOKINGS_KEY = "koleso-bookings";

const rub = (n) => `${n.toLocaleString("ru-RU")} ₽`;

/** Цена комплекта по брифу: монтаж и балансировка — с коэффициентом машины, ремонт и хранение — без. */
function quote({ radius, car, mount, balance, repair, storage }) {
  const factor = CAR_FACTOR[car] ?? 1;
  let scaled = 0;
  if (mount) scaled += MOUNT_BY_RADIUS[radius] ?? 0;
  if (balance) scaled += BALANCE;
  let total = Math.round(scaled * factor);
  if (repair) total += REPAIR;
  if (storage) total += STORAGE;
  return total;
}

function filterServices(query, category) {
  const q = query.trim().toLowerCase();
  return SERVICES.filter((s) =>
    (category === "Все" || s.cat === category) &&
    (!q || s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)));
}

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return "7" + digits;
  if (digits.length === 11 && (digits[0] === "7" || digits[0] === "8")) return "7" + digits.slice(1);
  return null;
}

function localDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Ошибки формы записи по полям; пустой объект — заявку можно принять. */
function validateBooking(data, now = new Date()) {
  const errors = {};
  if (data.name.trim().length < 2) errors.name = "Как к вам обращаться?";
  if (!normalizePhone(data.phone)) errors.phone = "Нужен номер из 10 цифр после +7";
  if (!data.date) errors.date = "Выберите дату";
  else if (data.date < localDate(now)) errors.date = "Эта дата уже прошла";
  if (!data.time) errors.time = "Выберите время";
  else {
    const hour = Number(data.time.slice(0, 2));
    if (hour < OPEN_HOUR || hour > LAST_SLOT_HOUR) errors.time = "Работаем с 9:00 до 21:00";
    else if (data.date === localDate(now) && hour <= now.getHours()) errors.time = "Это время сегодня уже прошло";
  }
  if (!SERVICES.some((s) => s.id === data.service)) errors.service = "Выберите услугу";
  return errors;
}

// Для проверок из браузера и консоли.
window.Koleso = { quote, filterServices, validateBooking, normalizePhone, SERVICES };

function store(key, value) {
  try { localStorage.setItem(key, value); } catch { /* приватный режим — не страшно */ }
}
function load(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function initTheme() {
  const root = document.documentElement;
  const name = document.querySelector("[data-theme-name]");
  const apply = (theme) => {
    root.dataset.theme = theme;
    name.textContent = THEMES[theme];
  };
  apply(THEMES[load(THEME_KEY)] ? load(THEME_KEY) : "classic");
  document.querySelector("[data-theme-toggle]").addEventListener("click", () => {
    const next = root.dataset.theme === "classic" ? "bold" : "classic";
    apply(next);
    store(THEME_KEY, next);
  });
}

function initMenu() {
  const burger = document.querySelector(".burger");
  const nav = document.getElementById("nav");
  const set = (open) => {
    nav.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  };
  burger.addEventListener("click", () => set(burger.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
}

function initCatalog() {
  const list = document.getElementById("catalog");
  const chips = document.getElementById("chips");
  const search = document.getElementById("search");
  const count = document.getElementById("catalog-count");
  const empty = document.getElementById("catalog-empty");
  let category = "Все";

  for (const cat of CATEGORIES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = cat;
    b.setAttribute("aria-pressed", String(cat === category));
    b.addEventListener("click", () => {
      category = cat;
      chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      render();
    });
    chips.append(b);
  }

  function render() {
    const found = filterServices(search.value, category);
    list.replaceChildren(...found.map((s) => {
      const li = document.createElement("li");
      li.className = "card";
      li.dataset.service = s.id;
      li.innerHTML = `<span class="card__cat"></span><h3></h3><p></p><span class="card__price"></span>`;
      li.querySelector(".card__cat").textContent = s.cat;
      li.querySelector("h3").textContent = s.name;
      li.querySelector("p").textContent = s.desc;
      li.querySelector(".card__price").textContent = `от ${rub(s.price)}`;
      return li;
    }));
    count.textContent = `Услуг: ${found.length}`;
    empty.hidden = found.length > 0;
  }

  search.addEventListener("input", render);
  render();
}

function initCalc() {
  const form = document.getElementById("calc-form");
  const radius = document.getElementById("calc-radius");
  const out = document.getElementById("calc-total");
  for (const r of Object.keys(MOUNT_BY_RADIUS)) {
    radius.append(new Option(`R${r}`, r, false, r === "16"));
  }
  const update = () => {
    const f = new FormData(form);
    const total = quote({
      radius: Number(f.get("radius")), car: f.get("car"),
      mount: f.has("mount"), balance: f.has("balance"), repair: f.has("repair"), storage: f.has("storage"),
    });
    out.textContent = total ? `Итого: ${rub(total)}` : "Выберите хотя бы одну услугу";
    out.dataset.total = String(total);
  };
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
}

function initBooking() {
  const form = document.getElementById("booking-form");
  const done = document.getElementById("booking-done");
  const time = form.elements.time;
  const service = form.elements.service;
  const date = form.elements.date;

  time.append(new Option("—", ""));
  for (let h = OPEN_HOUR; h <= LAST_SLOT_HOUR; h++) time.append(new Option(`${h}:00`, `${String(h).padStart(2, "0")}:00`));
  service.append(new Option("—", ""));
  for (const s of SERVICES) service.append(new Option(s.name, s.id));
  date.min = localDate(new Date());

  const showErrors = (errors) => {
    for (const el of form.querySelectorAll("[data-error-for]")) {
      const field = el.dataset.errorFor;
      el.textContent = errors[field] ?? "";
      form.elements[field].classList.toggle("is-invalid", Boolean(errors[field]));
      form.elements[field].setAttribute("aria-invalid", String(Boolean(errors[field])));
    }
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const errors = validateBooking(data);
    showErrors(errors);
    if (Object.keys(errors).length) {
      form.elements[Object.keys(errors)[0]].focus();
      done.hidden = true;
      return;
    }
    const booking = { ...data, phone: normalizePhone(data.phone), created: new Date().toISOString() };
    const all = JSON.parse(load(BOOKINGS_KEY) || "[]");
    all.push(booking);
    store(BOOKINGS_KEY, JSON.stringify(all));
    const name = SERVICES.find((s) => s.id === data.service).name;
    done.textContent = `Спасибо, ${data.name.trim()}! Ждём вас ${data.date.split("-").reverse().join(".")} в ${data.time} — «${name}». Администратор перезвонит для подтверждения.`;
    done.hidden = false;
    form.reset();
    showErrors({});
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initMenu();
  initCatalog();
  initCalc();
  initBooking();
});
