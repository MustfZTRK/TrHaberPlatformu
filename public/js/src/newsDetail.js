// public/js/src/newsDetail.js
import { dom } from './domElements.js';
import { getCurrentUser, updateAuthUI } from './auth.js';
import { escapeJsStringLiteral, shareToWhatsApp, shareToTwitter, shareToFacebook, copyToClipboard, sanitizeContentHtml } from './utils.js';
import { getFollowBtn, toggleFollow } from './newsFeed.js'; // getFollowBtn and toggleFollow are already in newsFeed.js
import { openProfilePage } from './profile.js'; // Assuming openProfilePage will be exported from profile.js


export function openPreview(newsParam) {
    let news;
    if (typeof newsParam === 'string') {
        try {
            news = JSON.parse(newsParam);
        } catch (e) {
            console.error('Error parsing newsParam in openPreview:', e);
            return;
        }
    } else {
        news = newsParam;
    }

    if (!news || typeof news.id === 'undefined') {
        console.error('openPreview called with invalid news object or missing ID:', newsParam);
        return;
    }

    console.log('[DEBUG] openPreview received news object:', news);
    console.log('[DEBUG] news.originalNewsId:', news.originalNewsId);

    // Increment view count
    fetch(`/api/haberler/${news.id}/view`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                news.goruntulenme = data.newCount;
                const viewCountElement = document.querySelector('.detail-meta span:first-child');
                if(viewCountElement) viewCountElement.innerHTML = `<i class="fa-regular fa-eye"></i> ${data.newCount}`;
            }
        });

    let isLiked = false;
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.begendigi_haberler && currentUser.begendigi_haberler.includes(news.id)) {
        isLiked = true;
    }

    // Apply dark mode styles to container (handled by CSS, but keeping context)
    const isDarkMode = document.body.classList.contains('dark-mode');

    if (news.originalNewsId) {
        // This is a reshared news item.
        // Fetch original news details
        fetch(`/api/haberler/${news.originalNewsId}`)
            .then(originalRes => {
                const ct = originalRes.headers.get('content-type') || '';
                if (!originalRes.ok) throw new Error(`HTTP ${originalRes.status}`);
                if (!ct.includes('application/json')) throw new Error(`Invalid content-type: ${ct}`);
                return originalRes.json();
            })
            .then(originalNewsData => {
                const originalNews = originalNewsData.data;

                if (originalNews) {
                    const resharerUsername = news.username || (news.kaynak && news.kaynak.isim) || null;
                    const renderReshare = (avatarUrl) => {
                        const resharerAvatar = avatarUrl || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
                        const siteLink = `${window.location.origin}/?haber=${originalNews.id}`;
                        const sourceLink = (originalNews.kaynak && originalNews.kaynak.link) ? originalNews.kaynak.link : '';
                        const userHtml = sanitizeContentHtml(news.icerik || '');
                        const escapedSource = sourceLink ? sourceLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
                        const escapedSite = siteLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        let cleanedUserHtml = userHtml;
                        if (escapedSource) {
                            cleanedUserHtml = cleanedUserHtml.replace(new RegExp(`<a[^>]*href=["']${escapedSource}["'][^>]*>[\\s\\S]*?<\\/a>`, 'gi'), '');
                            cleanedUserHtml = cleanedUserHtml.replace(new RegExp(escapedSource, 'g'), '');
                        }
                        cleanedUserHtml = cleanedUserHtml.replace(new RegExp(`<a[^>]*href=["']${escapedSite}["'][^>]*>[\\s\\S]*?<\\/a>`, 'gi'), '');
                        cleanedUserHtml = cleanedUserHtml.replace(new RegExp(escapedSite, 'g'), '').trim();
                        dom.frameContent.innerHTML = `
                                <div class="detail-container">
                                    <div class="reshare-container" style="padding: 15px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 20px;">
                                        <div class="reshare-header" style="display:flex; align-items:center; gap:10px; margin-bottom:15px;">
                                            <img src="${resharerAvatar}" alt="${news.username}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                                            <div>
                                                <a href="#" onclick="event.preventDefault(); ${resharerUsername ? `window.openProfilePage(null, '${resharerUsername}')` : ''}" style="font-weight:600; color:var(--text-primary); text-decoration:none;">${resharerUsername || 'Kullanıcı'}</a>
                                                <span style="font-size:0.9rem; color:var(--text-secondary); margin-left:6px;"><i class="fa-solid fa-retweet" title="Yeniden paylaşım"></i></span>
                                            </div>
                                        </div>
                                        ${cleanedUserHtml ? `<div class="reshare-user-content" style="margin-bottom:15px; padding-left: 10px; border-left: 3px solid var(--accent-color);">${cleanedUserHtml}</div>` : ''}
                                        <div class="original-news-reshare-card" style="border:1px solid var(--border-color); border-radius:10px; padding:12px; background:var(--card-bg); box-shadow: 0 2px 8px rgba(0,0,0,0.06);" onclick="window.openPreviewById(${originalNews.id})">
                                            ${originalNews.resim_url ? `<img src="${originalNews.resim_url}" alt="${originalNews.baslik}" style="width:100%; height:140px; border-radius:8px; object-fit:cover; margin-bottom:10px;">` : ''}
                                            <div style="font-weight:700; font-size:1rem; color:var(--text-primary); margin-bottom:6px;">${originalNews.baslik}</div>
                                            ${originalNews.ozet ? `<div style="font-size:0.9rem; color:var(--text-secondary); line-height:1.4;">${originalNews.ozet}</div>` : ''}
                                        </div>
                                    </div>
                                    ${generatePollShareCommentsHtml(news, isLiked)}
                                </div>
                            `;
                        postRenderSetup(news);
                    };
 
                    if (resharerUsername) {
                        fetch(`/api/user/profile/${encodeURIComponent(resharerUsername)}`)
                            .then(resharerProfileRes => {
                                const ct = resharerProfileRes.headers.get('content-type') || '';
                                if (!resharerProfileRes.ok) throw new Error(`HTTP ${resharerProfileRes.status}`);
                                if (!ct.includes('application/json')) throw new Error(`Invalid content-type: ${ct}`);
                                return resharerProfileRes.json();
                            })
                            .then(resharerProfile => {
                                renderReshare(resharerProfile.profil_resmi);
                            })
                            .catch(err => {
                                console.error('Error fetching resharer profile:', err);
                                renderReshare(null);
                            });
                    } else {
                        renderReshare(null);
                    }
                } else {
                    console.error('Original news not found for reshared item:', news.originalNewsId);
                    dom.frameContent.innerHTML = generateNewsDetailHtml(news, isLiked);
                    postRenderSetup(news);
                }
            })
            .catch(err => {
                console.error('Error fetching original news for reshared item:', err);
                dom.frameContent.innerHTML = generateNewsDetailHtml(news, isLiked);
                postRenderSetup(news);
            });
    } else {
        dom.frameContent.innerHTML = generateNewsDetailHtml(news, isLiked);
        postRenderSetup(news);
    }

    if (!dom.previewFrame.classList.contains('open')) { // Only open if not already open
        dom.previewFrame.classList.add('open');
        dom.mainContent.classList.add('frame-active');
    }
}

