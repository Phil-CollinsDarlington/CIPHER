const themeKey = "cipher-dashboard-theme";
const validThemes = ["cipher", "ocean", "ember", "violet"];
const savedTheme = localStorage.getItem(themeKey);
const initialTheme = validThemes.includes(savedTheme)
    ? savedTheme
    : "cipher";

function applyTheme(theme) {
    const nextTheme = validThemes.includes(theme) ? theme : "cipher";

    document.body.dataset.theme = nextTheme;
    localStorage.setItem(themeKey, nextTheme);
}

applyTheme(initialTheme);

const themePicker = document.getElementById("dashboard-theme");

if (themePicker) {
    themePicker.value = initialTheme;

    themePicker.addEventListener("change", () => {
        applyTheme(themePicker.value);
    });
}
