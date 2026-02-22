// public/js/src/auth.js
import { dom } from './domElements.js';

let currentUser = null; // Manage currentUser state locally for now, or pass from main

export function getCurrentUser() {
    return currentUser;
}

export function setCurrentUser(user) {
    currentUser = user;
}

export function verifySession() {
    const storedUser = localStorage.getItem('trhaber_user');
    if (!storedUser) return;

    try {
        const user = JSON.parse(storedUser);
        if (!user.kullanici_adi) return;

        fetch(`/api/user/verify/${encodeURIComponent(user.kullanici_adi)}`)
            .then(res => {
                if (res.status === 404) {
                    console.warn('Session verification warning: User not found on server. Autologout disabled for stability.');
                    // handleLogout(); // Disabled to prevent loop on refresh
                }
            })
            .catch(err => {
                console.error('Session verification network error (ignoring):', err);
            });
    } catch (e) {
        console.error('Local storage error:', e);
    }
}

export async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const email = document.getElementById('register-email').value;
    const birthdateStr = document.getElementById('register-birthdate').value;
    // Policy Acceptance Check
    const policyAccepted = document.getElementById('register-policy').checked;
    if (!policyAccepted) {
        alert('Lütfen kullanıcı sözleşmesini ve politikaları kabul edin.');
        return;
    }
    if (!birthdateStr) {
        alert('Lütfen doğum tarihinizi girin.');
        return;
    }
    const birthdate = new Date(birthdateStr);
    const now = new Date();
    let age = now.getFullYear() - birthdate.getFullYear();
    const m = now.getMonth() - birthdate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birthdate.getDate())) {
        age--;
    }
    if (age < 18) {
        alert('18 yaşından küçükler kayıt olamaz.');
        return;
    }

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email, birthdate: birthdateStr })
        });
        const data = await res.json();
        if (data.success) {
            alert('Kayıt başarılı! Lütfen giriş yapın.');
            dom.tabBtns[0].click(); // Assuming login tab is the first one
        } else {
            document.getElementById('register-error').textContent = data.message;
        }
    } catch (err) {
        console.error('Registration error:', err);
    }
}

export async function handleLogin(e, openProfilePageCallback) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    // Policy Acceptance Check
    const policyAccepted = document.getElementById('login-policy').checked;
    if (!policyAccepted) {
        alert('Lütfen giriş yapmak için politikaları onaylayın.');
        return;
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success) {
            loginUser(data.user, openProfilePageCallback);
            dom.authModal.classList.remove('open');
        } else {
            document.getElementById('login-error').textContent = data.message;
        }
    } catch (err) {
        console.error('Login error:', err);
    }
}

export function handleLogout() {
    localStorage.removeItem('trhaber_user');
    currentUser = null;
    updateAuthUI();
    window.location.reload();
}

export function checkLoginStatus() {
    const storedUser = localStorage.getItem('trhaber_user');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        updateAuthUI();
    }
}

export function loginUser(user, openProfilePageCallback) {
    currentUser = user;
    localStorage.setItem('trhaber_user', JSON.stringify(user));
    updateAuthUI(openProfilePageCallback);
}

export function updateAuthUI(openProfilePageCallback) {
    if (currentUser) {
        dom.userActions.classList.add('hidden');
        dom.userProfileSummary.classList.remove('hidden');
        dom.userGreeting.textContent = `Merhaba, ${currentUser.kullanici_adi}`;
        dom.headerAvatar.src = currentUser.profil_resmi || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';

        if (dom.shareNewsBtn) {
            dom.shareNewsBtn.classList.remove('hidden');
        }

        const hasUnread = currentUser.bildirimler && currentUser.bildirimler.some(b => !b.okundu);
        const existingBadge = dom.userProfileSummary.querySelector('.notification-badge');
        if (hasUnread) {
            if (!existingBadge) {
                const badge = document.createElement('span');
                badge.className = 'notification-badge';
                dom.userProfileSummary.style.position = 'relative';
                dom.userProfileSummary.appendChild(badge);
            }
        } else if (existingBadge) {
            existingBadge.remove();
        }

        const existingAdminBtn = document.getElementById('admin-btn');
        if (existingAdminBtn) existingAdminBtn.remove();

        if (currentUser.role === 'admin') {
            const adminBtn = document.createElement('a');
            adminBtn.id = 'admin-btn';
            adminBtn.href = '/admin';
            adminBtn.className = 'icon-btn';
            adminBtn.innerHTML = '<i class="fa-solid fa-screwdriver-wrench"></i>';
            adminBtn.style.marginRight = "10px";
            adminBtn.target = "_blank";
            if (dom.logoutBtn && dom.logoutBtn.parentNode === dom.userProfileSummary) {
                dom.userProfileSummary.insertBefore(adminBtn, dom.logoutBtn);
            } else {
                dom.userProfileSummary.appendChild(adminBtn);
            }
        }
    } else {
        dom.userActions.classList.remove('hidden');
        dom.userProfileSummary.classList.add('hidden');
        if (dom.shareNewsBtn) {
            dom.shareNewsBtn.classList.add('hidden');
        }
    }
}
