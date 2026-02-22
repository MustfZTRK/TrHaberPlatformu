// public/js/src/profile.js
import { dom } from './domElements.js';
import { getCurrentUser, setCurrentUser, updateAuthUI } from './auth.js';
import { openPreview } from './newsDetail.js'; // Assuming openPreview is exported from newsDetail.js
import { escapeJsStringLiteral, sanitizeUrl, buildYouTubeEmbed } from './utils.js';

let originalReshareNewsData = null; // Global for resharing logic

export async function openProfilePage(callback, targetUsername = null) {
    window.appMode = 'profile';
    const currentUser = getCurrentUser();
    const userToFetch = targetUsername || (currentUser ? currentUser.kullanici_adi : null);

    if (!userToFetch) {
        alert('Profilinizi görmek veya başka bir kullanıcı profilini açmak için giriş yapmalısınız.');
        dom.authModal.classList.add('open');
        return;
    }

    dom.navMenu.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const profileBtn = document.querySelector('.profile-link-btn'); // Still direct DOM query
    if (profileBtn) profileBtn.classList.add('active');

    dom.newsList.innerHTML = `
        <div class="loading-spinner">
            <i class="fa-solid fa-circle-notch fa-spin"></i> Profil yükleniyor...
        </div>
    `;
    document.querySelector('.feed-header h1').innerText = `${targetUsername ? targetUsername + ' Profili' : 'Profilim'}`;
    // newsFeed.hasMore = false; // Need to manage this state from newsFeed

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const res = await fetch(`/api/user/history/${encodeURIComponent(userToFetch)}`, {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.status === 404) {
            console.warn('User not found during profile fetch');
            dom.newsList.innerHTML = `
                <div style="text-align:center; padding:40px; background:white; border-radius:12px;">
                    <i class="fa-solid fa-exclamation-triangle" style="font-size:3rem; color:#ff9800; margin-bottom:20px;"></i>
                    <h3>Profil Bulunamadı</h3>
                    <p style="color:#666; margin:15px 0;">Kullanıcı bilgileriniz sunucuda bulunamadı.</p>
                    <button onclick="window.location.reload()" class="btn-login">Sayfayı Yenile</button>
                </div>
            `;
            return;
        }
        if (!res.ok) {
            throw new Error('Profil yüklenemedi: ' + res.status);
        }

        const data = await res.json();
        if (!data) return;

        await renderProfileView(data, currentUser, targetUsername); // Pass currentUser and targetUsername

        if (callback && typeof callback === 'function') {
            callback();
        }
    } catch (err) {
        clearTimeout(timeoutId);
        console.error('Profile Load Error:', err);
        const errorMsg = err.name === 'AbortError' ? 'Sunucu yanıt vermiyor (zaman aşımı)' : 'Bilinmeyen bir hata oluştu.';
        dom.newsList.innerHTML = `
            <div style="text-align:center; padding:40px; background:white; border-radius:12px;">
                <i class="fa-solid fa-times-circle" style="font-size:3rem; color:#f44336; margin-bottom:20px;"></i>
                <h3>Profil Yüklenemedi</h3>
                <p style="color:#666; margin:15px 0;">${errorMsg}</p>
                <button onclick="window.location.reload()" class="btn-login">Sayfayı Yenile</button>
            </div>
        `;
    }
}

export function loadUserStats(username) {
    return fetch(`/api/user/stats/${encodeURIComponent(username)}`)
        .then(res => res.json())
        .then(data => data.stats || {})
        .catch(() => ({}));
}

