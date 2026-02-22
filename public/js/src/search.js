// public/js/src/search.js
import { dom } from './domElements.js';
import { loadNews, currentPage, hasMore } from './newsFeed.js'; // Import relevant newsFeed state and functions
import { openPreview } from './newsDetail.js';
import { openProfilePage } from './profile.js';

let searchDebounceTimer = null;
let userSearchDebounceTimer = null;
let currentSearchMode = 'news'; // New state variable: 'news' or 'user'
let searchQuery = '';
let isSearchMode = false;


export function initSearch() {
    if (dom.searchInput) {
        dom.searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
    }

    if (dom.searchNewsBtn && dom.searchUserBtn) {
        dom.searchNewsBtn.addEventListener('click', () => toggleSearchMode('news'));
        dom.searchUserBtn.addEventListener('click', () => toggleSearchMode('user'));
    }
}

export function toggleSearchMode(mode) {
    currentSearchMode = mode;
    
    if (mode === 'news') {
        dom.searchNewsBtn.classList.add('active');
        dom.searchUserBtn.classList.remove('active');
        dom.searchInput.placeholder = 'Haber ara...';
        // Reset news feed related states
        // currentPage = 1; // Managed internally by newsFeed.loadNews
        // hasMore = true; // Managed internally by newsFeed.loadNews
        dom.newsList.innerHTML = '';
        // If there's a query, perform a news search immediately
        if (dom.searchInput.value.trim()) {
            handleSearch(dom.searchInput.value.trim());
        } else {
            loadNews(); // Or just load default news if no query
        }
    } else { // mode === 'user'
        dom.searchUserBtn.classList.add('active');
        dom.searchNewsBtn.classList.remove('active');
        dom.searchInput.placeholder = 'Kullanıcı ara...';
        dom.newsList.innerHTML = ''; // Clear existing news or previous search results
        // newsFeed.hasMore = false; // User search does not have infinite scroll typically
        renderUserSearchPage(); // Always render user search UI when switching to user mode
        // If there's a query, perform a user search immediately
        if (dom.searchInput.value.trim()) {
            handleSearch(dom.searchInput.value.trim());
        } else {
            // Initial message is already handled by renderUserSearchPage
        }
    }
}

export function handleSearch(query) {
    clearTimeout(searchDebounceTimer);

    if (!query) {
        // Reset to default view based on mode
        if (currentSearchMode === 'news') {
            document.querySelector('.feed-header h1').innerText = 'Son Dakika'; // Placeholder for actual category/following mode
            dom.newsList.innerHTML = '';
            // currentPage = 1;
            // hasMore = true;
            loadNews();
        } else { // user search
            document.querySelector('.feed-header h1').innerText = 'Kullanıcı Arama';
            const userSearchResults = document.getElementById('user-search-results');
            if (userSearchResults) {
                userSearchResults.innerHTML = '<p style="color:var(--text-secondary);">Arama yapmak için yukarıdaki kutucuğa yazın.</p>';
            }
        }
        isSearchMode = false;
        searchQuery = '';
        return;
    }

    searchDebounceTimer = setTimeout(async () => {
        isSearchMode = true;
        searchQuery = query; // Update global searchQuery

        if (currentSearchMode === 'news') {
            document.querySelector('.feed-header h1').innerText = `Arama: "${query}"`;
            dom.newsList.innerHTML = ''; // Clear previous results
            dom.feedLoader.classList.remove('hidden');
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    // newsFeed.renderNews(data.results); // Assuming newsFeed has renderNews
                    const { renderNews } = await import('./newsFeed.js');
                    renderNews(data.results);
                    // newsFeed.hasMore = false; // Search results don't paginate
                } else {
                    dom.newsList.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-secondary);"><i class="fa-solid fa-search" style="font-size:3rem; margin-bottom:15px;"></i><p>Arama sonucu bulunamadı.</p></div>';
                }
            } catch (err) {
                console.error('News search error:', err);
                dom.newsList.innerHTML = '<p style="color:red;">Haber arama sırasında bir hata oluştu.</p>';
            } finally {
                dom.feedLoader.classList.add('hidden');
            }
        } else { // currentSearchMode === 'user'
            document.querySelector('.feed-header h1').innerText = `Kullanıcı Arama: "${query}"`;
            const userSearchResults = document.getElementById('user-search-results');
            if (userSearchResults) {
                userSearchResults.innerHTML = '';
            }
            dom.feedLoader.classList.remove('hidden');
            try {
                const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                displayUserResults(data.users || []);
            } catch (error) {
                console.error('User search error:', error);
                const errorContainer = document.getElementById('user-search-results') || dom.newsList;
                errorContainer.innerHTML = '<p style="color:red;">Kullanıcı arama sırasında bir hata oluştu.</p>';
            } finally {
                dom.feedLoader.classList.add('hidden');
            }
        }
    }, 300);
}

export function renderUserSearchPage() {
    dom.newsList.innerHTML = `
        <div class="user-search-container" style="padding: 20px; background: var(--card-bg); border-radius: 12px;">
            
            
            <div id="user-search-results" class="user-results-list" style="display: flex; flex-wrap: wrap; gap: 15px;">
                <p style="color:var(--text-secondary);">Aramak istediğiniz kullanıcının adını arama alanına yazın.</p>
            </div>
        </div>
    `;

    // userSearchInput is already handled by dom.searchInput, which is listened to by handleSearch
}


export function handleUserSearch(e) {
    // This function is now mostly redundant as handleSearch covers both.
    // It is primarily triggered by initSearch, which passes the value to handleSearch
    // However, if there are specific UI updates only for user search, it can be reactivated.
    // For now, it's effectively handled by handleSearch.
}

export function displayUserResults(users) {
    const resultsContainer = document.getElementById('user-search-results');
    if (!resultsContainer) return; // Guard against element not found

    resultsContainer.innerHTML = ''; // Clear previous results

    if (users.length === 0) {
        resultsContainer.innerHTML = '<p style="color:var(--text-secondary);">Eşleşen kullanıcı bulunamadı.</p>';
        return;
    }

    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.style = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            background: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;
        userCard.onmouseover = (e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
        userCard.onmouseout = (e) => e.currentTarget.style.backgroundColor = 'var(--bg-color)';
        userCard.onclick = () => openProfilePage(null, user.kullanici_adi); // Open profile page

        userCard.innerHTML = `
            <img src="${user.profil_resmi || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'}" alt="${user.kullanici_adi}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
            <span style="font-weight: 600;">${user.kullanici_adi}</span>
        `;
        resultsContainer.appendChild(userCard);
    });
}
