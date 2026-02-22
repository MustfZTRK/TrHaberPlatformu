// public/js/main.js
import { dom } from './src/domElements.js';
import { getCurrentUser, setCurrentUser, verifySession, checkLoginStatus, updateAuthUI, handleRegister, handleLogin, handleLogout } from './src/auth.js';
import { escapeJsStringLiteral, shareToWhatsApp, shareToTwitter, shareToFacebook, copyToClipboard, openPreviewById } from './src/utils.js';
import { loadCategories, loadNews, renderNews, getFollowBtn, getSaveStatus, getSaveIcon, toggleFollow, toggleSaveArticle } from './src/newsFeed.js';
import { openPreview, closePreview, loadPoll, renderPoll, votePoll, loadComments, handleLike, handlePostComment } from './src/newsDetail.js';
import { openProfilePage, renderProfileView, loadUserStats, switchProfileTab, publishNews, populatePublishForm, getOriginalReshareNewsData, saveProfileSettings, sendMessageTo, openMessagesPanel, openMessagesPanelWithUser, openFollowingPanel, deleteMyNews } from './src/profile.js';
import { initSearch, toggleSearchMode, handleSearch, renderUserSearchPage, displayUserResults } from './src/search.js';
import { initDarkMode, initThemeToggle, toggleDarkMode, updateThemeIcon } from './src/theme.js';
import { initNewsMarquee, initFinanceMarquee } from './src/marquee.js';
import { initCookieConsent, acceptCookies, openLegalModal, closeLegalModal, initLegalModalListeners } from './src/legal.js';

// Expose functions globally for inline HTML event handlers (e.g., onclick)
window.shareToWhatsApp = shareToWhatsApp;
window.shareToTwitter = shareToTwitter;
window.shareToFacebook = shareToFacebook;
window.copyToClipboard = copyToClipboard;
window.toggleSaveArticle = toggleSaveArticle;
window.openPreview = openPreview; // For direct news card clicks and reshares
window.openPreviewById = (id) => openPreviewById(id, openPreview); // For marquee items
window.openLegalModal = openLegalModal;
window.closeLegalModal = closeLegalModal;
window.acceptCookies = acceptCookies;
window.reshareNews = (newsId) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Haberleri yeniden paylaşmak için giriş yapmalısınız.');
        dom.authModal.classList.add('open');
        return;
    }

    fetch(`/api/haberler/${newsId}`)
        .then(res => res.json())
        .then(resp => {
            const newsToReshare = resp && resp.data;
            if (!newsToReshare) {
                alert('Yeniden paylaşılacak haber bulunamadı.');
                return;
            }
            openProfilePage(() => {
                window.switchProfileTab('publish');
                populatePublishForm(newsToReshare);
            });
        })
        .catch(error => {
            console.error('Haber detayları getirilirken hata oluştu:', error);
            alert('Haber detayları getirilirken bir hata oluştu.');
        });
};
window.switchProfileTab = switchProfileTab; // For profile tabs
window.saveProfileSettings = saveProfileSettings; // For profile settings form
window.publishNews = publishNews; // For news publish form
window.getOriginalReshareNewsData = getOriginalReshareNewsData; // For accessing reshared news data
window.sendMessageTo = sendMessageTo; // For messages tab send button
window.openMessagesPanel = openMessagesPanel;
window.openMessagesPanelWithUser = openMessagesPanelWithUser;
window.openFollowingPanel = openFollowingPanel;
window.deleteMyNews = deleteMyNews;
window.handleLike = handleLike; // For like buttons in news detail
window.handlePostComment = handlePostComment; // For comment posting
window.votePoll = votePoll; // For poll voting
window.showReplyForm = (cid, newsId) => { // newsId added as parameter
    const replyArea = document.getElementById(`reply-area-${cid}`);
    if (replyArea) {
        if (replyArea.innerHTML === '') {
            replyArea.innerHTML = `
                <div class="comment-form reply-form">
                    <textarea id="reply-input-${cid}" placeholder="Yanıtınızı yazın..."></textarea>
                    <div style="display:flex; gap:10px;">
                        <button class="btn-login mini" onclick="window.handlePostComment(${newsId}, ${cid})">Yanıtla</button>
                        <button class="icon-btn" onclick="document.getElementById('reply-area-${cid}').innerHTML=''"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>
            `;
        } else {
            replyArea.innerHTML = '';
        }
    }
};
window.openProfilePage = openProfilePage; // Expose openProfilePage for inline clicks

