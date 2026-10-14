from datetime import date, timedelta

import pytest
from playwright.sync_api import Page, expect

# ---------------------------------------------------------------- каталог


def test_catalog_shows_all_services_with_prices(site: Page):
    expect(site.locator(".card")).to_have_count(10)
    expect(site.locator("#catalog-count")).to_have_text("Услуг: 10")
    expect(site.locator('[data-service="mount"] .card__price')).to_have_text("от 1 600 ₽")


def test_search_finds_by_name_and_description(site: Page):
    site.fill("#search", "баланс")
    expect(site.locator(".card h3")).to_have_text(["Балансировка комплекта", "Балансировка одного колеса"])
    site.fill("#search", "руля")  # только в описании
    expect(site.locator(".card h3")).to_have_text(["Балансировка комплекта"])


def test_category_chip_filters_and_combines_with_search(site: Page):
    site.get_by_role("button", name="Ремонт", exact=True).click()
    expect(site.locator(".card")).to_have_count(3)
    expect(site.get_by_role("button", name="Ремонт", exact=True)).to_have_attribute("aria-pressed", "true")
    site.fill("#search", "вентил")
    expect(site.locator(".card h3")).to_have_text(["Замена вентиля"])


def test_nothing_found_shows_hint(site: Page):
    site.fill("#search", "покраска")
    expect(site.locator(".card")).to_have_count(0)
    expect(site.locator("#catalog-empty")).to_be_visible()


# ---------------------------------------------------------------- калькулятор


def test_calculator_default_r16_car_mount_and_balance(site: Page):
    expect(site.locator("#calc-total")).to_have_text("Итого: 2 800 ₽")


@pytest.mark.parametrize(
    "radius,car,checks,total",
    [
        ("18", "crossover", {"storage": True}, 7320),  # (2800 + 800) × 1,2 + 3000
        ("20", "suv", {"balance": False, "repair": True}, 5540),  # 3600 × 1,4 + 500
        ("13", "car", {"mount": False, "balance": False, "repair": True}, 500),
    ],
)
def test_calculator_follows_brief_prices(site: Page, radius, car, checks, total):
    site.select_option("#calc-radius", radius)
    site.check(f'#calc-form input[name="car"][value="{car}"]')
    for name, on in checks.items():
        site.set_checked(f'#calc-form input[name="{name}"]', on)
    expect(site.locator("#calc-total")).to_have_attribute("data-total", str(total))


def test_calculator_without_services_asks_to_choose(site: Page):
    site.uncheck('#calc-form input[name="mount"]')
    site.uncheck('#calc-form input[name="balance"]')
    expect(site.locator("#calc-total")).to_have_text("Выберите хотя бы одну услугу")


# ---------------------------------------------------------------- запись


def _fill(page: Page, **values):
    defaults = {
        "name": "Анна",
        "phone": "8 (916) 123-45-67",
        "date": (date.today() + timedelta(days=1)).isoformat(),
        "time": "12:00",
        "service": "mount",
    }
    defaults.update(values)
    form = page.locator("#booking-form")
    form.locator('[name="name"]').fill(defaults["name"])
    form.locator('[name="phone"]').fill(defaults["phone"])
    form.locator('[name="date"]').fill(defaults["date"])
    form.locator('[name="time"]').select_option(defaults["time"])
    form.locator('[name="service"]').select_option(defaults["service"])
    form.get_by_role("button", name="Отправить заявку").click()


def test_empty_form_shows_error_at_every_field(site: Page):
    site.get_by_role("button", name="Отправить заявку").click()
    for field in ("name", "phone", "date", "time", "service"):
        expect(site.locator(f'[data-error-for="{field}"]')).not_to_be_empty()
        expect(site.locator(f'#booking-form [name="{field}"]')).to_have_attribute("aria-invalid", "true")
    expect(site.locator("#booking-done")).to_be_hidden()


def test_short_phone_is_rejected(site: Page):
    _fill(site, phone="123-45")
    expect(site.locator('[data-error-for="phone"]')).to_have_text("Нужен номер из 10 цифр после +7")
    expect(site.locator('[data-error-for="name"]')).to_be_empty()


