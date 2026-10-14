"""Скриншоты для README: python docs/shot.py (сайт уже должен отдаваться на :8765)."""

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, size, theme in (
        ("desktop-classic", (1280, 900), "classic"),
        ("desktop-bold", (1280, 900), "bold"),
        ("mobile", (390, 844), "classic"),
    ):
        pg = b.new_page(viewport={"width": size[0], "height": size[1]})
        pg.goto("http://127.0.0.1:8765/")
        pg.evaluate(f"() => {{ localStorage.setItem('koleso-theme', '{theme}'); }}")
        pg.reload()
        pg.screenshot(path=f"docs/{name}.png")
    b.close()