// Expose dom for debugging or specific needs if any other inline script needs it, though generally avoided.
window.dom = dom;

// Initial application setup
document.addEventListener('DOMContentLoaded', () => {
    window.appMode = 'feed';
    // Event Listeners for main layout/modals
    dom.toggleSidebarBtn.addEventListener('click', () => dom.sidebar.classList.toggle('collapsed'));
    dom.closeFrameBtn.addEventListener('click', closePreview);
    dom.newsFeedContainer.addEventListener('scroll', () => {
        if (window.appMode !== 'feed') return;
        // Need to pass current state from newsFeed.js if it's externalized
        // For now, let's re-import or use shared state logic if possible
        // To avoid circular dependency, newsFeed needs to export its state
        // Temporarily using local state variables, consider making these accessible from newsFeed.js
        // via a getter or shared state object.
        // Re-importing newsFeed functions to access its state variables.
        import('./src/newsFeed.js').then(({ isLoading, hasMore, loadNews }) => {
            if (isLoading || !hasMore) return;
            if (dom.newsFeedContainer.scrollTop + dom.newsFeedContainer.clientHeight >= dom.newsFeedContainer.scrollHeight - 100) {
                loadNews();
            }
        });
    });

    dom.openLoginBtn.addEventListener('click', () => dom.authModal.classList.add('open'));
    dom.closeModalBtn.addEventListener('click', () => dom.authModal.classList.remove('open'));

    dom.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            dom.tabBtns.forEach(b => b.classList.remove('active'));
            dom.tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
        });
    });

    dom.registerForm.addEventListener('submit', handleRegister);
    // Pass openProfilePage to handleLogin to resolve potential dependency for post-login actions
    dom.loginForm.addEventListener('submit', (e) => handleLogin(e, openProfilePage));
    dom.logoutBtn.addEventListener('click', handleLogout);

    // Initializations
    initDarkMode();
    checkLoginStatus();
    verifySession();
    loadCategories(openProfilePage, renderUserSearchPage, loadNews); // Pass functions as arguments
    loadNews();
    initNewsMarquee();
    initFinanceMarquee();
    initLegalModalListeners(); // Initialize listeners for legal modals
    initCookieConsent(); // Initialize cookie consent banner
    initSearch();
    initThemeToggle();

    // Auto-refresh finance data every 1 minute
    setInterval(initFinanceMarquee, 60000);

    // Check for news link in URL
    const urlParams = new URLSearchParams(window.location.search);
    const rawNewsParam = urlParams.get('haber');
    const newsIdParam = rawNewsParam ? parseInt(String(rawNewsParam).match(/^\d+/)?.[0] || '') : null;
    if (newsIdParam) {
        fetch(`/api/haberler/${newsIdParam}`)
            .then(res => res.json())
            .then(resp => {
                const news = resp && (resp.data || resp.news || null);
                if (news) openPreview(news);
            })
            .catch(() => {});
    }

    // Placeholder for "Share News" button click
    if (dom.shareNewsBtn) {
        dom.shareNewsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const currentUser = getCurrentUser();
            if (!currentUser) {
                alert('Haber paylaşmak için giriş yapmalısınız.');
                dom.authModal.classList.add('open');
                return;
            }
            openProfilePage(() => {
                window.switchProfileTab('publish');
            }, null);
        });
    }
    if (dom.openMessagesBtn) {
        dom.openMessagesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openMessagesPanel();
        });
    }
});