export async function renderProfileView(data, currentUser, targetUsername) {
    const isCurrentUserProfile = currentUser && currentUser.kullanici_adi === (targetUsername || currentUser.kullanici_adi);
    const user = isCurrentUserProfile ? currentUser : data.userProfile; // Use currentUser for own profile, fetched data for others

    if (!user) { // Should not happen if data.userProfile exists for target or currentUser for own.
        console.error("User data missing for profile view.");
        return;
    }

    const userBio = user.bio || 'Henüz bir bio eklenmedi.';
    const notificationCount = user.bildirimler ? user.bildirimler.filter(b => !b.okundu).length : 0; // Filter unread notifications

    const stats = await loadUserStats(user.kullanici_adi);

    let html = `
        <div class="profile-container" data-target-username="${targetUsername || ''}" style="padding: 20px; background: var(--card-bg); border-radius: 12px;">
            <div class="profile-header" style="display:flex; align-items:center; gap:20px; flex-wrap:wrap;">
                <div style="position:relative;">
                    <img src="${user.profil_resmi || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" style="width:100px; height:100px; border-radius:50%; border:2px solid #ddd; object-fit:cover;">
                    ${isCurrentUserProfile && notificationCount > 0 ? `<span style="position:absolute; top:0; right:0; background:red; color:white; border-radius:50%; padding:2px 8px; font-size:0.8rem; border:2px solid white;">${notificationCount}</span>` : ''}
                </div>
                <div>
                    <h2 style="font-size:1.5rem; margin-bottom:5px; color:var(--text-primary);">${user.kullanici_adi}</h2>
                    <p style="color:var(--text-secondary); font-size:0.9rem; margin:5px 0;">${userBio}</p>
                    ${!isCurrentUserProfile ? `<button class="btn-login mini" onclick="window.openMessagesPanelWithUser('${user.kullanici_adi}')"><i class="fa-solid fa-envelope"></i> Bu kişiye mesaj gönder</button>` : ''}
                    ${isCurrentUserProfile ? `<button class="btn-login mini" onclick="window.openFollowingPanel()"><i class="fa-solid fa-user-group"></i> Takip edilenler</button>` : ''}
                    
                    <div class="profile-social-links" style="display:flex; gap:10px; margin:10px 0;">
                        ${Object.entries(user.socialLinks || {}).map(([platform, url]) => {
                            if (!url) return '';
                            const icons = {
                                youtube: 'fa-brands fa-youtube',
                                instagram: 'fa-brands fa-instagram',
                                whatsapp: 'fa-brands fa-whatsapp',
                                x: 'fa-brands fa-x-twitter',
                                facebook: 'fa-brands fa-facebook',
                                linkedin: 'fa-brands fa-linkedin',
                                website: 'fa-solid fa-globe',
                                telegram: 'fa-brands fa-telegram'
                            };
                            return `<a href="${url}" target="_blank" style="color:var(--text-secondary); font-size:1.2rem; transition:color 0.2s;" onmouseover="this.style.color='var(--accent-color)'" onmouseout="this.style.color='var(--text-secondary)'"><i class="${icons[platform] || 'fa-solid fa-link'}"></i></a>`;
                        }).join('')}
                    </div>

                    <div class="user-badges" style="display:flex; gap:10px; margin-bottom:15px; flex-wrap:wrap; margin-top:5px;">
                        ${(() => {
                            let bHtml = '';
                            if (stats.newsCount >= 10) bHtml += `<span class="badge-item" title="Altın Yazar" style="background:#ffd70022; color:#ffd700; border:1px solid #ffd70044; padding:4px 8px; border-radius:12px; font-size:0.7rem; display:flex; align-items:center; gap:5px;"><i class="fa-solid fa-medal"></i> Altın Yazar</span>`;
                            else if (stats.newsCount >= 5) bHtml += `<span class="badge-item" title="Gümüş Yazar" style="background:#c0c0c022; color:#c0c0c0; border:1px solid #c0c0c044; padding:4px 8px; border-radius:12px; font-size:0.7rem; display:flex; align-items:center; gap:5px;"><i class="fa-solid fa-medal"></i> Gümüş Yazar</span>`;
                            else if (stats.newsCount >= 1) bHtml += `<span class="badge-item" title="Bronz Yazar" style="background:#cd7f3222; color:#cd7f32; border:1px solid #cd7f3244; padding:4px 8px; border-radius:12px; font-size:0.7rem; display:flex; align-items:center; gap:5px;"><i class="fa-solid fa-medal"></i> Bronz Yazar</span>`;

                            if (stats.likedCount >= 20) bHtml += `<span class="badge-item" title="Haber Kurdu" style="background:#4facfe22; color:#4facfe; border:1px solid #4facfe44; padding:4px 8px; border-radius:12px; font-size:0.7rem; display:flex; align-items:center; gap:5px;"><i class="fa-solid fa-book-open"></i> Haber Kurdu</span>`;
                            if (stats.followerCount >= 5) bHtml += `<span class="badge-item" title="Fenomen" style="background:#ff475722; color:#ff4757; border:1px solid #ff475744; padding:4px 8px; border-radius:12px; font-size:0.7rem; display:flex; align-items:center; gap:5px;"><i class="fa-solid fa-fire"></i> Fenomen</span>`;
                            if (stats.savedCount >= 5) bHtml += `<span class="badge-item" title="Kaşif" style="background:#2ed57322; color:#2ed573; border:1px solid #2ed57344; padding:4px 8px; border-radius:12px; font-size:0.7rem; display:flex; align-items:center; gap:5px;"><i class="fa-solid fa-compass"></i> Kaşif</span>`;

                            return bHtml || '<span style="font-size:0.7rem; color:#888;">Henüz rozet yok</span>';
                        })()}
                    </div>

                    <div class="user-stats">
                        <div class="stat-item">
                            <span class="stat-number">${stats.followerCount || 0}</span>
                            <span class="stat-label">Takipçi</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${stats.followingCount || 0}</span>
                            <span class="stat-label">Takip</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${stats.likedCount || 0}</span>
                            <span class="stat-label">Beğeni</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">${stats.savedCount || 0}</span>
                            <span class="stat-label">Kaydedilen</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="profile-tabs" style="display:flex; flex-wrap:wrap; gap:8px; border-bottom:1px solid var(--border-color); margin-bottom:20px;">
                <button class="profile-tab-btn active" onclick="window.switchProfileTab('likes')" data-tab="likes">Beğendiklerim</button>
                <button class="profile-tab-btn" onclick="window.switchProfileTab('saved')" data-tab="saved">Kaydedilenler</button>
                <button class="profile-tab-btn" onclick="window.switchProfileTab('notifications')" data-tab="notifications">
                     Bildirimler ${isCurrentUserProfile && user.bildirimler && user.bildirimler.some(b => !b.okundu) ? '<span class="unread-badge-inline"></span>' : ''}
                </button>
                <button class="profile-tab-btn" onclick="window.switchProfileTab('comments')" data-tab="comments">Yorumlarım</button>
                ${isCurrentUserProfile ? `<button class="profile-tab-btn" onclick="window.switchProfileTab('mynews')" data-tab="mynews"><i class="fa-solid fa-newspaper"></i> Paylaşımlarım</button>` : ''}
                ${isCurrentUserProfile ? `<button class="profile-tab-btn" onclick="window.switchProfileTab('publish')" data-tab="publish"><i class="fa-solid fa-pen-to-square"></i> Haber Ekle</button>` : ''}
                ${isCurrentUserProfile ? `<button class="profile-tab-btn" onclick="window.switchProfileTab('settings')" data-tab="settings"><i class="fa-solid fa-gear"></i> Ayarlar</button>` : ''}
            </div>

            <!-- LIKES TAB -->
            <div id="profile-likes-content">
                ${data.likedNews.length === 0 ? '<p style="color:#777; padding:20px; text-align:center;">Henüz hiçbir haberi beğenmediniz.</p>' : ''}
                <div class="news-list">
                ${data.likedNews.map(news => `
                        <div class="news-card" onclick="window.openPreviewById(${news.id})" style="margin-bottom:15px; display:flex; align-items:center;">
                            <img src="${news.resim_url}" style="width:80px; height:60px; object-fit:cover; border-radius:8px; margin:10px;">
                            <div class="news-content" style="padding:10px;">
                                <h3 class="news-title" style="font-size:1rem; margin:0;">${news.baslik}</h3>
                                <small style="color:gray;">${new Date(news.tarih).toLocaleDateString()}</small>
                            </div>
                        </div>
                     `).join('')}
                </div>
            </div>
            
            <!-- SAVEDTAB -->
            <div id="profile-saved-content" style="display:none;">
                <p style="color:#777; padding:20px; text-align:center;">Kaydedilen haberler yükleniyor...</p>
            </div>
            
            <!-- COMMENTS TAB -->
            <div id="profile-comments-content" style="display:none;">
                 ${data.comments.length === 0 ? '<p style="color:#777; padding:20px; text-align:center;">Henüz hiç yorum yapmadınız.</p>' : ''}
                 ${data.comments.map(c => `
                    <div style="background:var(--bg-color); padding:15px; border-radius:8px; margin-bottom:15px; border-left: 3px solid var(--accent-color);">
                        <div style="margin-bottom:5px; font-size:0.9rem; color:#555;">
                            <i class="fa-regular fa-newspaper"></i> <strong>${c.haber_baslik}</strong>
                            <span style="float:right; font-size:0.8rem;">${new Date(c.tarih).toLocaleDateString()}</span>
                        </div>
                        <p style="margin:0; font-style:italic;">"${c.icerik}"</p>
                    </div>
                 `).join('')}
            </div>

            <!-- NOTIFICATIONS TAB -->
            <div id="profile-notifications-content" style="display:none;">
                ${(!user.bildirimler || user.bildirimler.length === 0) ? '<p style="color:#777; padding:20px; text-align:center;">Hiç bildiriminiz yok.</p>' : ''}
                <div class="notifications-list">
                     ${(user.bildirimler || []).map(b => `
                        <div class="notification-item ${b.okundu ? '' : 'unread'}" onclick="${b.tip === 'yeni_haber' ? `window.openPreviewById(${b.haber_id})` : (b.tip === 'mesaj' ? `window.openMessagesPanelWithUser('${b.yazar}')` : '')}">
                            <div class="notification-icon">
                                <i class="${b.tip === 'yeni_haber' ? 'fa-solid fa-bullhorn' : (b.tip === 'mesaj' ? 'fa-solid fa-envelope' : 'fa-solid fa-comment-dots')}"></i>
                            </div>
                            <div class="notification-body">
                                <p>
                                    <strong>${b.yazar}</strong> 
                                    ${b.tip === 'yeni_haber' ? `yeni bir haber paylaştı: "${b.baslik}"` : (b.tip === 'mesaj' ? 'size yeni bir mesaj gönderdi.' : 'yine bir yorumuna yanıt verdi.')}
                                </p>
                                <small>${new Date(b.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                            </div>
                        </div>
                     `).join('')}
                </div>
            </div>
            
            <!-- MESSAGES TAB REMOVED: Mesajlaşma artık üstteki Mesajlar butonu ile açılan panelde -->

            ${isCurrentUserProfile ? `
            <!-- PUBLISH TAB -->
            <div id="profile-publish-content" style="display:none;">
                <div style="background:var(--bg-color); padding:20px; border-radius:8px; border:1px solid var(--border-color);">
                    <h3 style="margin-bottom:15px;">Haber Yayınla</h3>
                    <input type="hidden" id="pub-original-news-id" value="">
                    <div id="original-news-preview-card" style="display:none; margin-bottom:20px; padding:15px; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-color);">
                        <div style="font-style:italic; color:var(--text-secondary); margin-bottom:10px;"><i class="fa-solid fa-retweet" title="Yeniden paylaşım"></i></div>
                        <div class="news-card" style="margin-bottom:0; cursor:pointer;" onclick="window.openPreview(originalReshareNewsData);">
                            <img id="original-pub-img" src="" alt="Original News" class="news-image" style="width:100%; height:auto; border-radius:4px; object-fit:cover;">
                            <div class="news-content" style="padding:10px;">
                                <h3 id="original-pub-title" class="news-title" style="font-size:1.2rem; margin:0 0 5px 0;"></h3>
                                <p id="original-pub-summary" class="news-summary" style="font-size:0.9rem; color:var(--text-secondary); margin:0;"></p>
                                <a id="original-pub-link" href="#" target="_blank" class="original-news-link" style="margin-top:10px; display:inline-block;">Habere Git</a>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Başlık</label>
                        <input type="text" id="pub-title" placeholder="Haberin başlığı..." style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; margin-bottom:10px;">
                    </div>
                    <div class="form-group">
                        <label>Özet</label>
                        <input type="text" id="pub-summary" placeholder="Kısa özet..." style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; margin-bottom:10px;">
                    </div>
                    <div class="form-group">
                        <label>Görsel Seç</label>
                        <div class="image-upload-container" style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <label for="pub-img-upload" class="btn-upload-img">
                                <i class="fa-solid fa-cloud-arrow-up"></i> Resim Yükle
                            </label>
                            <input type="file" id="pub-img-upload" accept="image/*" style="display:none;">
                            <span style="color:var(--text-secondary); font-size:0.85rem;">VEYA</span>
                            <input type="text" id="pub-img" placeholder="Görsel URL (https://...)" style="flex:1; padding:10px; border:1px solid #ddd; border-radius:6px;">
                        </div>
                        <div class="image-preview-area" style="margin-top:10px; text-align:center; border:1px dashed var(--border-color); padding:10px; border-radius:8px; display:none;">
                            <img id="pub-img-preview" src="" alt="Resim Önizleme" style="max-width:100%; max-height:150px; border-radius:4px; object-fit:contain;">
                            <p id="pub-img-preview-text" style="color:var(--text-secondary); margin-top:5px; font-size:0.85rem;">Yüklenen resim önizlemesi</p>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Kategori</label>
                        <select id="pub-cat" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; margin-bottom:10px;">
                            <option value="Gündem">Gündem</option>
                            <option value="Teknoloji">Teknoloji</option>
                            <option value="Spor">Spor</option>
                            <option value="Ekonomi">Ekonomi</option>
                            <option value="Sağlık">Sağlık</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label style="display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" id="pub-adult-only">
                            <span>18 yaşından büyükler içindir</span>
                        </label>
                    </div>
                       <div class="form-group">
                        <label>YouTube Video URL (Opsiyonel)</label>
                        <input type="text" id="pub-youtube-url" placeholder="https://youtube.com/watch?v=..." style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:6px; margin-bottom:10px;">
                    </div>
                    <div class="form-group">
                        <label>X Paylaşım ID (Opsiyonel)</label>
                        <input type="text" id="pub-x-id" placeholder="X paylaşımının ID'si (örn: 1460323737035677698)" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:6px; margin-bottom:10px;">
                    </div>
                    <div class="form-group">
                        <label>İçerik</label>
                        <textarea id="pub-content" rows="6" placeholder="Haber içeriği (HTML destekler)..."></textarea>
                    </div>
                    <button onclick="window.publishNews()" class="btn-login" style="width:100%;">Yayınla</button>
                </div>
            </div>

            <!-- MY NEWS TAB -->
            <div id="profile-mynews-content" style="display:none;">
                <div class="news-list" id="mynews-list"></div>
            </div>

            <!-- SETTINGS TAB -->
            <div id="profile-settings-content" style="display:none;">
                <div style="background:var(--bg-color); padding:20px; border-radius:8px; border:1px solid var(--border-color);">
                    <h3 style="margin-bottom:20px;"><i class="fa-solid fa-user-gear"></i> Profil Ayarları</h3>
                    
                    <div class="form-group" style="margin-bottom:20px;">
                        <label style="display:block; margin-bottom:5px; font-weight:600;">Kullanıcı Adı</label>
                        <input type="text" id="settings-username" value="${user.kullanici_adi}" disabled style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; background:#e9ecef; color:#666;">
                        <small style="color:#999;">Kullanıcı adı değiştirilemez</small>
                    </div>

                    <div class="form-group" style="margin-bottom:20px;">
                        <label style="display:block; margin-bottom:5px; font-weight:600;">Bio</label>
                        <textarea id="settings-bio" rows="3" placeholder="Kendiniz hakkında birkaç kelime...">${user.bio || ''}</textarea>
                    </div>

                    <div class="form-group" style="margin-bottom:20px;">
                        <label style="display:block; margin-bottom:10px; font-weight:600;">Sosyal Medya Hesapları</label>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                            <div class="form-group">
                                <label style="font-size:0.8rem;"><i class="fa-brands fa-x-twitter"></i> X (Twitter)</label>
                                <input type="text" id="settings-social-x" value="${(user.socialLinks && user.socialLinks.x) || ''}" placeholder="https://x.com/username" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;">
                            </div>
                            <div class="form-group">
                                <label style="font-size:0.8rem;"><i class="fa-brands fa-instagram"></i> Instagram</label>
                                <input type="text" id="settings-social-instagram" value="${(user.socialLinks && user.socialLinks.instagram) || ''}" placeholder="https://instagram.com/username" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;">
                            </div>
                            <div class="form-group">
                                <label style="font-size:0.8rem;"><i class="fa-brands fa-youtube"></i> YouTube</label>
                                <input type="text" id="settings-social-youtube" value="${(user.socialLinks && user.socialLinks.youtube) || ''}" placeholder="https://youtube.com/@channel" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;">
                            </div>
                            <div class="form-group">
                                <label style="font-size:0.8rem;"><i class="fa-brands fa-whatsapp"></i> WhatsApp</label>
                                <input type="text" id="settings-social-whatsapp" value="${(user.socialLinks && user.socialLinks.whatsapp) || ''}" placeholder="https://wa.me/numara" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;">
                            </div>
                            <div class="form-group">
                                <label style="font-size:0.8rem;"><i class="fa-brands fa-facebook"></i> Facebook</label>
                                <input type="text" id="settings-social-facebook" value="${(user.socialLinks && user.socialLinks.facebook) || ''}" placeholder="https://facebook.com/username" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;">
                            </div>
                            <div class="form-group">
                                <label style="font-size:0.8rem;"><i class="fa-brands fa-linkedin"></i> LinkedIn</label>
                                <input type="text" id="settings-social-linkedin" value="${(user.socialLinks && user.socialLinks.linkedin) || ''}" placeholder="https://linkedin.com/in/username" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;">
                            </div>
                            <div class="form-group">
                                <label style="font-size:0.8rem;"><i class="fa-brands fa-telegram"></i> Telegram</label>
                                <input type="text" id="settings-social-telegram" value="${(user.socialLinks && user.socialLinks.telegram) || ''}" placeholder="https://t.me/username" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;">
                            </div>
                            <div class="form-group">
                                <label style="font-size:0.8rem;"><i class="fa-solid fa-globe"></i> Web Sitesi</label>
                                <input type="text" id="settings-social-website" value="${(user.socialLinks && user.socialLinks.website) || ''}" placeholder="https://yourwebsite.com" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;">
                            </div>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom:20px;">
                        <label style="display:block; margin-bottom:10px; font-weight:600;">Profil Resmi</label>
                        <div style="display:flex; align-items:center; gap:15px; background:var(--bg-color); padding:15px; border-radius:8px; border:1px solid var(--border-color);">
                            <img id="avatar-preview" src="${user.profil_resmi || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" style="width:80px; height:80px; border-radius:50%; border:2px solid #ddd; object-fit:cover;">
                            <div style="flex:1;">
                                <div style="margin-bottom:10px;">
                                    <label for="settings-avatar-file" style="display:inline-block; padding:6px 12px; background:var(--accent-color); color:white; border-radius:4px; font-size:0.8rem; cursor:pointer;">
                                        <i class="fa-solid fa-upload"></i> Fotoğraf Yükle
                                    </label>
                                    <input type="file" id="settings-avatar-file" accept="image/*" style="display:none;">
                                    <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:5px;">Max: 5MB (PNG, JPG, WEBP)</p>
                                </div>
                                <div class="form-group" style="margin:0;">
                                    <label style="font-size:0.7rem; font-weight:600; color:var(--text-secondary);">VEYA URL İLE EKLE</label>
                                    <input type="text" id="settings-avatar" value="${user.profil_resmi && !user.profil_resmi.startsWith('data:') ? user.profil_resmi : ''}" placeholder="https://..." style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px; font-size:0.8rem;">
                                </div>
                            </div>
                        </div>
                    </div>

                    <button onclick="window.saveProfileSettings()" class="btn-login" style="width:100%; background:#28a745;">
                        <i class="fa-solid fa-save"></i> Değişiklikleri Kaydet
                    </button>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    dom.newsList.innerHTML = html;

    window.switchProfileTab('likes', user); // Pass user to switchProfileTab
    
    // Bindings for dynamically created elements
    const avatarInput = document.getElementById('settings-avatar');
    const fileInput = document.getElementById('settings-avatar-file');
    const preview = document.getElementById('avatar-preview');

    if (avatarInput) {
        avatarInput.addEventListener('input', (e) => {
            if (preview && e.target.value) {
                preview.src = e.target.value;
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    alert('Dosya boyutu çok büyük (Max 5MB)');
                    this.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = function (event) {
                    preview.src = event.target.result;
                    avatarInput.value = ''; // Clear URL input if file is selected
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Image Upload/URL handling for news publishing form
    const pubImgUpload = document.getElementById('pub-img-upload');
    const pubImgUrl = document.getElementById('pub-img');
    const pubImgPreview = document.getElementById('pub-img-preview');
    const imagePreviewArea = document.querySelector('.image-preview-area');

    if (pubImgUpload) {
        pubImgUpload.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    pubImgPreview.src = event.target.result;
                    imagePreviewArea.style.display = 'block';
                    if (pubImgUrl) pubImgUrl.value = ''; // Clear URL input if file is selected
                };
                reader.readAsDataURL(file);
            } else {
                if (pubImgPreview) pubImgPreview.src = '';
                if (imagePreviewArea) imagePreviewArea.style.display = 'none';
            }
        });
    }

    if (pubImgUrl) {
        pubImgUrl.addEventListener('input', function (e) {
            const url = e.target.value;
            if (url) {
                if (pubImgPreview) pubImgPreview.src = url;
                if (imagePreviewArea) imagePreviewArea.style.display = 'block';
                if (pubImgUpload) pubImgUpload.value = ''; // Clear file input if URL is entered
            } else {
                if (pubImgPreview) pubImgPreview.src = '';
                if (imagePreviewArea) imagePreviewArea.style.display = 'none';
            }
        });
    }

    // Populate categories for the publish form
    populateCategories('pub-cat');
}

export function openMessagesPanel() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Mesajlarınızı görmek için giriş yapmalısınız.');
        dom.authModal.classList.add('open');
        return;
    }
    if (dom.previewFrame) dom.previewFrame.classList.remove('open');
    if (dom.messagesFrame) {
        dom.messagesFrame.style.display = 'block';
        dom.messagesFrame.classList.add('open');
    }
    if (dom.mainContent) dom.mainContent.classList.add('frame-active');
    renderMessagesPanel();
    loadConversations(currentUser.kullanici_adi);
    if (dom.closeMessagesBtn) {
        dom.closeMessagesBtn.onclick = () => {
            if (dom.messagesFrame) {
                dom.messagesFrame.classList.remove('open');
                dom.messagesFrame.style.display = 'none';
            }
            if (dom.previewFrame && dom.previewFrame.classList.contains('open')) {
                if (dom.mainContent) dom.mainContent.classList.add('frame-active');
            } else {
                if (dom.mainContent) dom.mainContent.classList.remove('frame-active');
            }
        };
    }
}

export function openMessagesPanelWithUser(targetUsername) {
    openMessagesPanel();
    const currentUser = getCurrentUser();
    if (currentUser && targetUsername && targetUsername !== currentUser.kullanici_adi) {
        openThread(currentUser.kullanici_adi, targetUsername);
    }
}

function renderMessagesPanel() {
    if (!dom.messagesContent) return;
    dom.messagesContent.innerHTML = `
        <div style="display:flex; gap:16px;">
            <div id="conv-list" style="width:35%; border-right:1px solid var(--border-color); padding-right:10px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                    <input type="text" id="new-chat-user" placeholder="Kullanıcı adı..." style="flex:1; padding:8px; border:1px solid var(--border-color); border-radius:6px;">
                    <button class="btn-login mini" id="start-chat-btn"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
                <div id="conversations"></div>
            </div>
            <div id="thread-area" style="flex:1;">
                <div id="thread-header" style="margin-bottom:8px; color:var(--text-secondary);"></div>
                <div id="thread-messages" style="max-height:380px; overflow:auto; background:var(--bg-color); border:1px solid var(--border-color); border-radius:8px; padding:10px; margin-bottom:10px;"></div>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="thread-input" placeholder="Mesaj yaz..." style="flex:1; padding:10px; border:1px solid #ddd; border-radius:6px;">
                    <button class="btn-login" id="thread-send-btn">Gönder</button>
                </div>
            </div>
        </div>
    `;
    const startBtn = document.getElementById('start-chat-btn');
    const inputUser = document.getElementById('new-chat-user');
    if (startBtn && inputUser) {
        startBtn.onclick = () => {
            const target = (inputUser.value || '').trim();
            const currentUser = getCurrentUser();
            if (!target || !currentUser || target === currentUser.kullanici_adi) return;
            openThread(currentUser.kullanici_adi, target);
        };
    }
}

function loadConversations(username) {
    const listEl = document.getElementById('conversations');
    if (!listEl) return;
    listEl.innerHTML = '<p style="color:#777;">Yükleniyor...</p>';
    fetch(`/api/messages/conversations/${encodeURIComponent(username)}`)
        .then(res => res.json())
        .then(data => {
            const convs = data.conversations || [];
            if (convs.length === 0) {
                listEl.innerHTML = '<p style="color:#777;">Henüz konuşma yok.</p>';
                return;
            }
            listEl.innerHTML = convs.map(c => `
                <div class="conv-item" data-user="${c.user.kullanici_adi}" style="display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; cursor:pointer; margin-bottom:6px; background:var(--card-bg); border:1px solid var(--border-color);">
                    <img src="${c.user.profil_resmi}" style="width:34px; height:34px; border-radius:50%; object-fit:cover;">
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between;">
                            <strong>${c.user.kullanici_adi}</strong>
                            ${c.unread > 0 ? `<span style="background:#ff3b30; color:white; border-radius:10px; padding:2px 6px; font-size:0.75rem;">${c.unread}</span>` : ''}
                        </div>
                        <small style="color:#777;">${c.lastMessage.content}</small>
                    </div>
                </div>
            `).join('');
            document.querySelectorAll('.conv-item').forEach(item => {
                item.addEventListener('click', () => {
                    const other = item.getAttribute('data-user');
                    openThread(username, other);
                });
            });
        });
}

function openThread(userA, userB) {
    const headerEl = document.getElementById('thread-header');
    const threadEl = document.getElementById('thread-messages');
    const sendBtn = document.getElementById('thread-send-btn');
    const inputEl = document.getElementById('thread-input');
    if (!headerEl || !threadEl || !sendBtn || !inputEl) return;
    headerEl.innerHTML = `<i class="fa-solid fa-user"></i> Sohbet: <strong>${userB}</strong>`;
    fetch(`/api/messages/thread/${encodeURIComponent(userA)}/${encodeURIComponent(userB)}`)
        .then(res => res.json())
        .then(data => {
            const msgs = data.messages || [];
            if (msgs.length === 0) {
                threadEl.innerHTML = '<p style="color:#777;">Henüz mesaj yok.</p>';
            } else {
                threadEl.innerHTML = msgs.map(m => `
                    <div style="display:flex; ${m.from === userA ? 'justify-content:flex-end' : 'justify-content:flex-start'}; margin-bottom:6px;">
                        <div style="max-width:70%; padding:8px 10px; border-radius:12px; ${m.from === userA ? 'background:#1877f2; color:white;' : 'background:#f1f1f1; color:#333;'}">
                            <small style="opacity:0.8;">${m.from}</small><br>
                            ${m.content}
                            <div style="text-align:right; font-size:0.7rem; opacity:0.7;">${new Date(m.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                    </div>
                `).join('');
                threadEl.scrollTop = threadEl.scrollHeight;
            }
            fetch('/api/messages/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userA, userB })
            });
        });
    sendBtn.onclick = () => {
        const content = (inputEl.value || '').trim();
        if (!content) return;
        fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: userA, to: userB, content })
        }).then(res => res.json()).then(resp => {
            inputEl.value = '';
            openThread(userA, userB);
            loadConversations(userA);
        });
    };
}

