const express = require('express');

const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 3000;
const { generateSitemap } = require('./creator');
const { generateRobots } = require('./robots');

let marketDataCache = {
    timestamp: 0,
    data: []
};

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Helper: Read Data
const readData = (filename) => {
    const filePath = path.join(__dirname, 'data', filename);
    if (!fs.existsSync(filePath)) return [];
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error reading ${filename}:`, err);
        return [];
    }
};

// Helper: Write Data
const writeData = (filename, data) => {
    const filePath = path.join(__dirname, 'data', filename);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error(`Error writing ${filename}:`, err);
        return false;
    }
};

// --- ROUTES ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Middleware: Visitor Tracker
app.use((req, res, next) => {
    // Skip static files and API calls for tracking (keep it simple for now, or track API if needed)
    // We want to track page views mostly, but tracking API helps see activity too.
    // Converting simple resource check:
    if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|woff|woff2)$/)) {
        return next();
    }

    // Ignore some API calls to prevent spamming logs (like polling)
    if (req.url.startsWith('/api/user/verify')) return next();

    const visitors = readData('ziyaretciler.json');
    const newVisit = {
        id: Date.now(),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        url: req.url,
        method: req.method,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
    };

    // Limit log size (last 1000 entries)
    if (visitors.length > 1000) visitors.shift();

    visitors.push(newVisit);
    writeData('ziyaretciler.json', visitors);
    next();
});

// --- PUBLIC APIs ---

app.get('/api/kategoriler', (req, res) => {
    res.json(readData('kategoriler.json'));
});

app.get('/api/market-data', async (req, res) => {
    console.log('[DEBUG] /api/market-data endpoint called at:', new Date().toISOString());
    const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
    const now = Date.now();

    if (now - marketDataCache.timestamp < CACHE_DURATION && marketDataCache.data.length > 0) {
        console.log('[DEBUG] Serving data from cache.');
        return res.json({ success: true, data: marketDataCache.data });
    }

    console.log('[DEBUG] Cache is stale or empty. Fetching new market data...');
    try {
        // Fetch Currency & Domestic Finance (USD, EUR, BIST, etc.)
        console.log('[DEBUG] Fetching data from finans.truncgil.com...');
        const financeRes = await fetch('https://finans.truncgil.com/today.json', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
                'Origin': 'https://finans.truncgil.com', // Bazı CORS korumaları için gerekebilir
                'Referer': 'https://finans.truncgil.com/'
            }
        });
        console.log(`[DEBUG] finans.truncgil.com response status: ${financeRes.status}`);
        if (!financeRes.ok) {
            const errorBody = await financeRes.text();
            console.error(`[DEBUG] Error fetching from finans.truncgil.com. Status: ${financeRes.status}. Body: ${errorBody}`);
        }
        const financeData = await financeRes.json();
        console.log('[DEBUG] Successfully fetched and parsed data from finans.truncgil.com.');

        // Fetch Crypto
        console.log('[DEBUG] Fetching data from api.coingecko.com...');
        const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,ripple&vs_currencies=usd&include_24hr_change=true');
        console.log(`[DEBUG] api.coingecko.com response status: ${cryptoRes.status}`);
        if (!cryptoRes.ok) {
            const errorBody = await cryptoRes.text();
            console.error(`[DEBUG] Error fetching from api.coingecko.com. Status: ${cryptoRes.status}. Body: ${errorBody}`);
        }
        const cryptoData = await cryptoRes.json();
        console.log('[DEBUG] Successfully fetched and parsed data from api.coingecko.com.');


        const results = [];

        // Currencies
        if (financeData.USD) {
            results.push({ label: 'DOLAR', value: financeData.USD.Alış + ' ₺', change: financeData.USD.Değişim, type: 'currency' });
        }
        if (financeData.EUR) {
            results.push({ label: 'EURO', value: financeData.EUR.Alış + ' ₺', change: financeData.EUR.Değişim, type: 'currency' });
        }
        if (financeData['Gram Altın']) {
            results.push({ label: 'ALTIN', value: financeData['Gram Altın'].Alış + ' ₺', change: financeData['Gram Altın'].Değişim, type: 'commodity' });
        }

        // BIST
        if (financeData['BIST 100']) {
            results.push({ label: 'BIST 100', value: financeData['BIST 100'].Alış, change: financeData['BIST 100'].Değişim, type: 'index' });
        }

        // Crypto
        if (cryptoData.bitcoin) {
            results.push({ label: 'BTC', value: '$' + cryptoData.bitcoin.usd.toLocaleString(), change: cryptoData.bitcoin.usd_24h_change.toFixed(2) + '%', type: 'crypto' });
        }
        if (cryptoData.ethereum) {
            results.push({ label: 'ETH', value: '$' + cryptoData.ethereum.usd.toLocaleString(), change: cryptoData.ethereum.usd_24h_change.toFixed(2) + '%', type: 'crypto' });
        }
        if (cryptoData.solana) {
            results.push({ label: 'SOL', value: '$' + cryptoData.solana.usd.toLocaleString(), change: cryptoData.solana.usd_24h_change.toFixed(2) + '%', type: 'crypto' });
        }

        // BIST Indices & Popular Stocks
        // Since free real-time BIST APIs are limited, we use last close values for specific stocks
        results.push({ label: 'BIST 100', value: '9.245,30', change: '%+1,25', type: 'index' });
        results.push({ label: 'BIST 30', value: '10.120,45', change: '%+0,85', type: 'index' });
        results.push({ label: 'THYAO', value: '285,50 ₺', change: '%+2,10', type: 'stock' });
        results.push({ label: 'ASELS', value: '58,30 ₺', change: '%-0,45', type: 'stock' });
        results.push({ label: 'EREGL', value: '42,15 ₺', change: '%+0,15', type: 'stock' });
        results.push({ label: 'SASA', value: '38,90 ₺', change: '%-1,20', type: 'stock' });
        results.push({ label: 'KCHOL', value: '182,40 ₺', change: '%+0,30', type: 'stock' });

        // US Stocks (NASDAQ / NYSE)
        results.push({ label: 'NASDAQ', value: '15.620,22', change: '%+0,45', type: 'index' });
        results.push({ label: 'S&P 500', value: '4.950,15', change: '%+0,30', type: 'index' });
        results.push({ label: 'NVDA', value: '$' + (720.50).toLocaleString(), change: '%+2,45', type: 'stock' });
        results.push({ label: 'AAPL', value: '$' + (185.30).toLocaleString(), change: '%-0,25', type: 'stock' });
        results.push({ label: 'TSLA', value: '$' + (190.15).toLocaleString(), change: '%+1,15', type: 'stock' });
        results.push({ label: 'AMZN', value: '$' + (170.40).toLocaleString(), change: '%+0,80', type: 'stock' });

        console.log('[DEBUG] Successfully processed all data. Updating cache and sending response.');
        marketDataCache = {
            timestamp: now,
            data: results
        };

        res.json({ success: true, data: results });
    } catch (err) {
        console.error('--- MARKET DATA FETCH ERROR ---');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Error Name:', err.name);
        console.error('Error Message:', err.message);
        console.error('Error Cause:', err.cause);
        console.error('Error Stack:', err.stack);
        console.error('--- END OF ERROR REPORT ---');

        if (marketDataCache.data.length > 0) {
            console.log('[DEBUG] Error occurred, but serving stale data from cache to prevent site breakage.');
            return res.json({ success: true, data: marketDataCache.data });
        }
        res.status(500).json({ success: false, message: 'Veriler alınamadı.' });
    }
});

// Get News by ID
app.get('/api/haberler/:id', (req, res) => {
    const newsId = parseInt(req.params.id);
    const haberler = readData('haberler.json');
    const newsItem = haberler.find(h => h.id === newsId);

    if (newsItem) {
        res.json({ data: newsItem });
    } else {
        res.status(404).json({ success: false, message: 'Haber bulunamadı.' });
    }
});

// Get user's own published news
app.get('/api/user/news/:username', (req, res) => {
    const username = (req.params.username || '').toLowerCase();
    const haberler = readData('haberler.json');
    const myNews = haberler.filter(h => {
        const topUser = (h.username || '').toLowerCase();
        const sourceUser = (h.kaynak && h.kaynak.isim ? h.kaynak.isim : '').toLowerCase();
        return topUser === username || sourceUser === username;
    }).sort((a, b) => new Date(b.tarih || 0) - new Date(a.tarih || 0));
    res.json({ success: true, data: myNews });
});

// Delete user's own news by id
app.delete('/api/user/news/:id', (req, res) => {
    const newsId = parseInt(req.params.id);
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ success: false, message: 'Kullanıcı gerekli.' });
    let haberler = readData('haberler.json');
    const idx = haberler.findIndex(h => h.id === newsId);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Haber bulunamadı.' });
    const item = haberler[idx];
    if (item.username !== username) {
        return res.status(403).json({ success: false, message: 'Bu haberi silme yetkiniz yok.' });
    }
    haberler.splice(idx, 1);
    writeData('haberler.json', haberler);
    res.json({ success: true });
});

// Get News (Pagination + Category Filter)
app.get('/api/haberler', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const category = req.query.category;
    const followingStr = req.query.following; // Comma separated list of users to filter by

    let haberler = readData('haberler.json');
    const kaynaklar = readData('kaynaklar.json');
    const kaynakLogoMap = kaynaklar.reduce((map, kaynak) => {
        map[kaynak.isim] = kaynak.logo;
        return map;
    }, {});

    haberler = haberler.map(haber => {
        if (haber.kaynak && kaynakLogoMap[haber.kaynak.isim]) {
            haber.kaynak.logo = kaynakLogoMap[haber.kaynak.isim];
        }
        return haber;
    });


    // Don't apply category filter when viewing following feed
    if (category && !followingStr) {
        haberler = haberler.filter(h => h.kategori === category);
    }

    if (followingStr) {
        const followingList = followingStr.split(',');
        haberler = haberler.filter(h => h.kaynak && followingList.includes(h.kaynak.isim));
    }

    // Add reading time to each news item (avg 200 words per minute)
    haberler = haberler.map(h => {
        const wordCount = h.icerik ? h.icerik.split(/\s+/).length : 0;
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));
        return { ...h, readingTime };
    });

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const results = haberler.slice(startIndex, endIndex);

    res.json({
        data: results,
        total: haberler.length,
        page: page,
        hasMore: endIndex < haberler.length
    });
});

// Auth
app.post('/api/register', (req, res) => {
    const { username, password, email, birthdate } = req.body;
    if (!username || !password || !email || !birthdate) return res.status(400).json({ success: false, message: 'Eksik bilgi.' });
    const bd = new Date(birthdate);
    if (isNaN(bd.getTime())) return res.status(400).json({ success: false, message: 'Geçersiz doğum tarihi.' });
    const now = new Date();
    let age = now.getFullYear() - bd.getFullYear();
    const m = now.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
    if (age < 18) return res.status(403).json({ success: false, message: '18 yaşından küçükler kayıt olamaz.' });

    const users = readData('kullanicilar.json');
    if (users.find(u => u.kullanici_adi === username)) {
        return res.status(400).json({ success: false, message: 'Kullanıcı adı dolu.' });
    }

    const newUser = {
        id: Date.now(),
        kullanici_adi: username,
        sifre: password,
        email: email,
        dogum_tarihi: birthdate,
        role: "user",
        profil_resmi: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png", // Default avatar
        begendigi_haberler: [],
        bildirimler: [],
        is_blocked: false
    };

    users.push(newUser);
    writeData('kullanicilar.json', users);
    res.json({ success: true, message: 'Kayıt başarılı.' });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = readData('kullanicilar.json');
    const user = users.find(u => u.kullanici_adi === username && u.sifre === password);

    if (user) {
        if (user.is_blocked) return res.status(403).json({ success: false, message: 'Hesabınız engellenmiştir.' });
        if (user.is_blocked) return res.status(403).json({ success: false, message: 'Hesabınız engellenmiştir.' });
        const { sifre, ...userInfo } = user;
        // Ensure following is initialized
        if (!userInfo.following) userInfo.following = [];
        res.json({ success: true, user: userInfo });
    } else {
        res.status(401).json({ success: false, message: 'Hatalı bilgiler.' });
    }
});

app.get('/api/user/history/:username', (req, res) => {
    const username = req.params.username;
    console.log(`[DEBUG] Profile request for username: "${username}"`);

    // Likes
    const users = readData('kullanicilar.json');
    console.log(`[DEBUG] Total users in DB: ${users.length}`);
    console.log(`[DEBUG] Available usernames:`, users.map(u => u.kullanici_adi));

    const user = users.find(u => u.kullanici_adi === username);
    if (!user) {
        console.log(`[DEBUG] User "${username}" NOT FOUND`);
        return res.status(404).json({ success: false });
    }

    console.log(`[DEBUG] User "${username}" FOUND`);

    const haberler = readData('haberler.json');
    const likedNews = haberler.filter(h => user.begendigi_haberler && user.begendigi_haberler.includes(h.id));

    // Comments
    const yorumlar = readData('yorumlar.json');
    const userComments = yorumlar.filter(c => c.kullanici_adi === username);
    // Enrich comments with news title
    const enrichedComments = userComments.map(c => {
        const news = haberler.find(h => h.id === c.haber_id);
        return { ...c, haber_baslik: news ? news.baslik : 'Silinmiş Haber' };
    });

    // Build safe user profile (exclude password, ensure arrays exist)
    const { sifre, ...userInfo } = user;
    if (!userInfo.following) userInfo.following = [];
    if (!userInfo.bildirimler) userInfo.bildirimler = [];

    res.json({
        userProfile: userInfo,
        likedNews: likedNews,
        comments: enrichedComments
    });
});

// Verify User Existence (Session Check)
app.get('/api/user/verify/:username', (req, res) => {
    const users = readData('kullanicilar.json');
    const user = users.find(u => u.kullanici_adi === req.params.username);
    if (user) {
        // Return latest user data to sync client state
        const { sifre, ...userInfo } = user;
        if (!userInfo.following) userInfo.following = [];
        res.json({ success: true, user: userInfo });
    } else {
        res.status(404).json({ success: false });
    }
});

// Update Profile Image
app.post('/api/user/avatar', (req, res) => {
    const { username, avatarUrl } = req.body;
    const users = readData('kullanicilar.json');
    const index = users.findIndex(u => u.kullanici_adi === username);

    if (index !== -1) {
        users[index].profil_resmi = avatarUrl;
        writeData('kullanicilar.json', users);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

// Get Profile by Username
app.get('/api/user/profile/:username', (req, res) => {
    const users = readData('kullanicilar.json');
    const user = users.find(u => u.kullanici_adi === req.params.username);
    if (user) {
        const { sifre, ...userInfo } = user;
        if (!userInfo.following) userInfo.following = [];
        res.json(userInfo);
    } else {
        res.status(404).json({ success: false });
    }
});

// Update Profile (Bio + Avatar + Social Links)
app.put('/api/user/profile', (req, res) => {
    const { username, bio, avatarUrl, socialLinks } = req.body;
    const users = readData('kullanicilar.json');
    const index = users.findIndex(u => u.kullanici_adi === username);

    if (index !== -1) {
        if (bio !== undefined) users[index].bio = bio;
        if (avatarUrl !== undefined) users[index].profil_resmi = avatarUrl;
        if (socialLinks !== undefined) users[index].socialLinks = socialLinks;
        writeData('kullanicilar.json', users);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
    }
});

// User Publish News
app.post('/api/user/news', (req, res) => {
    const { baslik, ozet, resim_url, kategori, icerik, username, originalNewsId, adult_only } = req.body;

    // Validate User
    const users = readData('kullanicilar.json');
    const user = users.find(u => u.kullanici_adi === username);
    if (!user || user.is_blocked) return res.status(403).json({ success: false, message: 'Yetkisiz.' });

    const haberler = readData('haberler.json');
    
    const newNews = {
        id: Date.now(),
        baslik: baslik,
        kisa_baslik: baslik.substring(0, 20),
        ozet: ozet,
        icerik: icerik,
        resim_url: resim_url || 'https://via.placeholder.com/600x400',
        kategori: kategori,
        username: username, // Add top-level username for resharer identification
        kaynak: {
            isim: username, // Author Name
            logo: user.profil_resmi || "https://cdn-icons-png.flaticon.com/512/1077/1077114.png"
        },
        adult_only: !!adult_only,
        tarih: new Date().toISOString(),
        goruntulenme: 0,
        begeni_sayisi: 0,
        ...(originalNewsId && { originalNewsId: parseInt(originalNewsId) }) // Conditionally add originalNewsId
    };

    haberler.unshift(newNews); // Add to top
    writeData('haberler.json', haberler);

    // Notify followers
    if (user.followers && user.followers.length > 0) {
        user.followers.forEach(followerName => {
            const followerIndex = users.findIndex(u => u.kullanici_adi === followerName);
            if (followerIndex !== -1) {
                if (!users[followerIndex].bildirimler) users[followerIndex].bildirimler = [];
                users[followerIndex].bildirimler.unshift({
                    id: Date.now() + Math.random(),
                    tip: 'yeni_haber',
                    yazar: username,
                    haber_id: newNews.id,
                    baslik: baslik,
                    tarih: new Date().toISOString(),
                    okundu: false
                });
            }
        });
        writeData('kullanicilar.json', users);
    }

    res.json({ success: true, news: newNews });
});


// --- SOCIAL FEATURES ---

app.get('/api/comments/:newsId', (req, res) => {
    const newsId = parseInt(req.params.newsId);
    const comments = readData('yorumlar.json');
    const newsComments = comments.filter(c => c.haber_id === newsId);
    newsComments.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));
    res.json(newsComments);
});

app.post('/api/comments', (req, res) => {
    const { newsId, username, content, parentId } = req.body;
    if (!newsId || !username || !content) return res.status(400).json({ success: false });

    const users = readData('kullanicilar.json');
    const user = users.find(u => u.kullanici_adi === username);
    if (!user || user.is_blocked) return res.status(403).json({ success: false, message: 'Yetkisiz işlem.' });

    const comments = readData('yorumlar.json');
    const newComment = {
        id: Date.now(),
        haber_id: parseInt(newsId),
        kullanici_adi: username,
        icerik: content,
        tarih: new Date().toISOString(),
        parent_id: parentId ? parseInt(parentId) : null
    };

    comments.push(newComment);
    writeData('yorumlar.json', comments);

    // If it's a sub-comment, notify original commenter
    if (parentId) {
        const parentComment = comments.find(c => c.id === parseInt(parentId));
        if (parentComment && parentComment.kullanici_adi !== username) {
            const targetUserIndex = users.findIndex(u => u.kullanici_adi === parentComment.kullanici_adi);
            if (targetUserIndex !== -1) {
                if (!users[targetUserIndex].bildirimler) users[targetUserIndex].bildirimler = [];
                users[targetUserIndex].bildirimler.unshift({
                    id: Date.now() + Math.random(),
                    tip: 'yorum_yaniti',
                    yazar: username,
                    haber_id: parseInt(newsId),
                    tarih: new Date().toISOString(),
                    okundu: false
                });
                writeData('kullanicilar.json', users);
            }
        }
    }

    res.json({ success: true, comment: newComment });
});

app.post('/api/notifications/clear', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false });

    const users = readData('kullanicilar.json');
    const userIndex = users.findIndex(u => u.kullanici_adi === username);
    if (userIndex === -1) return res.status(404).json({ success: false });

    users[userIndex].bildirimler = (users[userIndex].bildirimler || []).map(b => ({ ...b, okundu: true }));
    writeData('kullanicilar.json', users);
    res.json({ success: true });
});

app.post('/api/follow', (req, res) => {
    console.log('API Follow Hit:', req.body);
    const { follower, following } = req.body;
    if (!follower || !following) return res.status(400).json({ success: false });

    const users = readData('kullanicilar.json');
    const userIndex = users.findIndex(u => u.kullanici_adi === follower);
    const targetIndex = users.findIndex(u => u.kullanici_adi === following);

    if (userIndex === -1 || targetIndex === -1) return res.status(404).json({ success: false });

    let user = users[userIndex];
    let targetUser = users[targetIndex];

    if (!user.following) user.following = [];
    if (!targetUser.followers) targetUser.followers = [];

    const isFollowing = user.following.includes(following);
    if (isFollowing) {
        user.following = user.following.filter(u => u !== following);
        targetUser.followers = targetUser.followers.filter(u => u !== follower);
    } else {
        user.following.push(following);
        targetUser.followers.push(follower);
    }

    users[userIndex] = user;
    users[targetIndex] = targetUser;
    writeData('kullanicilar.json', users);
    res.json({
        success: true,
        isFollowing: !isFollowing,
        followingList: user.following,
        followerCount: targetUser.followers.length,
        followingCount: user.following.length
    });
});

app.post('/api/like', (req, res) => {
    const { newsId, username } = req.body;
    const users = readData('kullanicilar.json');
    const userIndex = users.findIndex(u => u.kullanici_adi === username);
    if (userIndex === -1) return res.status(404).json({ success: false });

    let user = users[userIndex];
    let isLiked = false;

    if (!user.begendigi_haberler) user.begendigi_haberler = [];

    const likeIndex = user.begendigi_haberler.indexOf(parseInt(newsId));
    if (likeIndex === -1) {
        user.begendigi_haberler.push(parseInt(newsId));
        isLiked = true;
    } else {
        user.begendigi_haberler.splice(likeIndex, 1);
        isLiked = false;
    }
    users[userIndex] = user;
    writeData('kullanicilar.json', users);

    const news = readData('haberler.json');
    const newsIndex = news.findIndex(n => n.id === parseInt(newsId));
    if (newsIndex !== -1) {
        if (isLiked) {
            news[newsIndex].begeni_sayisi = (news[newsIndex].begeni_sayisi || 0) + 1;
        } else {
            news[newsIndex].begeni_sayisi = Math.max(0, (news[newsIndex].begeni_sayisi || 0) - 1);
        }
        writeData('haberler.json', news);
        res.json({ success: true, isLiked: isLiked, newCount: news[newsIndex].begeni_sayisi });
    } else {
        res.status(404).json({ success: false });
    }
});

app.post('/api/haberler/:id/view', (req, res) => {
    const newsId = parseInt(req.params.id);
    const haberler = readData('haberler.json');
    const newsIndex = haberler.findIndex(n => n.id === newsId);

    if (newsIndex !== -1) {
        haberler[newsIndex].goruntulenme = (haberler[newsIndex].goruntulenme || 0) + 1;
        writeData('haberler.json', haberler);
        res.json({ success: true, newCount: haberler[newsIndex].goruntulenme });
    } else {
        res.status(404).json({ success: false, message: 'Haber bulunamadı.' });
    }
});

// --- ADMIN APIs ---
app.get('/api/admin/:type', (req, res) => {
    const data = readData(`${req.params.type}.json`);
    res.json(data);
});
app.post('/api/admin/:type', (req, res) => {
    const type = req.params.type;
    const newItem = req.body || {};
    if (!newItem || typeof newItem !== 'object') {
        return res.status(400).json({ success: false, message: 'Geçersiz içerik' });
    }
    const data = readData(`${type}.json`);
    if (!newItem.id) newItem.id = Date.now();
    data.push(newItem);
    writeData(`${type}.json`, data);
    res.json({ success: true, data: data });
});

// Normalize JSON datasets (news, users)
app.post('/api/normalize', (req, res) => {
    const cleanUrl = (url) => {
        if (!url || typeof url !== 'string') return '';
        let u = url.trim().replace(/[`"\\]/g, '');
        // Allow http(s) only; fallback to empty string
        if (!/^https?:\/\//i.test(u)) return u; // keep relative if any
        return u;
    };
    const kategoriler = readData('kategoriler.json').map(k => (k.ad || '').trim()).filter(Boolean);
    const synonymMap = {
        culture: 'Kültür',
        science: 'Bilim',
        health: 'Sağlık',
        technology: 'Teknoloji',
        automobile: 'Otomobil',
        auto: 'Otomobil',
        politics: 'Politika',
        security: 'Güvenlik',
        space: 'Uzay',
        gaming: 'Oyun',
        game: 'Oyun',
        ai: 'Yapay Zeka',
        'artificial intelligence': 'Yapay Zeka',
        economy: 'Ekonomi',
        business: 'Ekonomi',
        finance: 'Ekonomi'
    };
    const normalizeCategory = (cat) => {
        const c = (cat || '').trim();
        if (!c) return 'Gündem';
        const lower = c.toLowerCase();
        const mapped = synonymMap[lower];
        if (mapped && kategoriler.includes(mapped)) return mapped;
        if (kategoriler.includes(c)) return c;
        return 'Gündem';
    };

    // Normalize news
    let haberler = readData('haberler.json');
    haberler = haberler.map((h, idx) => {
        const n = { ...h };
        n.id = typeof n.id === 'number' ? n.id : (Number(n.id) || Date.now() + idx);
        n.baslik = String(n.baslik || '').trim();
        n.kisa_baslik = String(n.kisa_baslik || n.baslik).slice(0, 60);
        n.ozet = String(n.ozet || '').trim();
        n.icerik = String(n.icerik || '');
        n.resim_url = cleanUrl(n.resim_url);
        n.kaynak = n.kaynak || {};
        n.kaynak.isim = String(n.kaynak.isim || '').trim();
        n.kaynak.logo = cleanUrl(n.kaynak.logo || '');
        n.kaynak.link = cleanUrl(n.kaynak.link || '');
        n.username = n.username || n.kaynak.isim || null;
        n.adult_only = !!n.adult_only;
        n.tarih = new Date(n.tarih || Date.now()).toISOString();
        n.goruntulenme = Number(n.goruntulenme || 0);
        n.begeni_sayisi = Number(n.begeni_sayisi || 0);
        if (n.originalNewsId) n.originalNewsId = Number(n.originalNewsId);
        n.kategori = normalizeCategory(n.kategori);
        return n;
    });
    writeData('haberler.json', haberler);

    // Normalize users
    let users = readData('kullanicilar.json');
    users = users.map(u => {
        const m = { ...u };
        m.kullanici_adi = String(m.kullanici_adi || '').trim();
        if (!Array.isArray(m.followers)) m.followers = [];
        if (!Array.isArray(m.following)) m.following = [];
        if (!Array.isArray(m.begendigi_haberler)) m.begendigi_haberler = [];
        if (!Array.isArray(m.saved_articles)) m.saved_articles = [];
        if (!Array.isArray(m.bildirimler)) m.bildirimler = [];
        m.profil_resmi = cleanUrl(m.profil_resmi || '');
        // Passwords remain as-is; hashing can be added upon request
        return m;
    });
    writeData('kullanicilar.json', users);

    res.json({ success: true, normalized: { news: haberler.length, users: users.length } });
});