function postRenderSetup(news) {
    // Load Twitter widgets if available for dynamically added content
    if (typeof twttr !== 'undefined' && twttr.widgets) {
        twttr.widgets.load(dom.frameContent);
    }

    // Bind follow button in detail view
    const detailFollowBtn = dom.frameContent.querySelector('.btn-follow');
    if (detailFollowBtn) {
        const target = news.username || (news.kaynak && news.kaynak.isim) || null;
        if (!news.username) {
            detailFollowBtn.style.display = 'none';
        } else {
            detailFollowBtn.addEventListener('click', () => toggleFollow(target, detailFollowBtn));
        }
    }
    
    // Explicitly set global functions for inline handlers, if needed.
    // window.toggleLike = (nid) => handleLike(nid);
    // window.postComment = (nid, pid) => handlePostComment(nid, pid);
    // window.reshareNews = (newsId) => reshareNews(newsId);
    // window.openProfilePage = openProfilePage; // Expose openProfilePage for inline clicks

    loadComments(news.id);
    loadPoll(news.id);
}

// Helper function to generate common HTML for poll, share buttons, and comments
function generatePollShareCommentsHtml(newsItem, isLikedItem) {
    const currentUser = getCurrentUser();
    return `
        <!-- POLL SECTION -->
        <div id="poll-container-${newsItem.id}" class="poll-container"></div>

        <div class="share-buttons">
            <button class="share-btn whatsapp" onclick="window.shareToWhatsApp('${escapeJsStringLiteral(newsItem.baslik)}', '${escapeJsStringLiteral(window.location.origin + '/?haber=' + newsItem.id)}')">
                <i class="fa-brands fa-whatsapp"></i> WhatsApp
            </button>
            <button class="share-btn twitter" onclick="window.shareToTwitter('${escapeJsStringLiteral(newsItem.baslik)}', '${escapeJsStringLiteral(window.location.origin + '/?haber=' + newsItem.id)}')">
                <i class="fa-brands fa-x-twitter"></i> X
            </button>
            <button class="share-btn facebook" onclick="window.shareToFacebook('${escapeJsStringLiteral(window.location.origin + '/?haber=' + newsItem.id)}')">
                <i class="fa-brands fa-facebook"></i> Facebook
            </button>
            <button class="share-btn copy" onclick="window.copyToClipboard('${escapeJsStringLiteral(window.location.origin + '/?haber=' + newsItem.id)}')">
                <i class="fa-solid fa-link"></i> Linki Kopyala
            </button>
            <button class="share-btn" onclick="window.reshareNews(${newsItem.id})" style="background-color: #007bff; color: white;">
                <i class="fa-solid fa-retweet"></i> Yeniden Paylaş
            </button>
        </div>
        <hr style="margin: 30px 0; border: 0; border-top: 1px solid var(--border-color);">
        <div class="comments-section">
            <h3>Yorumlar</h3>
            <div class="comment-form">
                ${currentUser ? `
                    <textarea id="comment-input" placeholder="Yorumunuzu yazın..."></textarea>
                    <button class="btn-login" onclick="window.handlePostComment(${newsItem.id})">Gönder</button>
                ` : `<p><a href="#" onclick="dom.openLoginBtn.click()">Giriş yap</a>arak yorum yapabilirsiniz.</p>`}
            </div>
            <div id="comments-list-${newsItem.id}" class="comments-list">
                <p>Yorumlar yükleniyor...</p>
            </div>
        </div>
    `;
}

