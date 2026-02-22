const fs = require('fs');
const path = require('path');

function formatDateISO(d) {
    const dt = typeof d === 'string' ? new Date(d) : d;
    return new Date(dt || Date.now()).toISOString();
}

function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

function readNews() {
    const filePath = path.join(__dirname, 'data', 'haberler.json');
    if (!fs.existsSync(filePath)) return [];
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (_) {
        return [];
    }
}

function writeFilePublic(filename, content) {
    const outPath = path.join(__dirname, 'public', filename);
    fs.writeFileSync(outPath, content, 'utf8');
    return outPath;
}

// XML özel karakterlerini escape eden fonksiyon
function escapeXml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function buildUrlSetXml(urls) {
    const xmlns = 'http://www.sitemaps.org/schemas/sitemap/0.9';
    const head = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${xmlns}">`;
    const tail = `</urlset>`;
    const body = urls.map(u => {
        const lastmod = u.lastmod || formatDateISO();
        const priority = u.priority != null ? u.priority : 0.5;
        return `<url><loc>${escapeXml(u.loc)}</loc><lastmod>${lastmod}</lastmod><priority>${priority}</priority></url>`;
    }).join('');
    return `${head}${body}${tail}`;
}

function buildSitemapIndexXml(files, baseUrl) {
    const xmlns = 'http://www.sitemaps.org/schemas/sitemap/0.9';
    const head = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="${xmlns}">`;
    const tail = `</sitemapindex>`;
    const body = files.map(f => {
        const loc = `${baseUrl}/${f}`;
        const lastmod = formatDateISO();
        return `<sitemap><loc>${escapeXml(loc)}</loc><lastmod>${lastmod}</lastmod></sitemap>`;
    }).join('');
    return `${head}${body}${tail}`;
}

function generateSitemap() {
    const baseUrl = process.env.SITE_BASE_URL || 'https://savsata.com.tr';
    const limit = 50000;
    const news = readNews();
    const slugify = (s) => {
        const map = { 'ş':'s','Ş':'s','ç':'c','Ç':'c','ö':'o','Ö':'o','ğ':'g','Ğ':'g','ü':'u','Ü':'u','ı':'i','İ':'i' };
        return String(s || '')
            .split('')
            .map(ch => map[ch] || ch)
            .join('')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    };
    const urls = (news || []).map(n => {
        const id = typeof n.id === 'number' ? n.id : parseInt(String(n.id || '').match(/^\d+/)?.[0] || '0');
        const name = slugify(n.kisa_baslik || n.baslik || '');
        const loc = `${baseUrl}/?haber=${id}${name ? `&name=${encodeURIComponent(name)}` : ''}`;
        return { loc, lastmod: n.tarih || formatDateISO(), priority: 0.6 };
    });

    const chunks = chunkArray(urls, limit);
    const partFiles = [];
    for (let i = 0; i < chunks.length; i++) {
        const idx = i + 1;
        const filename = `site_map${idx}.xml`;
        const xml = buildUrlSetXml(chunks[i]);
        writeFilePublic(filename, xml);
        partFiles.push(filename);
    }
    if (partFiles.length === 0) {
        const filename = 'site_map1.xml';
        const xml = buildUrlSetXml([]);
        writeFilePublic(filename, xml);
        partFiles.push(filename);
    }
    const indexXml = buildSitemapIndexXml(partFiles, baseUrl);
    writeFilePublic('site_map.xml', indexXml);
    return { parts: partFiles.length };
}

module.exports = { generateSitemap };