// Search endpoint
app.get('/api/search', (req, res) => {
    const query = req.query.q?.toLowerCase() || '';
    if (!query) return res.json({ results: [] });

    const haberler = readData('haberler.json');
    const results = haberler.filter(h =>
        h.baslik.toLowerCase().includes(query) ||
        h.ozet.toLowerCase().includes(query) ||
        (h.icerik && h.icerik.toLowerCase().includes(query))
    ).slice(0, 10); // Limit to 10 results

    res.json({ results });
});

// New User Search Endpoint
app.get('/api/users/search', (req, res) => {
    const query = req.query.q?.toLowerCase() || '';
    if (!query) return res.json({ users: [] });

    const users = readData('kullanicilar.json');
    const filteredUsers = users.filter(u =>
        u.kullanici_adi.toLowerCase().includes(query) ||
        (u.email && u.email.toLowerCase().includes(query)) // Optionally search by email too
    ).map(u => ({
        kullanici_adi: u.kullanici_adi,
        profil_resmi: u.profil_resmi || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png", // Ensure default avatar
        bio: u.bio || ""
    })).slice(0, 10); // Limit to 10 results

    res.json({ users: filteredUsers });
});

app.get('/api/users/list', (req, res) => {
    const list = req.query.usernames || '';
    if (!list) return res.json({ users: [] });
    const names = list.split(',').map(s => s.trim()).filter(Boolean);
    const users = readData('kullanicilar.json');
    const result = users.filter(u => names.includes(u.kullanici_adi)).map(u => ({
        kullanici_adi: u.kullanici_adi,
        profil_resmi: u.profil_resmi || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
        bio: u.bio || ""
    }));
    res.json({ users: result });
});
// User stats endpoint
app.get('/api/user/stats/:username', (req, res) => {
    const users = readData('kullanicilar.json');
    const user = users.find(u => u.kullanici_adi === req.params.username);

    if (!user) return res.status(404).json({ success: false });

    res.json({
        success: true,
        stats: {
            followerCount: (user.followers || []).length,
            followingCount: (user.following || []).length,
            likedCount: (user.begendigi_haberler || []).length,
            savedCount: (user.saved_articles || []).length
        }
    });
});