// Helper function to generate HTML for a regular news item
function generateNewsDetailHtml(newsItem, isLikedItem) {
    return `
        <div class="detail-container">
            <div class="detail-header">
                <div class="detail-source">
                    <img src="${newsItem.kaynak.logo}" alt="${newsItem.kaynak.isim}">
                    <div>
                        <strong>${newsItem.kaynak.isim}</strong> ${getFollowBtn(newsItem.kaynak.isim)}
                        ${newsItem.kaynak.link ? `<a href="${newsItem.kaynak.link}" target="_blank" class="source-site-btn" title="Siteye Git"><i class="fa-solid fa-up-right-from-square"></i> Kaynağa Git</a>` : ''}<br>
                        <small>${new Date(newsItem.tarih).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                </div>
                <h1 class="detail-title">${newsItem.originalNewsId ? '<i class="fa-solid fa-retweet" title="Yeniden paylaşım"></i> ' : ''}${(newsItem.baslik || '').replace(/^(Yeniden Paylaşım:\s*)+/gi,'').trim()}</h1>
                <div class="detail-meta">
                    <span><i class="fa-regular fa-eye"></i> ${newsItem.goruntulenme}</span>
                    <span id="like-area-${newsItem.id}">
                         <button class="action-btn-text ${isLikedItem ? 'liked' : ''}" onclick="window.handleLike(${newsItem.id})">
                            <i class="${isLikedItem ? 'fa-solid' : 'fa-regular'} fa-heart"></i> <span id="like-count-${newsItem.id}">${newsItem.begeni_sayisi || 0}</span>
                         </button>
                    </span>
                </div>
            </div>
            <img src="${newsItem.resim_url}" alt="${newsItem.baslik}" class="detail-image">
            <div class="detail-body">
                ${sanitizeContentHtml(newsItem.icerik)}
            </div>
            ${generatePollShareCommentsHtml(newsItem, isLikedItem)}
        </div>
    `;
}

export function closePreview() {
    dom.previewFrame.classList.remove('open');
    dom.mainContent.classList.remove('frame-active');
    setTimeout(() => {
        dom.frameContent.innerHTML = '<div class="placeholder-content"><p>Haber detayını görüntülemek için bir habere tıklayın.</p></div>';
    }, 300);
}

export function loadPoll(newsId) {
    const pollContainer = document.getElementById(`poll-container-${newsId}`);
    fetch(`/api/polls/${newsId}`)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.poll) {
                renderPoll(data.poll, pollContainer);
            }
        });
}

