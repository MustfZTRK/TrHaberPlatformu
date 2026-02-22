// public/js/src/newsFeed.js
import { dom } from './domElements.js';
import { getCurrentUser, setCurrentUser, updateAuthUI } from './auth.js';
import { openPreview } from './newsDetail.js'; // Assuming openPreview will be exported from newsDetail.js

let currentPage = 1;
let isLoading = false;
let hasMore = true;
let currentCategory = null;
let isFollowingMode = false;
let isSearchMode = false; // This is actually managed by search.js, but newsFeed might need to know if it's in search mode.
let currentGridCols = 1;

export function loadCategories(openProfilePageFunc, renderUserSearchPageFunc, loadNewsFunc) {
    fetch('/api/kategoriler')
        .then(res => res.json())
        .then(categories => {
            const currentUser = getCurrentUser();
            let html = `
                <a href="#" class="nav-item active" data-cat="">
                    <i class="fa-solid fa-house"></i>
                    <span class="nav-text">Anasayfa</span>
                </a>`;

            if (currentUser) {
                html += `
                <a href="#" class="nav-item" id="nav-following">
                    <i class="fa-solid fa-users-viewfinder"></i>
                    <span class="nav-text">Takip Ettiklerim</span>
                </a>`;
            }
               


            // """"<a href="#" class="nav-item" id="nav-user-search"> <!-- Added nav item -->
            //        <i class="fa-solid fa-users"></i>
            //        <span class="nav-text">Kullanıcı Ara</span>
            //    </a>""""
            categories.forEach(cat => {
                let icon = 'fa-hashtag'; // Default icon
                if (cat.ad === 'Spor') icon = 'fa-futbol';
                if (cat.ad === 'Ekonomi') icon = 'fa-coins';
                if (cat.ad === 'Teknoloji') icon = 'fa-microchip';
                if (cat.ad === 'Gündem') icon = 'fa-globe';
                if (cat.ad === 'Sağlık') icon = 'fa-heart-pulse';
                if (cat.ad === 'Bilim') icon = 'fa-flask';
                if (cat.ad === 'Otomobil') icon = 'fa-car';
                if (cat.ad === 'Yapay Zeka') icon = 'fa-robot';
                if (cat.ad === 'Oyun') icon = 'fa-gamepad';
                if (cat.ad === 'Kültür') icon = 'fa-masks-theater';
                if (cat.ad === 'Politika') icon = 'fa-landmark';
                if (cat.ad === 'Güvenlik') icon = 'fa-shield-halved';
                if (cat.ad === 'Uzay') icon = 'fa-satellite';
                html += `
                    <a href="#" class="nav-item" data-cat="${cat.ad}">
                        <i class="fa-solid ${icon}"></i>
                        <span class="nav-text">${cat.ad}</span>
                    </a>
                `;
            });
            dom.navMenu.innerHTML = html;

            const profileBtn = document.querySelector('.profile-link-btn'); // Still in main HTML
            if (profileBtn) {
                profileBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    openProfilePageFunc(null, null);
                });
            }

            dom.navMenu.querySelectorAll('.nav-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();

                    document.querySelector('.feed-header h1').innerText = 'Son Dakika';

                    dom.navMenu.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                    if (profileBtn) profileBtn.classList.remove('active');
                    item.classList.add('active');

                    if (item.id === 'nav-user-search') {
                        document.querySelector('.feed-header h1').innerText = 'Kullanıcı Arama';
                        dom.newsList.innerHTML = '';
                        hasMore = false;
                        renderUserSearchPageFunc();
                        return;
                    }

                    const cat = item.getAttribute('data-cat');
                    currentCategory = cat || null;
                    currentPage = 1;
                    hasMore = true;
                    dom.newsList.innerHTML = '';
                    
                    if (item.id === 'nav-following') {
                        const currentUser = getCurrentUser();
                        if (!currentUser) {
                            alert('Takip ettiklerinizi görmek için giriş yapmalısınız.');
                            dom.authModal.classList.add('open');
                            return;
                        }
                        isFollowingMode = true;
                        currentCategory = null;
                        document.querySelector('.feed-header h1').innerText = 'Takip Ettiklerim';
                    } else {
                        isFollowingMode = false;
                        const cat = item.getAttribute('data-cat');
                        currentCategory = cat || null;
                        document.querySelector('.feed-header h1').innerText = currentCategory || 'Son Dakika';
                    }
                    loadNewsFunc();
                });
            });

            const gridToggle = document.getElementById('grid-toggle');
            if (gridToggle && dom.newsList) {
                const buttons = gridToggle.querySelectorAll('.grid-btn');
                buttons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const cols = parseInt(btn.getAttribute('data-cols') || '1', 10);
                        currentGridCols = cols;
                        dom.newsList.classList.remove('grid-1', 'grid-2', 'grid-3', 'grid-4');
                        dom.newsList.classList.add(`grid-${cols}`);
                        if (dom.newsFeedContainer) {
                            if (cols >= 3) {
                                dom.newsFeedContainer.classList.add('wide-grid');
                            } else {
                                dom.newsFeedContainer.classList.remove('wide-grid');
                            }
                        }
                        buttons.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                    });
                });
                dom.newsList.classList.add('grid-1');
            }
        });
}