export function openFollowingPanel() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        dom.authModal.classList.add('open');
        return;
    }
    if (dom.previewFrame) dom.previewFrame.classList.remove('open');
    if (dom.messagesFrame) dom.messagesFrame.classList.remove('open');
    if (dom.followingFrame) {
        dom.followingFrame.style.display = 'block';
        dom.followingFrame.classList.add('open');
    }
    if (dom.mainContent) dom.mainContent.classList.add('frame-active');
    renderFollowingPanel();
    loadFollowingList(currentUser.kullanici_adi);
    if (dom.closeFollowingBtn) {
        dom.closeFollowingBtn.onclick = () => {
            if (dom.followingFrame) {
                dom.followingFrame.classList.remove('open');
                dom.followingFrame.style.display = 'none';
            }
            if (dom.previewFrame && dom.previewFrame.classList.contains('open')) {
                if (dom.mainContent) dom.mainContent.classList.add('frame-active');
            } else {
                if (dom.mainContent) dom.mainContent.classList.remove('frame-active');
            }
        };
    }
}

function renderFollowingPanel() {
    if (!dom.followingContent) return;
    dom.followingContent.innerHTML = `
        <div style="padding:10px;">
            <h3 style="margin-bottom:10px;">Takip Ettiklerim</h3>
            <div id="following-list"></div>
        </div>
    `;
}