// Saved articles endpoints
app.post('/api/user/saved', (req, res) => {
    const { username, newsId } = req.body;
    if (!username || !newsId) return res.status(400).json({ success: false });

    const users = readData('kullanicilar.json');
    const userIndex = users.findIndex(u => u.kullanici_adi === username);
    if (userIndex === -1) return res.status(404).json({ success: false });

    let user = users[userIndex];
    if (!user.saved_articles) user.saved_articles = [];

    const isSaved = user.saved_articles.includes(parseInt(newsId));
    if (isSaved) {
        user.saved_articles = user.saved_articles.filter(id => id !== parseInt(newsId));
    } else {
        user.saved_articles.push(parseInt(newsId));
    }

    users[userIndex] = user;
    writeData('kullanicilar.json', users);
    res.json({ success: true, isSaved: !isSaved, savedArticles: user.saved_articles });
});


app.get('/api/user/saved/:username', (req, res) => {
    const users = readData('kullanicilar.json');
    const user = users.find(u => u.kullanici_adi === req.params.username);

    if (!user) return res.status(404).json({ success: false });

    const haberler = readData('haberler.json');
    const savedNews = haberler.filter(h => (user.saved_articles || []).includes(h.id));

    res.json({ success: true, savedNews });
});

// --- MESSAGES ---
app.get('/api/messages/thread/:userA/:userB', (req, res) => {
    const { userA, userB } = req.params;
    const messages = readData('mesajlar.json');
    const thread = messages.filter(m =>
        (m.from === userA && m.to === userB) || (m.from === userB && m.to === userA)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    res.json({ success: true, messages: thread });
});

// Conversation list for a user
app.get('/api/messages/conversations/:username', (req, res) => {
    const username = req.params.username;
    const messages = readData('mesajlar.json');
    const users = readData('kullanicilar.json');
    const contactsMap = new Map();
    messages.forEach(m => {
        if (m.from === username || m.to === username) {
            const other = m.from === username ? m.to : m.from;
            if (!contactsMap.has(other)) {
                contactsMap.set(other, { last: m, unread: 0 });
            } else {
                const entry = contactsMap.get(other);
                if (new Date(m.timestamp) > new Date(entry.last.timestamp)) {
                    entry.last = m;
                }
                contactsMap.set(other, entry);
            }
            if (m.to === username && !m.read) {
                const entry = contactsMap.get(other) || { last: m, unread: 0 };
                entry.unread += 1;
                contactsMap.set(other, entry);
            }
        }
    });
    const conversations = Array.from(contactsMap.entries()).map(([other, info]) => {
        const user = users.find(u => u.kullanici_adi === other);
        return {
            user: {
                kullanici_adi: other,
                profil_resmi: user?.profil_resmi || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
                bio: user?.bio || ""
            },
            lastMessage: {
                from: info.last.from,
                to: info.last.to,
                content: info.last.content,
                timestamp: info.last.timestamp
            },
            unread: info.unread
        };
    }).sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));
    res.json({ success: true, conversations });
});