export function loadNews() {
    if (isLoading || !hasMore) return;

    isLoading = true;
    dom.feedLoader.classList.remove('hidden');

    let url = `/api/haberler?page=${currentPage}&limit=5`;
    if (currentCategory) url += `&category=${encodeURIComponent(currentCategory)}`;
    
    const currentUser = getCurrentUser();
    if (isFollowingMode && currentUser && currentUser.following) {
        url += `&following=${encodeURIComponent(currentUser.following.join(','))}`;
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.data.length > 0) {
                renderNews(data.data);
                currentPage++;
                hasMore = data.hasMore;
            } else {
                hasMore = false;
            }
        })
        .catch(err => console.error(err))
        .finally(() => {
            isLoading = false;
            dom.feedLoader.classList.add('hidden');
        });
}

export function renderNews(newsData) {
    const currentUser = getCurrentUser();
    const visibleNews = currentUser ? newsData : newsData.filter(n => !n.adult_only);
    visibleNews.forEach(news => {
        const card = document.createElement('div');
        card.className = 'news-card';
        card.innerHTML = `
            <img src="${news.resim_url}" alt="${news.baslik}" class="news-image">
            <div class="news-content">
                
                <div class="source-info">
                    <img src="${news.kaynak.logo}" alt="${news.kaynak.isim}" class="source-logo">
                    <span>${news.kaynak.isim}•</span>
                    <span>${new Date(news.tarih).toLocaleDateString('tr-TR')}</span>
                    ${news.readingTime ? `<span class="reading-time"><i class="fa-regular fa-clock"></i> ${news.readingTime} dk</span>` : ''}
                    <button class="btn-save ${getSaveStatus(news.id)}" onclick="event.stopPropagation(); window.toggleSaveArticle(${news.id}, this)">
                        <i class="${getSaveIcon(news.id)}"></i>
                    </button>
                </div>
                <h3 class="news-title">${news.originalNewsId ? '<i class="fa-solid fa-retweet" title="Yeniden paylaşım"></i> ' : ''}${(news.baslik || '').replace(/^(Yeniden Paylaşım:\s*)+/gi,'').trim()}</h3>
                <p class="news-summary">${news.ozet}</p>
                <div class="news-card-footer">
                    </span>
                    ${getFollowBtn(news.username || '')}
                    <span>
                    
                </div>
            </div>
        `;
        const followBtn = card.querySelector('.btn-follow');
        if (followBtn) {
            followBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!news.username) return;
                toggleFollow(news.username, followBtn);
            });
        }

        card.addEventListener('click', () => openPreview(news));
        dom.newsList.appendChild(card);
    });
}

export function getFollowBtn(username) {
    const currentUser = getCurrentUser();
    if (!username) return '';
    if (!currentUser || currentUser.kullanici_adi === username) return '';
    const isFollowing = currentUser.following && currentUser.following.includes(username);
    return `<button class="btn-follow ${isFollowing ? 'following' : ''}">${isFollowing ? 'Takip Ediliyor' : 'Takip Et'}</button>`;
}

export function getSaveStatus(newsId) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.saved_articles) return '';
    return currentUser.saved_articles.includes(newsId) ? 'saved' : '';
}

export function getSaveIcon(newsId) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.saved_articles) return 'fa-regular fa-bookmark';
    return currentUser.saved_articles.includes(newsId) ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
}

export function toggleFollow(targetUsername, btnElement) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Takip etmek için giriş yapmalısınız.');
        dom.authModal.classList.add('open');
        return;
    }

    fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower: currentUser.kullanici_adi, following: targetUsername })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                currentUser.following = data.followingList;
                setCurrentUser(currentUser); // Update local state via setter
                localStorage.setItem('trhaber_user', JSON.stringify(currentUser)); // Also update localStorage
                updateAuthUI(); // Update UI if necessary

                if (data.isFollowing) {
                    btnElement.classList.add('following');
                    btnElement.innerText = 'Takip Ediliyor';
                } else {
                    btnElement.classList.remove('following');
                    btnElement.innerText = 'Takip Et';
                }
            }
        });
}

export function toggleSaveArticle(newsId, btnElement) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Kaydetmek için giriş yapmalısınız.');
        dom.authModal.classList.add('open');
        return;
    }

    fetch('/api/user/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.kullanici_adi, newsId })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (!currentUser.saved_articles) currentUser.saved_articles = [];
                currentUser.saved_articles = data.savedArticles;
                setCurrentUser(currentUser); // Update local state via setter
                localStorage.setItem('trhaber_user', JSON.stringify(currentUser)); // Also update localStorage

                if (data.isSaved) {
                    btnElement.classList.add('saved');
                    btnElement.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
                } else {
                    btnElement.classList.remove('saved');
                    btnElement.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
                }
            }
        })
        .catch(err => console.error('Save article error:', err));
}

// Export state variables if other modules need to read them (e.g., search.js to know if in following mode)
export { currentPage, isLoading, hasMore, currentCategory, isFollowingMode, isSearchMode };