function loadFollowingList(username) {
    const currentUser = getCurrentUser();
    const listEl = document.getElementById('following-list');
    if (!listEl || !currentUser) return;
    const following = currentUser.following || [];
    if (following.length === 0) {
        listEl.innerHTML = '<p style="color:#777;">Hiç kimseyi takip etmiyorsunuz.</p>';
        return;
    }
    fetch(`/api/users/list?usernames=${encodeURIComponent(following.join(','))}`)
        .then(res => res.json())
        .then(data => {
            const users = data.users || [];
            listEl.innerHTML = users.map(u => `
                <div class="following-item" data-user="${u.kullanici_adi}" style="display:flex; align-items:center; gap:10px; padding:8px; border:1px solid var(--border-color); border-radius:8px; margin-bottom:8px; background:var(--card-bg);">
                    <img src="${u.profil_resmi}" style="width:34px; height:34px; border-radius:50%; object-fit:cover;">
                    <div style="flex:1;">
                        <strong>${u.kullanici_adi}</strong>
                        <div style="color:#777; font-size:0.85rem;">${u.bio}</div>
                    </div>
                    <button class="btn-login mini unfollow-btn">Takibi bırak</button>
                </div>
            `).join('');
            document.querySelectorAll('.following-item .unfollow-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const parent = e.target.closest('.following-item');
                    const other = parent.getAttribute('data-user');
                    unfollowUser(currentUser.kullanici_adi, other, parent);
                });
            });
        });
}