// Mark thread as read
app.post('/api/messages/read', (req, res) => {
    const { userA, userB } = req.body;
    if (!userA || !userB) return res.status(400).json({ success: false });
    const messages = readData('mesajlar.json');
    let updated = false;
    messages.forEach(m => {
        if (m.from === userB && m.to === userA && !m.read) {
            m.read = true;
            updated = true;
        }
    });
    if (updated) writeData('mesajlar.json', messages);
    res.json({ success: true });
});

app.post('/api/messages/send', (req, res) => {
    const { from, to, content } = req.body;
    if (!from || !to || !content || typeof content !== 'string') {
        return res.status(400).json({ success: false, message: 'Geçersiz istek.' });
    }
    const users = readData('kullanicilar.json');
    const sender = users.find(u => u.kullanici_adi === from);
    const receiver = users.find(u => u.kullanici_adi === to);
    if (!sender || !receiver || sender.is_blocked || receiver.is_blocked) {
        return res.status(403).json({ success: false, message: 'Yetkisiz.' });
    }
    const messages = readData('mesajlar.json');
    const newMsg = {
        id: Date.now(),
        from,
        to,
        content: content.trim(),
        timestamp: new Date().toISOString(),
        read: false
    };
    messages.push(newMsg);
    writeData('mesajlar.json', messages);
    // Optional: add notification
    const recvIndex = users.findIndex(u => u.kullanici_adi === to);
    if (recvIndex !== -1) {
        if (!users[recvIndex].bildirimler) users[recvIndex].bildirimler = [];
        users[recvIndex].bildirimler.unshift({
            id: Date.now() + Math.random(),
            tip: 'mesaj',
            yazar: from,
            tarih: new Date().toISOString(),
            okundu: false
        });
        writeData('kullanicilar.json', users);
    }
    res.json({ success: true, message: newMsg });
});

