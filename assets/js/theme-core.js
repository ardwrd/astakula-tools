(() => {
    const STORAGE_KEY = "tools-astakula-theme";
    const LEGACY_KEY = "tools-astakula-json-theme";
    const DARK_COLOR = "#0f1115";
    const LIGHT_COLOR = "#f3f0e8";

    /*
     * Theme core owns behavior only. Visual rules live in static CSS.
     * These markers intentionally stop older theme.js code from injecting
     * runtime UI styles so the cascade has one visual source of truth.
     */
    function installStaticStyleGuards() {
        ["tools-astakula-runtime-styles", "astakula-seo-aeo-geo-styles"].forEach((id) => {
            if (document.getElementById(id)) return;
            const marker = document.createElement("style");
            marker.id = id;
            marker.dataset.staticUiGuard = "true";
            document.head.appendChild(marker);
        });
    }

    function getStoredTheme() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === "dark" || stored === "light") return stored;

            const legacy = localStorage.getItem(LEGACY_KEY);
            if (legacy === "dark" || legacy === "light") {
                localStorage.setItem(STORAGE_KEY, legacy);
                localStorage.removeItem(LEGACY_KEY);
                return legacy;
            }
        } catch {
            return null;
        }
        return null;
    }

    function getPreferredTheme() {
        return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    function getTheme() {
        return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    }

    function updateThemeMeta(theme) {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", theme === "dark" ? DARK_COLOR : LIGHT_COLOR);
    }

    function updateToggleButtons(theme) {
        const isDark = theme === "dark";
        document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
            button.textContent = isDark ? "Light" : "Dark";
            button.setAttribute("aria-pressed", String(isDark));
            button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
        });
    }

    function applyTheme(theme, persist = false) {
        const normalized = theme === "dark" ? "dark" : "light";
        document.documentElement.dataset.theme = normalized;
        updateThemeMeta(normalized);
        updateToggleButtons(normalized);

        if (persist) {
            try {
                localStorage.setItem(STORAGE_KEY, normalized);
            } catch {
                /* Theme remains active even when browser storage is unavailable. */
            }
        }
    }

    function bindToggles() {
        document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
            if (button.dataset.themeBound === "true") return;
            button.dataset.themeBound = "true";
            button.addEventListener("click", () => {
                applyTheme(getTheme() === "dark" ? "light" : "dark", true);
            });
        });
        updateToggleButtons(getTheme());
        updateThemeMeta(getTheme());
    }

    installStaticStyleGuards();
    applyTheme(getStoredTheme() || getPreferredTheme());

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindToggles, { once: true });
    } else {
        bindToggles();
    }

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", (event) => {
        if (!getStoredTheme()) applyTheme(event.matches ? "dark" : "light");
    });

    window.ToolsAstakulaTheme = { getTheme, applyTheme };
})();