function unfollowUser(me, other, rowEl) {
    fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower: me, following: other })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            rowEl.remove();
            const currentUser = getCurrentUser();
            if (currentUser) {
                currentUser.following = data.followingList;
                setCurrentUser(currentUser);
                localStorage.setItem('trhaber_user', JSON.stringify(currentUser));
                updateAuthUI();
            }
            const listEl = document.getElementById('following-list');
            if (listEl && listEl.children.length === 0) {
                listEl.innerHTML = '<p style="color:#777;">Hiç kimseyi takip etmiyorsunuz.</p>';
            }
        }
    });
}
export function switchProfileTab(tab, user = getCurrentUser()) {
    document.querySelectorAll('.profile-tab-btn').forEach(b => {
        b.style.borderBottom = 'none';
        b.style.color = 'gray';
        if (b.dataset.tab === tab) {
            b.style.borderBottom = '2px solid #1877f2';
            b.style.color = '#1877f2';
        }
    });

    ['likes', 'saved', 'notifications', 'comments', 'mynews', 'publish', 'settings'].forEach(t => {
        const el = document.getElementById(`profile-${t}-content`);
        if (el) {
            el.style.display = (t === tab) ? 'block' : 'none';
        }
    });

    if (tab === 'notifications') {
        if (!user) return; // Guard if user is not logged in

        fetch('/api/notifications/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user.kullanici_adi })
        }).then(() => {
            // Update the user object (if it's the current user)
            const currentUser = getCurrentUser();
            if (currentUser && currentUser.kullanici_adi === user.kullanici_adi) {
                currentUser.bildirimler = currentUser.bildirimler.map(b => ({ ...b, okundu: true }));
                setCurrentUser(currentUser);
                localStorage.setItem('trhaber_user', JSON.stringify(currentUser));
                updateAuthUI(); // Update header badge
            }
            // Clear inline badges (e.g., in profile tab)
            document.querySelectorAll('.unread-badge-inline').forEach(b => b.remove());
        });
    }

    if (tab === 'saved') {
        const savedContent = document.getElementById('profile-saved-content');
        if (!user) {
            savedContent.innerHTML = '<p style="color:#777; padding:20px; text-align:center;">Kaydedilen haberleri görmek için giriş yapmalısınız.</p>';
            return;
        }
        fetch(`/api/user/saved/${user.kullanici_adi}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.savedNews) {
                    if (data.savedNews.length === 0) {
                        savedContent.innerHTML = '<p style="color:#777; padding:20px; text-align:center;">Henüz hiçbir haber kaydetmediniz.</p>';
                    } else {
                        savedContent.innerHTML = `
                            <div class="news-list">
                                ${data.savedNews.map(news => `
                                    <div class="news-card" onclick="window.openPreviewById(${news.id})" style="margin-bottom:15px; display:flex; align-items:center;">
                                        <img src="${sanitizeUrl(news.resim_url)}" style="width:80px; height:60px; object-fit:cover; border-radius:8px; margin:10px;">
                                        <div class="news-content" style="padding:10px;">
                                            <h3 class="news-title" style="font-size:1rem; margin:0;">${news.originalNewsId ? '<i class="fa-solid fa-retweet" title="Yeniden paylaşım"></i> ' : ''}${(news.baslik || '').replace(/^(Yeniden Paylaşım:\s*)+/gi,'').trim()}</h3>
                                            <small style="color:gray;">${new Date(news.tarih).toLocaleDateString()}</small>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }
                }
            });
    }

    if (tab === 'mynews') {
        if (!user) return;
        const listEl = document.getElementById('mynews-list');
        if (!listEl) return;
        listEl.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Paylaşımlar yükleniyor...</div>`;
        fetch(`/api/user/news/${encodeURIComponent(user.kullanici_adi)}`)
            .then(res => res.json())
            .then(data => {
                const items = (data && data.data) || [];
                if (items.length === 0) {
                    listEl.innerHTML = '<p style="color:#777; padding:20px; text-align:center;">Henüz bir paylaşımınız yok.</p>';
                    return;
                }
                listEl.innerHTML = '';
                items.forEach(n => {
                    const card = document.createElement('div');
                    card.className = 'news-card';
                    card.style.position = 'relative';
                    card.style.cursor = 'pointer';
                    card.innerHTML = `
                        <button class="icon-btn" title="Sil" style="position:absolute; top:10px; right:10px; z-index:2;" onclick="event.stopPropagation(); window.deleteMyNews(${n.id})"><i class="fa-solid fa-trash"></i></button>
                        <img src="${n.resim_url}" alt="${n.baslik}" class="news-image">
                        <div class="news-content">
                            <div class="source-info">
                                <img src="${(n.kaynak && n.kaynak.logo) || 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png'}" class="source-logo">
                                <span>${(n.kaynak && n.kaynak.isim) || user.kullanici_adi}</span>
                                <span>•</span>
                                <span>${new Date(n.tarih).toLocaleDateString('tr-TR')}</span>
                            </div>
                            <h3 class="news-title">${(n.baslik || '').replace(/^(Yeniden Paylaşım:\s*)+/gi,'').trim()}</h3>
                            <p class="news-summary">${n.ozet || ''}</p>
                        </div>
                    `;
                    card.addEventListener('click', () => window.openPreviewById(n.id));
                    listEl.appendChild(card);
                });
            });
    }
    

    // messages tab kaldırıldı
}

function populateCategories(selectElementId) {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) return;

    fetch('/api/kategoriler')
        .then(res => res.json())
        .then(categories => {
            selectElement.innerHTML = '';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.ad;
                option.textContent = cat.ad;
                selectElement.appendChild(option);
            });
        })
        .catch(err => console.error('Error fetching categories:', err));
}