export function renderPoll(poll, container) {
    const currentUser = getCurrentUser();
    const hasVoted = currentUser && poll.oy_kullananlar.includes(currentUser.kullanici_adi);
    const totalVotes = poll.secenekler.reduce((sum, opt) => sum + opt.oy_sayisi, 0);

    let html = `
        <div class="poll-card">
            <h4 class="poll-question"><i class="fa-solid fa-square-poll-vertical"></i> ${poll.soru}</h4>
            <div class="poll-options">
                ${poll.secenekler.map(opt => {
        const percent = totalVotes > 0 ? Math.round((opt.oy_sayisi / totalVotes) * 100) : 0;
        if (hasVoted) {
            return `
                            <div class="poll-result-item">
                                <div class="poll-result-labels">
                                    <span>${opt.metin}</span>
                                    <span>%${percent} (${opt.oy_sayisi} oy)</span>
                                </div>
                                <div class="poll-progress-bg">
                                    <div class="poll-progress-bar" style="width: ${percent}%"></div>
                                </div>
                            </div>
                        `;
        } else {
            return `
                            <button class="poll-option-btn" onclick="window.votePoll(${poll.id}, ${opt.id}, ${poll.haber_id})">
                                ${opt.metin}
                            </button>
                        `;
        }
    }).join('')}
            </div>
            <div class="poll-footer">
                <small>${totalVotes} kişi oy kullandı</small>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

export function votePoll(pollId, optionId, newsId) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Oy kullanmak için giriş yapmalısınız.');
        dom.authModal.classList.add('open');
        return;
    }

    fetch('/api/polls/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId, optionId, username: currentUser.kullanici_adi })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                renderPoll(data.poll, document.getElementById(`poll-container-${newsId}`));
            } else {
                alert(data.message || 'Hata oluştu.');
            }
        });
}

export function loadComments(newsId) {
    const listEl = document.getElementById(`comments-list-${newsId}`);
    if (!listEl) return; // Guard against element not found

    fetch(`/api/comments/${newsId}`)
        .then(res => res.json())
        .then(comments => {
            if (comments.length === 0) {
                listEl.innerHTML = '<p style="color:#888;">Henüz yorum yapılmamış.</p>';
                return;
            }

            // Build hierarchy
            const commentMap = {};
            comments.forEach(c => {
                c.replies = [];
                commentMap[c.id] = c;
            });

            const roots = [];
            comments.forEach(c => {
                if (c.parent_id && commentMap[c.parent_id]) {
                    commentMap[c.parent_id].replies.push(c);
                } else {
                    roots.push(c);
                }
            });

            function renderCommentTree(comment, depth = 0) {
                return `
                    <div class="comment-item ${depth > 0 ? 'reply-item' : ''}" style="margin-left: ${depth * 30}px">
                        <div class="comment-header">
                            <strong>${comment.kullanici_adi}</strong> 
                            <small>${new Date(comment.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                        </div>
                        <p>${comment.icerik}</p>
                        <div class="comment-actions">
                            <button class="reply-toggle-btn" onclick="window.showReplyForm(${comment.id}, ${newsId})">
                                <i class="fa-solid fa-reply"></i> Yanıtla
                            </button>
                        </div>
                        <div id="reply-area-${comment.id}" class="reply-input-area"></div>
                        ${comment.replies.map(r => renderCommentTree(r, depth + 1)).join('')}
                    </div>
                `;
            }

            listEl.innerHTML = roots.map(r => renderCommentTree(r)).join('');
        });
}

export function handleLike(newsId) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Beğenmek için giriş yapmalısınız.');
        return;
    }

    fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsId, username: currentUser.kullanici_adi })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const countSpan = document.getElementById(`like-count-${newsId}`);
                if (countSpan) {
                    const btn = countSpan.parentElement;
                    const icon = btn.querySelector('i');
                    countSpan.innerText = data.newCount;
                    if (data.isLiked) {
                        btn.classList.add('liked');
                        icon.classList.remove('fa-regular');
                        icon.classList.add('fa-solid');
                        if (!currentUser.begendigi_haberler) currentUser.begendigi_haberler = [];
                        if (!currentUser.begendigi_haberler.includes(newsId)) currentUser.begendigi_haberler.push(newsId);
                    } else {
                        btn.classList.remove('liked');
                        icon.classList.remove('fa-solid');
                        icon.classList.add('fa-regular');
                        const idx = currentUser.begendigi_haberler.indexOf(newsId);
                        if (idx > -1) currentUser.begendigi_haberler.splice(idx, 1);
                    }
                    // Update current user state and localStorage
                    updateAuthUI(); // This implicitly reflects changes from currentUser state.
                    localStorage.setItem('trhaber_user', JSON.stringify(currentUser));
                }
            }
        });
}

export function handlePostComment(newsId, parentId = null) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Yorum yapmak için giriş yapmalısınız.');
        dom.authModal.classList.add('open');
        return;
    }

    let input;
    if (parentId) {
        input = document.getElementById(`reply-input-${parentId}`);
    } else {
        input = document.getElementById('comment-input');
    }

    const content = input.value.trim();
    if (!content) return;

    fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsId, username: currentUser.kullanici_adi, content, parentId })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                input.value = '';
                if (parentId) {
                    document.getElementById(`reply-area-${parentId}`).innerHTML = '';
                }
                loadComments(newsId); // Reload comments for immediate update
            } else {
                alert(data.message || 'Hata oluştu.');
            }
        });
}
