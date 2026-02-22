// public/js/src/theme.js
import { dom } from './domElements.js';

export function initDarkMode() {
    const savedTheme = localStorage.getItem('trhaber_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        updateThemeIcon(true);
    }
}

export function initThemeToggle() {
    if (dom.themeToggle) {
        dom.themeToggle.addEventListener('click', toggleDarkMode);
    }
}

export function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('trhaber_theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

export function updateThemeIcon(isDark) {
    const icon = dom.themeToggle ? dom.themeToggle.querySelector('i') : null;

    if (icon) {
        icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    if (dom.siteLogo) {
        dom.siteLogo.src = isDark ? 'light-logo.png' : 'dark-logo.png';
    }
}