export function publishNews() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Haber yayınlamak için giriş yapmalısınız.');
        dom.authModal.classList.add('open');
        return;
    }

    const baslik = document.getElementById('pub-title').value;
    const ozet = document.getElementById('pub-summary').value;
    const kategori = document.getElementById('pub-cat').value;
    let icerik = document.getElementById('pub-content').value;
    const youtubeUrl = document.getElementById('pub-youtube-url').value;
    const xId = document.getElementById('pub-x-id').value;
    const originalNewsId = document.getElementById('pub-original-news-id').value;
    const adultOnly = document.getElementById('pub-adult-only')?.checked || false;

    let resim_url = '';
    const pubImgUpload = document.getElementById('pub-img-upload');
    const pubImgUrl = document.getElementById('pub-img');
    const pubImgPreview = document.getElementById('pub-img-preview');

    if (pubImgUpload && pubImgUpload.files && pubImgUpload.files.length > 0) {
        resim_url = pubImgPreview.src;
    } else if (pubImgUrl) {
        resim_url = pubImgUrl.value;
    }

    if (!baslik || !ozet || !icerik || !resim_url) {
        alert('Lütfen tüm zorunlu alanları (Başlık, Özet, İçerik, Görsel) doldurun.');
        return;
    }

    if (youtubeUrl) {
        const embedHtml = buildYouTubeEmbed(youtubeUrl);
        if (embedHtml) icerik = embedHtml + icerik;
    }

    if (xId) {
        const xEmbedHtml = `<blockquote class="twitter-tweet" data-dnt="true" data-theme="${document.body.classList.contains('dark-mode') ? 'dark' : 'light'}"><p lang="en" dir="ltr"></p>&mdash; X User (@x_user) <a href="https://twitter.com/x_user/status/${xId}?ref_src=twsrc%5Etfw">Date of tweet</a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`;
        icerik = xEmbedHtml + icerik;
    }

    const postData = {
        baslik,
        ozet,
        resim_url,
        kategori,
        icerik,
        username: currentUser.kullanici_adi,
        adult_only: adultOnly
    };
    if (originalNewsId) {
        postData.originalNewsId = originalNewsId;
    }

    fetch('/api/user/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
    })
        .then(res => res.json())
        .then(res => {
            if (res.success) {
                alert('Haberiniz başarıyla yayınlandı!');
                openProfilePage();
            } else {
                alert('Hata: ' + res.message);
            }
        })
        .catch(err => {
            alert('Haber yayınlanırken bir hata oluştu.');
            console.error(err);
        });
}

