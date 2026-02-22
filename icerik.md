# TrHaber - AI Destekli Otomatik Haber Platformu

Bu proje, dünya çapındaki teknoloji ve bilim haberlerini anlık olarak takip eden, Google Gemini Yapay Zeka (AI) teknolojisini kullanarak bu haberleri Türkçeye çeviren ve profesyonel bir haber diliyle yeniden yazan tam kapsamlı bir haber platformudur.

## 🚀 Proje Hakkında
**TrHaber**, sadece bir haber okuma sitesi değil, aynı zamanda otonom bir içerik üretim merkezidir. Sistem, belirlenen uluslararası kaynaklardan (GameSpot, TechCrunch, The Verge vb.) verileri çeker, analiz eder ve kullanıcıya sosyal özellikleri olan modern bir arayüzle sunar.

### 🌟 Temel Özellikler
- **Tam Otomatik Scraper:** Python tabanlı gelişmiş veri çekme modülü.
- **AI Destekli İçerik Üretimi:** Google Gemini (gemma-3-27b-it) entegrasyonu ile otomatik çeviri ve özgünleştirme.
- **Gelişmiş Sosyal Sistem:** Kullanıcı kaydı, profil özelleştirme, takipleşme, beğeni ve yorum yapma.
- **Kategori Bazlı Yapı:** Teknoloji, Yapay Zeka, Uzay, Bilim, Oyun, Otomobil gibi spesifik kategoriler.
- **Canlı Finans Verileri:** Döviz kurları (USD, EUR), altın fiyatları ve kripto para (BTC, ETH, SOL) değerlerinin anlık takibi.
- **Admin Kontrol Paneli:** İçerik ve kullanıcı yönetimi için özel yönetim arayüzü.
- **SEO Dostu:** Otomatik sitemap ve robots.txt üretimi, SEO uyumlu başlık ve özet yapıları.

## 🛠️ Teknik Altyapı
- **Backend:** Node.js, Express.js
- **Scraper:** Python 3 (BeautifulSoup4, Requests, Feedparser, Google Generative AI)
- **Veritabanı:** Gelişmiş JSON tabanlı veri depolama (Hız ve taşınabilirlik için optimize edilmiş).
- **Yapay Zeka:** Google Gemini API (İçerik yeniden yazımı ve çeviri).
- **Frontend:** Vanilla JS, CSS3, HTML5 (Modern, duyarlı tasarım).

## 📁 Proje Klasör Yapısı
- `/scraper`: Python tabanlı haber çekme ve AI işleme motoru.
- `/public`: Web arayüzü dosyaları (HTML, CSS, JS).
- `/data`: Haberlerin, kullanıcıların ve yorumların tutulduğu JSON dosyaları.
- `server.js`: Node.js API ve web sunucusu.
- `package.json`: Proje bağımlılıkları ve scriptleri.

## ⚙️ Kurulum ve Çalıştırma

### 1. Gereksinimler
- Node.js (v16 veya üzeri)
- Python 3.x
- Google Gemini API Anahtarı

### 2. Bağımlılıkların Yüklenmesi
```bash
# Node.js paketleri için
npm install

# Python kütüphaneleri için
pip install requests beautifulsoup4 google-generativeai feedparser cryptography lxml
```

### 3. Yapılandırma
`scraper/scraper_config.json` dosyasını açın ve Gemini API anahtarınızı girin:
```json
{
    "gemini_api_key": "YOUR_GEMINI_API_KEY",
    "scrape_urls": [...],
    "categories": [...]
}
```

### 4. Sistemini Başlatma
Haberleri çekmek ve AI ile işlemek için:
```bash
python scraper/scraper.py
```

Web sunucusunu başlatmak için:
```bash
npm start
```
Buna takiben siteye `http://localhost:3000` adresinden erişebilirsiniz.

## 🤖 Scraper Özellikleri (Detaylı)
Scraper modülü, dünya devlerini takip eder:
- **Kaynaklar:** GameSpot, Wired, TechCrunch, CNET, Ars Technica, The Verge, ScienceDaily vb.
- **Zeki Temizlik:** `â€¢`, `â€™` gibi encoding hatalarını otomatik düzeltir.
- **Özgünleştirme:** Haberi olduğu gibi çevirmek yerine, TrHaber üslubuyla ("Haber Merkezi bildiriyor...") yeniden kurgular.
- **Görsel Yönetimi:** Haberin orijinal görselini çeker ve formatlar.

---
*Bu proje, modern bir haber platformunun tüm gereksinimlerini tek bir çatıda birleştirir.*
