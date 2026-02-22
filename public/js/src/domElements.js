// public/js/src/domElements.js
// Centralized DOM element references

export const dom = {
    // ---- Değişkenler ----
    newsList: document.getElementById('news-list'),
    previewFrame: document.getElementById('preview-frame'),
    frameContent: document.getElementById('frame-content'),
    closeFrameBtn: document.getElementById('close-frame-btn'),
    messagesFrame: document.getElementById('messages-frame'),
    messagesContent: document.getElementById('messages-content'),
    closeMessagesBtn: document.getElementById('close-messages-btn'),
    followingFrame: document.getElementById('following-frame'),
    followingContent: document.getElementById('following-content'),
    closeFollowingBtn: document.getElementById('close-following-btn'),
    mainContent: document.getElementById('main-content'),
    toggleSidebarBtn: document.getElementById('toggle-sidebar'),
    sidebar: document.getElementById('sidebar'),
    newsFeedContainer: document.getElementById('news-feed-container'),
    feedLoader: document.getElementById('feed-loader'),
    navMenu: document.querySelector('.nav-menu'),

    // Auth vars
    authModal: document.getElementById('auth-modal'),
    openLoginBtn: document.getElementById('open-login-btn'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    userActions: document.getElementById('user-actions'),
    userProfileSummary: document.getElementById('user-profile-summary'),
    userGreeting: document.getElementById('user-greeting'),
    headerAvatar: document.getElementById('header-avatar'),
    logoutBtn: document.getElementById('logout-btn'),
    shareNewsBtn: document.getElementById('share-news-btn'), // Get reference to new button
    openMessagesBtn: document.getElementById('open-messages-btn'),

    // Auth Forms
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Search Elements
    searchInput: document.getElementById('search-input'),
    searchNewsBtn: document.getElementById('search-news-btn'),
    searchUserBtn: document.getElementById('search-user-btn'),

    // Theme Toggle
    themeToggle: document.getElementById('theme-toggle'),
    siteLogo: document.getElementById('site-logo'), // Assuming site logo needs to be updated with theme

    // Marquees
    newsMarquee: document.getElementById('news-marquee'),
    financeMarquee: document.getElementById('finance-marquee'),

    // Cookie Banner
    cookieBanner: document.getElementById('cookie-banner'),

    // Legal Frame & Modal
    legalFrame: document.getElementById('legal-frame'),
    legalFrameContent: document.getElementById('legal-frame-content'),
    closeLegalFrameBtn: document.getElementById('close-legal-frame-btn'),
    legalContent: document.getElementById('legal-content'),
    legalModal: document.getElementById('legal-modal')
};