export function populatePublishForm(news) {
    document.getElementById('pub-title').value = '';
    document.getElementById('pub-summary').value = '';
    document.getElementById('pub-img').value = '';
    document.getElementById('pub-content').value = '';
    if (document.getElementById('pub-youtube-url')) document.getElementById('pub-youtube-url').value = '';
    if (document.getElementById('pub-x-id')) document.getElementById('pub-x-id').value = '';
    if (document.getElementById('pub-img-upload')) document.getElementById('pub-img-upload').value = '';
    if (document.getElementById('pub-img-preview')) document.getElementById('pub-img-preview').src = '';
    if (document.querySelector('.image-preview-area')) document.querySelector('.image-preview-area').style.display = 'none';

    const originalNewsCardContainer = document.getElementById('original-news-preview-card');
    const pubOriginalNewsIdInput = document.getElementById('pub-original-news-id');

    if (news) {
        pubOriginalNewsIdInput.value = news.id;
        originalNewsCardContainer.style.display = 'block';
        document.getElementById('original-pub-img').src = news.resim_url;
        document.getElementById('original-pub-title').innerText = news.baslik;
        document.getElementById('original-pub-summary').innerText = news.ozet;
        document.getElementById('original-pub-link').href = `${window.location.origin}/?haber=${news.id}`;
        originalReshareNewsData = news;

        document.getElementById('pub-title').value = news.baslik;
        document.getElementById('pub-summary').value = news.ozet;
        document.getElementById('pub-content').value = '';
        
        document.getElementById('pub-img').value = news.resim_url;
        const pubImgPreview = document.getElementById('pub-img-preview');
        const imagePreviewArea = document.querySelector('.image-preview-area');
        if (news.resim_url && pubImgPreview && imagePreviewArea) {
            pubImgPreview.src = news.resim_url;
            imagePreviewArea.style.display = 'block';
        }

        const pubCatSelect = document.getElementById('pub-cat');
        if (pubCatSelect) {
            const optionExists = Array.from(pubCatSelect.options).some(option => option.value === news.kategori);
            if (optionExists) {
                pubCatSelect.value = news.kategori;
            } else {
                pubCatSelect.value = pubCatSelect.options[0].value;
            }
        }
    } else {
        pubOriginalNewsIdInput.value = '';
        originalNewsCardContainer.style.display = 'none';
        document.getElementById('original-pub-img').src = '';
        document.getElementById('original-pub-title').innerText = '';
        document.getElementById('original-pub-summary').innerText = '';
        document.getElementById('original-pub-link').href = '#';
        originalReshareNewsData = null;
    }
}

