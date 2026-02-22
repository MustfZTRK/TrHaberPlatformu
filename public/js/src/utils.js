// public/js/src/utils.js
import { dom } from './domElements.js';

// Function to safely escape a string for use as a single-quoted JavaScript string literal inside an HTML attribute
export function escapeJsStringLiteral(str) {
    if (typeof str !== 'string') {
        return '';
    }
    // Escape backslashes first, then single quotes, then double quotes (just in case)
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// ---- Social Sharing Functions ----
export function shareToWhatsApp(title, url) {
    const text = encodeURIComponent(`${title} - ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
}

export function shareToTwitter(title, url) {
    const text = encodeURIComponent(title);
    const shareUrl = encodeURIComponent(url);
    const intentUrl = `https://x.com/intent/tweet?text=${text}&url=${shareUrl}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
}

export function shareToFacebook(url) {
    const shareUrl = encodeURIComponent(url);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`, '_blank');
}

export function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Link kopyalandı!');
    }).catch(err => {
        console.error('Copy failed:', err);
    });
}

export function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    let cleaned = url.trim();
    cleaned = cleaned.replace(/^file:/i, '');
    cleaned = cleaned.replace(/[`"'\\]/g, '');
    if (/^https?:\/\//i.test(cleaned)) return cleaned;
    return '#';
}

export function buildYouTubeEmbed(input) {
    if (!input || typeof input !== 'string') return '';
    let raw = input.trim().replace(/[`"'\\]/g, '');
    let videoId = '';
    const params = new URLSearchParams();
    try {
        const u = new URL(raw.startsWith('http') ? raw : `https://${raw.replace(/^\/+/, '')}`);
        if (u.hostname.includes('youtu.be')) {
            const path = u.pathname.replace(/^\/+/, '');
            videoId = path.split(/[?&]/)[0];
        } else {
            if (u.pathname.includes('/embed/')) {
                const seg = u.pathname.split('/embed/')[1];
                videoId = (seg || '').split(/[?&]/)[0];
            } else {
                videoId = u.searchParams.get('v') || '';
            }
            ['list', 'start', 't'].forEach(k => {
                const v = u.searchParams.get(k);
                if (v) params.set(k, v);
            });
        }
    } catch (_) {
        const m = raw.match(/([A-Za-z0-9_-]{6,})/);
        videoId = m ? m[1] : '';
    }
    if (!videoId) return '';
    const qs = params.toString();
    const src = `https://www.youtube.com/embed/${videoId}${qs ? `?${qs}` : ''}`;
    return `<div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; margin:20px 0;"><iframe style="position:absolute; top:0; left:0; width:100%; height:100%;" src="${src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
}

export function sanitizeContentHtml(html) {
    if (!html || typeof html !== 'string') return '';
    let s = html;
    s = s.replace(/file:\/\/[^\s"'<>]*/gi, '');
    s = s.replace(/%22/g, '');
    // Convert fenced code blocks ```...``` into <pre><code>...</code></pre>
    s = s.replace(/```([\s\S]*?)```/g, (_, code) => {
        const escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return `<pre style="background:#f6f8fa; padding:12px; border-radius:6px; overflow:auto;"><code style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:0.9rem;">${escaped}</code></pre>`;
    });
    s = s.replace(/https?:\/\/\/+/gi, (m) => (m.startsWith('https') ? 'https://' : 'http://'));
    return s;
}

// Global variable for currentUser will be handled in main.js, so openPreview needs to be passed it or access a global state.
// For now, I'll assume `openPreview` will be imported and `currentUser` will be accessible.
// If `openPreview` is in newsDetail.js, then this function will need to import it.

// This function needs to fetch news data, which should ideally be handled by a news service module.
// For now, I will keep it in utils, but it implies a dependency on news data.
export function openPreviewById(id, openPreviewFunc) {
    fetch('/api/haberler')
        .then(res => res.json())
        .then(data => {
            const news = data.data.find(n => n.id == id);
            if (news) openPreviewFunc(news); // Use the passed openPreview function
            else alert('Haber bulunamadı.');
        })
        .catch(err => console.error('Error opening news from marquee:', err));
}