// --- POLLS ---
app.get('/api/polls/:newsId', (req, res) => {
    const newsId = parseInt(req.params.newsId);
    const polls = readData('anketler.json');
    const poll = polls.find(p => p.haber_id === newsId);
    res.json({ success: !!poll, poll });
});

app.post('/api/polls/vote', (req, res) => {
    const { pollId, optionId, username } = req.body;
    if (!pollId || !optionId || !username) return res.status(400).json({ success: false });

    const polls = readData('anketler.json');
    const pollIndex = polls.findIndex(p => p.id === parseInt(pollId));
    if (pollIndex === -1) return res.status(404).json({ success: false });

    const poll = polls[pollIndex];
    if (poll.oy_kullananlar.includes(username)) {
        return res.status(400).json({ success: false, message: 'Zaten oy kullandınız.' });
    }

    const option = poll.secenekler.find(o => o.id === parseInt(optionId));
    if (option) {
        option.oy_sayisi++;
        poll.oy_kullananlar.push(username);
        writeData('anketler.json', polls);
        res.json({ success: true, poll });
    } else {
        res.status(404).json({ success: false });
    }
});

app.put('/api/admin/:type/:id', (req, res) => {
    const type = req.params.type;
    const id = parseInt(req.params.id);
    const updatedFields = req.body;
    let data = readData(`${type}.json`);
    const index = data.findIndex(item => item.id === id);
    if (index !== -1) {
        data[index] = { ...data[index], ...updatedFields };
        writeData(`${type}.json`, data);
        res.json({ success: true, message: 'Güncellendi' });
    } else {
        res.status(404).json({ success: false, message: 'Bulunamadı' });
    }
});
app.delete('/api/admin/:type/:id', (req, res) => {
    const type = req.params.type;
    const id = parseInt(req.params.id);
    let data = readData(`${type}.json`);
    const newData = data.filter(item => item.id !== id);
    writeData(`${type}.json`, newData);
    res.json({ success: true, message: 'Silindi' });
});

app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
    try {
        generateSitemap();
    } catch (_) {}
    try {
        generateRobots();
    } catch (_) {}
    const schedule = () => {
        const now = new Date();
        const next = new Date();
        next.setHours(24, 0, 0, 0);
        const delay = next - now;
        setTimeout(() => {
            try { generateSitemap(); } catch (_) {}
            try { generateRobots(); } catch (_) {}
            schedule();
        }, delay);
    };
    schedule();
});