// Global exposure for originalReshareNewsData in inline HTML
export function getOriginalReshareNewsData() {
    return originalReshareNewsData;
}

export function deleteMyNews(newsId) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Haber silmek için giriş yapmalısınız.');
        dom.authModal.classList.add('open');
        return;
    }
    if (!confirm('Bu haberi silmek istediğinize emin misiniz?')) return;
    fetch(`/api/user/news/${newsId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.kullanici_adi })
    })
        .then(res => res.json())
        .then(data => {
            if (data && data.success) {
                switchProfileTab('mynews', currentUser);
            } else {
                alert((data && data.message) || 'Silme işlemi başarısız.');
            }
        })
        .catch(() => alert('Silme sırasında bir hata oluştu.'));
}

export function saveProfileSettings() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Profil ayarlarını kaydetmek için giriş yapmalısınız.');
        dom.authModal.classList.add('open');
        return;
    }

    const bio = document.getElementById('settings-bio').value;
    const urlAvatar = document.getElementById('settings-avatar').value;
    const previewSrc = document.getElementById('avatar-preview').src;

    const avatarUrl = previewSrc.startsWith('data:') ? previewSrc : (urlAvatar || currentUser.profil_resmi);
    const socialLinks = {
        x: document.getElementById('settings-social-x').value,
        instagram: document.getElementById('settings-social-instagram').value,
        youtube: document.getElementById('settings-social-youtube').value,
        whatsapp: document.getElementById('settings-social-whatsapp').value,
        facebook: document.getElementById('settings-social-facebook').value,
        linkedin: document.getElementById('settings-social-linkedin').value,
        telegram: document.getElementById('settings-social-telegram').value,
        website: document.getElementById('settings-social-website').value
    };

    fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: currentUser.kullanici_adi,
            bio: bio,
            avatarUrl: avatarUrl,
            socialLinks: socialLinks
        })
    }).then(res => res.json()).then(res => {
        if (res.success) {
            currentUser.bio = bio;
            currentUser.profil_resmi = avatarUrl;
            currentUser.socialLinks = socialLinks;
            setCurrentUser(currentUser); // Update local state via setter
            localStorage.setItem('trhaber_user', JSON.stringify(currentUser));
            updateAuthUI();
            alert('Profil ayarlarınız başarıyla güncellendi!');
            openProfilePage();
        } else {
            alert('Hata: ' + (res.message || 'Bilinmeyen hata'));
        }
    }).catch(err => {
        alert('Profil güncellenirken bir hata oluştu.');
        console.error(err);
    });
}

export function sendMessageTo() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Mesaj göndermek için giriş yapmalısınız.');
        dom.authModal.classList.add('open');
        return;
    }
    const profileContainer = document.querySelector('.profile-container');
    const targetUsername = profileContainer ? profileContainer.getAttribute('data-target-username') : null;
    if (!targetUsername || targetUsername === currentUser.kullanici_adi) {
        alert('Bir kullanıcı profiline giderek mesaj gönderebilirsiniz.');
        return;
    }
    const input = document.getElementById('message-input');
    const content = (input?.value || '').trim();
    if (!content) return;
    fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: currentUser.kullanici_adi, to: targetUsername, content })
    })
    .then(res => res.json())
    .then(data => {
        input.value = '';
        openMessagesPanelWithUser(targetUsername);
    });
}