def test_past_date_is_rejected(site: Page):
    _fill(site, date=(date.today() - timedelta(days=1)).isoformat())
    expect(site.locator('[data-error-for="date"]')).to_have_text("Эта дата уже прошла")


def test_valid_booking_is_accepted_saved_and_form_reset(site: Page):
    _fill(site)
    done = site.locator("#booking-done")
    expect(done).to_be_visible()
    expect(done).to_contain_text("Спасибо, Анна!")
    expect(done).to_contain_text("в 12:00 — «Шиномонтаж комплекта»")
    expect(site.locator('#booking-form [name="name"]')).to_have_value("")
    saved = site.evaluate("() => JSON.parse(localStorage.getItem('koleso-bookings'))")
    assert saved[-1]["phone"] == "79161234567" and saved[-1]["service"] == "mount"


def test_validation_rules_directly(site: Page):
    errors = site.evaluate("""() => window.Koleso.validateBooking(
        {name: 'Иван', phone: '+7 916 000-00-00', date: '2030-05-10', time: '08:00', service: 'mount'},
        new Date('2030-05-10T07:00:00'))""")
    assert errors == {"time": "Работаем с 9:00 до 21:00"}
    errors = site.evaluate("""() => window.Koleso.validateBooking(
        {name: 'Иван', phone: '+7 916 000-00-00', date: '2030-05-10', time: '10:00', service: 'mount'},
        new Date('2030-05-10T14:30:00'))""")
    assert errors == {"time": "Это время сегодня уже прошло"}


# ---------------------------------------------------------------- адаптивность и доступность


@pytest.mark.parametrize("width", [360, 768, 1280])
def test_no_horizontal_scroll(site: Page, width):
    site.set_viewport_size({"width": width, "height": 800})
    assert site.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth")


def test_mobile_menu_opens_and_closes(site: Page):
    site.set_viewport_size({"width": 375, "height": 740})
    burger = site.locator(".burger")
    nav = site.locator("#nav")
    expect(nav).to_be_hidden()
    burger.click()
    expect(nav).to_be_visible()
    expect(burger).to_have_attribute("aria-expanded", "true")
    nav.get_by_role("link", name="Калькулятор").click()
    expect(nav).to_be_hidden()
    expect(burger).to_have_attribute("aria-expanded", "false")


def test_desktop_menu_is_always_visible(site: Page):
    site.set_viewport_size({"width": 1280, "height": 800})
    expect(site.locator(".burger")).to_be_hidden()
    expect(site.locator("#nav")).to_be_visible()


def test_every_form_control_has_a_label(site: Page):
    unlabeled = site.evaluate("""() => [...document.querySelectorAll('input, select')]
        .filter(el => !el.closest('label') && !el.getAttribute('aria-label')).map(el => el.name || el.id)""")
    assert unlabeled == []


# ---------------------------------------------------------------- два варианта оформления


def test_theme_switches_and_survives_reload(site: Page):
    html = site.locator("html")
    expect(html).to_have_attribute("data-theme", "classic")
    bg_classic = site.evaluate("() => getComputedStyle(document.body).backgroundColor")
    site.locator("[data-theme-toggle]").click()
    expect(html).to_have_attribute("data-theme", "bold")
    expect(site.locator("[data-theme-name]")).to_have_text("Контраст")
    assert site.evaluate("() => getComputedStyle(document.body).backgroundColor") != bg_classic
    site.reload()
    expect(html).to_have_attribute("data-theme", "bold")


@pytest.mark.parametrize("theme", ["classic", "bold"])
def test_primary_button_text_is_readable_in_both_themes(site: Page, theme):
    """«Контраст»: ссылка-кнопка красилась цветом ссылок — жёлтый текст на жёлтом фоне."""
    site.evaluate(f"() => localStorage.setItem('koleso-theme', '{theme}')")
    site.reload()
    colors = site.evaluate("""() => { const s = getComputedStyle(document.querySelector('.btn--primary'));
        return [s.color, s.backgroundColor] }""")
    assert colors[0] != colors[1]
