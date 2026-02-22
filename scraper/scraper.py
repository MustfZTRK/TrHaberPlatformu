import json
import mysql.connector
import requests
from bs4 import BeautifulSoup
import google.generativeai as genai
import time
import os
import sys
from cryptography.fernet import Fernet
import json
from urllib.parse import urljoin
import feedparser
import xml.etree.ElementTree as ET
import re
import logging
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from lxml import etree, html




sys.path.insert(0, os.path.dirname(__file__))


def application(environ, start_response):
    start_response('200 OK', [('Content-Type', 'text/plain')])
    message = 'It works!\n'
    version = 'Python v' + sys.version.split()[0] + '\n'
    response = '\n'.join([message, version])
    return [response.encode()]
    
# Logging setup for both file and terminal
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "scraper.log")),
        logging.StreamHandler(sys.stdout)
    ]
)

def sleep_until_after_first_quarter():
    try:
        now = time.localtime()
        if now.tm_min < 1:
            wait_seconds = (15 - now.tm_min) * 60 - now.tm_sec
            logging.info("Saat başı yoğunluk: ilk 15 dakikada bekleniyor...")
            time.sleep(max(1, wait_seconds))
    except Exception:
        # Eğer zaman hesabında beklenmedik bir hata olursa, güvenli kısa bekleme
        time.sleep(60)
def resource_path(relative_path):
    """PyInstaller ile paketlenmiş dosya yolunu bulur"""
    base_path = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_path, relative_path)
def load_config():
    with open(resource_path("scraper_config.json"), "r") as f:
        return json.load(f)

def load_site_categories():
    try:
        app_cat_path = "/home/webhosting/public_html/data/kategoriler.json"
        with open(app_cat_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return [c.get("ad") for c in data if c.get("ad")]
    except Exception as e:
        logging.info(f"Kategori dosyası okunamadı, varsayılana dönülüyor: {e}")
        return ["Gündem", "Ekonomi", "Teknoloji", "Sağlık", "Bilim", "Otomobil", "Yapay Zeka", "Oyun", "Kültür", "Politika", "Güvenlik", "Uzay"]

def normalize_category(cat, site_categories):
    if not cat:
        return "Gündem"
    cat_clean = cat.strip()
    for sc in site_categories:
        if sc.lower() == cat_clean.lower():
            return sc
    synonyms = {
        "culture": "Kültür",
        "science": "Bilim",
        "health": "Sağlık",
        "technology": "Teknoloji",
        "automobile": "Otomobil",
        "auto": "Otomobil",
        "politics": "Politika",
        "security": "Güvenlik",
        "space": "Uzay",
        "gaming": "Oyun",
        "game": "Oyun",
        "ai": "Yapay Zeka",
        "artificial intelligence": "Yapay Zeka",
        "economy": "Ekonomi",
        "business": "Ekonomi",
        "finance": "Ekonomi"
    }
    mapped = synonyms.get(cat_clean.lower())
    if mapped and mapped in site_categories:
        return mapped
    return "Gündem"
def rewrite_with_gemini(api_key, english_title, english_content, categories):
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemma-3-27b-it')
    
    prompt = f"""
    Aşağıdaki İngilizce haberi al ve Türk haber sitesi üslubuyla (TrHaber) yeniden yaz ve çevir.
    Haber tamamen Türkçe olmalı ve telif haklarına uygun olması için yeniden yorumlanmalıdır.
    Kategoriyi şu listeden seç: {', '.join(categories)}
    
    ÖNEMLİ KURALLAR:
    1. İçerik çok kısaysa (sadece başlık veya kısa özet varsa), ASLA yeni bilgi uydurma. 
    2. Sadece eldeki bilgiyi Türkçeleştir ve haberleştir. 
    3. Yanlış haber yapmaktansa, kısa ve öz haber yapmak daha iyidir.
    4. JSON içinde çift tırnak kullanırken mutlaka ters slaş ile kaçış yap (Örn: \\"Örnek\\").
    
    Format Strictly JSON:
    {{
        "baslik": "Haber başlığı",
        "kisa_baslik": "Kısa başlık",
        "ozet": "Haber özeti",
        "icerik": "<p>Haber metni...</p>",
        "kategori": "Kategori"
    }}

    İngilizce Başlık: {english_title}
    İngilizce İçerik: {english_content}
    """
    
    for attempt in range(2):
        try:
            response = model.generate_content(prompt)
            text = response.text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            text = text.strip()
            start = text.find('{')
            end = text.rfind('}')
            if start != -1 and end != -1:
                text = text[start:end+1]
            return json.loads(text)
        except Exception as e:
            msg = str(e)
            if "403" in msg and "unregistered callers" in msg:
                logging.error(f"Gemini output parsing error: {e}")
                if attempt == 0:
                    time.sleep(600)
                    continue
            logging.error(f"Gemini output parsing error: {e}")
            return None

def fix_encoding(text):
    if not text: return text
    # Fix common UTF-8 to Windows-1252 artifacts
    replacements = {
        "â€¢": "•",
        "â€“": "–",
        "â€”": "—",
        "â€™": "'",
        "â€œ": '"',
        "â€?": '"',
        "Â": "",
        "â€¦": "...",
        "Ä±": "ı",
        "ÄŸ": "ğ",
        "Ã¼": "ü",
        "ÅŸ": "ş",
        "Ã¶": "ö",
        "Ã§": "ç"
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text

def get_article_full_content(article_url):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Referer': 'https://www.google.com/'
        }
        import random
        time.sleep(random.uniform(1, 3))
        session = requests.Session()
        retry = Retry(total=2, backoff_factor=0.5, status_forcelist=[403, 429, 500, 502, 503, 504], allowed_methods=["GET"])
        adapter = HTTPAdapter(max_retries=retry)
        session.mount('https://', adapter)
        session.mount('http://', adapter)

        def fetch_and_extract(url):
            resp = session.get(url, headers=headers, timeout=15)
            if resp.status_code == 403:
                return None, None
            resp.raise_for_status()
            sp = BeautifulSoup(resp.content, 'html.parser')
            og_img = sp.find('meta', property='og:image')
            img_url = og_img['content'] if og_img and og_img.get('content') else None
            paras = []
            if "livemint.com" in url:
                response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
                soup = BeautifulSoup(response.text, "html.parser")
                p_tags = soup.find_all('p')
                for p in p_tags:
                    t = p.get_text().strip()
                    if t:
                        paras.append(t)
            else:
                selectors = [
                    'article p', '.entry-content p', '.article-body p', '.post-content p', 'main p',
                    '[itemprop="articleBody"] p', '#content p', '.c-article-content p', '.content p'
                ]
                for sel in selectors:
                    found = sp.select(sel)
                    if found:
                        for p in found:
                            t = p.get_text().strip()
                            if len(t) > 40:
                                paras.append(t)
                        if len(paras) > 2:
                            break
            return img_url, "\n\n".join(paras)

        image_url, full_text = fetch_and_extract(article_url)
        
        if not full_text and "livemint.com" in article_url:
            full_text = scrape_article(article_url)
            
        if not full_text and "livemint.com" not in article_url:
            amp_url = article_url.rstrip('/') + '/amp'
            image_url, full_text = fetch_and_extract(amp_url)

        if not full_text and "livemint.com" not in article_url:
            sep = '&' if '?' in article_url else '?'
            amp2_url = f"{article_url}{sep}output=amp"
            image_url, full_text = fetch_and_extract(amp2_url)

        return image_url, full_text
    except Exception as e:
        logging.error(f"Error fetching full content from {article_url}: {e}")
        return None, None
def scrape_article(URL):
    response = requests.get(URL, headers={"User-Agent": "Mozilla/5.0"})
    if response.status_code != 200:
        print(f"Request failed with status {response.status_code}")
        return

    soup = BeautifulSoup(response.text, "html.parser")

    # Başlık
    title = soup.find("h1")
    if title:
        print("=== Makale Başlığı ===")
        print(title.get_text(strip=True))
        print()

    # Paragraflar
    textplus = ""
    print("=== İçerik ===")
    for p in soup.find_all("p"):
        text = p.get_text(strip=True)
        if text:
             textplus += "\n" + text
        else:
            textplus = ""
    if(textplus != ""):
        return textplus
    else:
        return ""
def get_article_details(article_url):
    """
    Bir haber URL'sinden öne çıkan görsel ve kısa açıklama döner.
    Dönüş: (image_url, description)
    """
    # Önce kapsamlı içerik toplayan yardımcıyı deneyelim
    img, full_text = get_article_full_content(article_url)
    description = None
    try:
        if full_text:
            parts = [p.strip() for p in full_text.split("\n\n") if p.strip()]
            if len(parts) >= 2:
                description = (parts[0] + " " + parts[1]).strip()
            else:
                description = parts[0]
            # Çok uzun olursa kısalt
            if description and len(description) > 400:
                description = description[:400].rsplit(' ', 1)[0] + "..."
        # Eksikler için fallback: sayfayı tekrar hafifçe incele
        if not img or not description:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
                'Accept-Encoding': 'gzip, deflate',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Referer': 'https://www.google.com/'
            }
            resp = requests.get(article_url, headers=headers, timeout=15)
            if resp.status_code != 403:
                resp.raise_for_status()
                soup = BeautifulSoup(resp.content, 'html.parser')
                if not img:
                    og_img = soup.find('meta', property='og:image')
                    if og_img and og_img.get('content'):
                        img = og_img['content']
                if not description:
                    if "livemint.com" in article_url:
                        container = soup.select_one('div.taboola-readmore div.storyPage_storyContent__3xuFc') or soup.select_one('div.storyPage_storyContent__3xuFc')
                        if container:
                            p_tags = container.select('div.storyParagraph p')
                            texts = [p.get_text().strip() for p in p_tags if p.get_text().strip()]
                            if texts:
                                description = " ".join(texts)
                                if len(description) > 400:
                                    description = description[:400].rsplit(' ', 1)[0] + "..."
                    if not description:
                        og_desc = soup.find('meta', property='og:description') or soup.find('meta', attrs={'name': 'description'})
                        if og_desc and og_desc.get('content'):
                            description = og_desc['content'].strip()
                        else:
                            p_tags = soup.select('article p, .entry-content p, .article-body p, .post-content p, main p')
                            texts = [p.get_text().strip() for p in p_tags if p.get_text().strip()]
                            if texts:
                                description = " ".join(texts[:2])
                                if len(description) > 400:
                                    description = description[:400].rsplit(' ', 1)[0] + "..."
        return img, description
    except Exception as e:
        logging.info(f"get_article_details error for {article_url}: {e}")
        return img, description
def scrape_theverge_articles(url):
    articles = []
    try:
        session = requests.Session()
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Referer': 'https://www.theverge.com/',
            'Connection': 'keep-alive'
        }
        response = None
        for attempt in range(3):
            try:
                resp = session.get(url, headers=headers, timeout=20)
                if resp.status_code == 200:
                    response = resp
                    break
                if resp.status_code in (403, 420, 429):
                    time.sleep(2 * (attempt + 1))
                    continue
                resp.raise_for_status()
            except requests.exceptions.RequestException:
                if attempt == 2:
                    raise
                time.sleep(2 * (attempt + 1))
        if response is None:
            raise requests.exceptions.RequestException("Failed to fetch The Verge RSS after retries")
        content = response.text

        # Clean CDATA tags to prevent parsing errors
        content = re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', content, flags=re.DOTALL)

        feed = feedparser.parse(content)
        if feed.bozo:
            logging.info(f"Error parsing RSS feed for The Verge: {feed.bozo_exception}")
            feed = feedparser.parse(response.content)
            if feed.bozo:
                logging.info(f"Still can't parse The Verge RSS feed even without CDATA cleaning: {feed.bozo_exception}")
                # Fallback: let feedparser fetch directly from URL with its own client
                feed = feedparser.parse(url)
                if feed.bozo:
                    logging.info(f"Feedparser URL fallback also failed for The Verge: {feed.bozo_exception}")
                    return articles

        for entry in feed.entries[:30]:
            image_url, description = get_article_details(entry.link)
            
            if not description and hasattr(entry, 'summary'):
                soup = BeautifulSoup(entry.summary, 'html.parser')
                description = soup.get_text(separator=' ', strip=True)
            elif not description and hasattr(entry, 'description'):
                soup = BeautifulSoup(entry.description, 'html.parser')
                description = soup.get_text(separator=' ', strip=True)
            elif not description:
                description = entry.title

            if image_url is None:
                if hasattr(entry, 'media_content') and entry.media_content:
                    images = [item for item in entry.media_content if item.get('medium') == 'image']
                    if images and images[0].get('url'):
                        image_url = images[0]['url']
                elif hasattr(entry, 'links'):
                    for e_link in entry.links:
                        if e_link.get('type', '').startswith('image/') and e_link.get('href'):
                            image_url = e_link.href
                            break
            
            if entry.title and entry.link:
                articles.append({
                    'title': entry.title,
                    'url': entry.link,
                    'image_url': image_url,
                    'content': description
                })
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching The Verge RSS feed URL: {e}")
    except Exception as e:
        logging.info(f"An unexpected error occurred in scrape_theverge_articles: {e}")
    return articles
def get_sciencedaily_article_image(article_url):
    try:
        response = requests.get(article_url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        # Find the image element with class "img-responsive"
        img_element = soup.find('img', class_='img-responsive')
        if img_element:
            # Extract the src attribute
            image_url = img_element.get('src')
            if image_url and not image_url.startswith('http'):
                # Make sure it's an absolute URL
                image_url = urljoin("https://www.sciencedaily.com", image_url)
            return image_url
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching ScienceDaily article image from {article_url}: {e}")
    return None

def scrape_sciencedaily_articles(rss_url):
    articles = []
    try:
        response = requests.get(rss_url)
        response.raise_for_status()
        root = ET.fromstring(response.content)

        for item in root.findall('.//item'):
            if len(articles) >= 30:
                break
            title = item.find('title').text if item.find('title') is not None else ''
            link = item.find('link').text if item.find('link') is not None else ''
            description = item.find('description').text if item.find('description') is not None else ''

            image_url = None
            if link:
                image_url = get_sciencedaily_article_image(link)

            articles.append({
                'title': title,
                'url': link,
                'image_url': image_url,
                'content': description # Using description as content for now
            })
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching RSS feed from {rss_url}: {e}")
    except ET.ParseError as e:
        logging.info(f"Error parsing RSS feed from {rss_url}: {e}")
    return articles

def scrape_livemint_articles(url):
    articles = []
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        content = response.text

        # Clean CDATA tags to prevent parsing errors
        # The re.DOTALL flag ensures that '.' matches newlines as well
        content = re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', content, flags=re.DOTALL)

        feed = feedparser.parse(content)
        if feed.bozo:
            logging.info(f"Error parsing RSS feed for Livemint: {feed.bozo_exception}")
            # Try parsing original content as a fallback, though less likely to work
            feed = feedparser.parse(response.content)
            if feed.bozo:
                logging.info(f"Still can't parse Livemint RSS feed even without CDATA cleaning: {feed.bozo_exception}")
                return articles

        for entry in feed.entries[:30]:
            # The original code fetches image_url and description from the article link.
            # This is good as RSS feeds sometimes don't have rich image info directly.
            image_url, description = get_article_details(entry.link)
            
            # If get_article_details fails or returns empty description, fall back to entry.summary/description
            
            if not description: # Fallback to title if no description
                description = entry.title

            # Ensure image_url is not None before appending
            if image_url is None:
                # Attempt to find image from feed entry itself if not found via get_article_details
                if hasattr(entry, 'media_content') and entry.media_content:
                    images = [item for item in entry.media_content if item.get('medium') == 'image']
                    if images and images[0].get('url'):
                        image_url = images[0]['url']
                elif hasattr(entry, 'links'):
                    for e_link in entry.links:
                        if e_link.get('type', '').startswith('image/') and e_link.get('href'):
                            image_url = e_link.href
                            break
            
            # Only add article if it has a title and URL, and optionally an image or content
            if entry.title and entry.link:
                articles.append({
                    'title': entry.title,
                    'url': entry.link,
                    'image_url': image_url, # image_url might still be None, handle on display
                    'content': description
                })
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching Livemint RSS feed URL: {e}")
    except Exception as e:
        logging.info(f"An unexpected error occurred in scrape_livemint_articles: {e}")
    return articles

def scrape_washingtonpost_articles(url):
    articles = []
    feed = feedparser.parse(url)
    if feed.bozo:
        logging.info(f"Error parsing RSS feed: {feed.bozo_exception}")
        return articles

    for entry in feed.entries[:30]:
        image_url, description = get_article_details(entry.link)
        if image_url and description:
            articles.append({
                'title': entry.title,
                'url': entry.link,
                'image_url': image_url,
                'content': description
            })
    return articles

def scrape_nytimes_articles(url):
    articles = []
    feed = feedparser.parse(url)
    if feed.bozo:
        logging.info(f"Error parsing RSS feed: {feed.bozo_exception}")
        return articles

    for entry in feed.entries[:30]:
        description = None
        if hasattr(entry, 'summary'):
            description = BeautifulSoup(entry.summary, 'html.parser').get_text(separator=' ', strip=True)
        elif hasattr(entry, 'description'):
            description = BeautifulSoup(entry.description, 'html.parser').get_text(separator=' ', strip=True)
        if not description:
            description = entry.title
        
        image_url = 'No image found'
        if hasattr(entry, 'media_content') and entry.media_content:
            image_url = entry.media_content[0]['url']
        elif hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
            image_url = entry.media_thumbnail[0]['url']

        if image_url != 'No image found': # Only add if image_url is found
            articles.append({
                'title': entry.title,
                'url': entry.link,
                'image_url': image_url,
                'content': description
            })
    return articles

def scrape_arstechnica_articles(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        articles = []
        for item in soup.select('article.card-list-square'):
            if len(articles) >= 30:
                break
            title_element = item.select_one('h2 a')
            image_element = item.select_one('img.wp-post-image')
            if title_element and image_element:
                title = title_element.get_text(strip=True)
                link = title_element['href']
                if not link.startswith('http'):
                    link = f"https://arstechnica.com{link}"
                image_url = image_element['src']
                content_element = item.select_one('p.leading-tighter')
                content = content_element.get_text(strip=True) if content_element else ''
                articles.append({'title': title, 'url': link, 'image_url': image_url, 'content': content})
        return articles
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching URL: {e}")
    return []

def scrape_cnet_articles(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        articles = []
        for item in soup.select('a.c-storiesNeonLatest_story'):
            if len(articles) >= 30:
                break
            title_element = item.select_one('h3.c-storiesNeonLatest_hed')
            picture_element = item.select_one('picture')
            image_url = None
            if picture_element:
                source_element = picture_element.find_all('source')
                if source_element:
                    # Take the first URL from the srcset (usually the highest resolution)
                    srcset = source_element[-1].get('srcset')
                    if srcset:
                        image_url = srcset.split(',')[0].strip().split(' ')[0]

            if title_element and image_url:
                title = title_element.get_text(strip=True)
                link = item['href']
                if not link.startswith('http'):
                    link = f"https://www.cnet.com{link}"
                content = get_cnet_article_content(link)
                articles.append({'title': title, 'url': link, 'image_url': image_url, 'content': content})
        return articles
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching URL: {e}")
    return []

def scrape_techcrunch_articles(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        articles = []
        for item in soup.select('li.wp-block-post'):
            if len(articles) >= 30:
                break
            title_element = item.select_one('h3.loop-card__title a')
            image_element = item.select_one('img.wp-post-image')
            if title_element and image_element:
                title = title_element.get_text(strip=True)
                link = title_element['href']
                image_url = image_element['src']
                content = get_techcrunch_article_content(link)
                articles.append({'title': title, 'url': link, 'image_url': image_url, 'content': content})
        return articles
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching URL: {e}")
    return []

def scrape_wired_articles(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        articles = []
        for item in soup.select('div.SummaryItemWrapper-ircKXK'):
            if len(articles) >= 30:
                break
            title_element = item.select_one('a.SummaryItemHedLink-cxRzVg')
            picture_element = item.select_one('picture')
            image_url = None
            if picture_element:
                img_element = picture_element.select_one('img')
                if img_element and img_element.get('src'):
                    image_url = img_element.get('src')
                elif img_element and img_element.get('srcset'):
                    srcset = img_element.get('srcset')
                    image_url = srcset.split(',')[0].strip().split(' ')[0]

            if title_element and image_url:
                title = title_element.get_text(strip=True)
                link = title_element['href']
                if not link.startswith('http'):
                    link = f"https://www.wired.com{link}"
                
                content_element = item.select_one('p.SummaryItemDek-cQxVp')
                content = content_element.get_text(strip=True) if content_element else title

                articles.append({'title': title, 'url': link, 'image_url': image_url, 'content': content})
        return articles
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching URL: {e}")
    return []

def scrape_bbc_articles(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        articles = []
        for item in soup.select('div.ixgXiW div.fKTSfm'):
            if len(articles) >= 30:
                break
            title_element = item.select_one('h2 a')
            image_element = item.select_one('div.fMwdlz img')
            if title_element and image_element:
                title = title_element.get_text(strip=True)
                link = title_element['href']
                image_url = image_element['src']
                articles.append({'title': title, 'url': link, 'image_url': image_url})
        return articles
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching URL: {e}")
    return []

def scrape_cnbc_articles(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        articles = []
        for item in soup.select('div.Card-card'):
            if len(articles) >= 30:
                break
            title_element = item.select_one('div.Card-title a')
            image_element = item.select_one('div.Card-mediaContainer img')
            if title_element and image_element:
                title = title_element.get_text(strip=True)
                link = title_element['href']
                image_url = image_element['src']
                articles.append({'title': title, 'url': link, 'image_url': image_url})
        return articles
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching URL: {e}")
    return []
    
    
def scrape_gamespot_feed(url="https://www.gamespot.com/feeds/news/"):
    try:
        response = requests.get(url)
        response.raise_for_status()

        # XML parse
        root = etree.fromstring(response.content)

        articles = []
        for item in root.findall(".//item")[:30]:
            title = item.findtext("title")
            link = item.findtext("link")
            pub_date = item.findtext("pubDate")
            guid = item.findtext("guid")
            creator = item.findtext("{http://purl.org/dc/elements/1.1/}creator")

            # Description içindeki CDATA HTML'i temizle
            raw_description = item.findtext("description")
            content = None
            if raw_description:
                # HTML parse edip sadece text alıyoruz
                content = html.fromstring(raw_description).text_content().strip()

            # media:content alanı namespaceli
            image_url = None
            media_content = item.find("{http://search.yahoo.com/mrss/}content")
            if media_content is not None and "url" in media_content.attrib:
                image_url = media_content.attrib["url"]

            articles.append({
                "title": title,
                "url": link,
                "content": content,
                "image_url": image_url
            })

        return articles

    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching GameSpot feed: {e}")
        return []




def scrape_gamespot_articles(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        articles = []
        # The main container for the latest stories is #river, then section.filter-results
        # Each article item is div.card-item
        for item in soup.select('section.filter-results div.card-item'):
            if len(articles) >= 30:
                break
            
            # Article Link and Title
            link_element = item.select_one('div.card-item__main a.card-item__link')
            title_element = item.select_one('div.card-item__main a.card-item__link h4.card-item__title')
            
            # Article Image
            image_element = item.select_one('div.card-item__img img')
            
            if link_element and title_element and image_element:
                title = title_element.get_text(strip=True)
                link = link_element['href']
                image_url = image_element['src']
                
                # Ensure absolute URL
                if not link.startswith('http'):
                    link = urljoin(url, link)
                if not image_url.startswith('http'):
                    image_url = urljoin(url, image_url)

                # GameSpot articles don't seem to have a short content snippet on the listing page
                # We can use the title as content for now, or fetch full content if needed later
                content = title # Placeholder content

                articles.append({'title': title, 'url': link, 'image_url': image_url, 'content': content})
        return articles
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching GameSpot URL: {e}")
    return []

def get_gizmodo_featured_image(article_url, timeout=10, headers=None):
    """
    Verilen Gizmodo haber URL'sinden öne çıkarılmış görseli döner.
    Dönen değer: image_url (str) veya None
    """
    if headers is None:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; Bot/1.0; +https://example.com/bot)"
        }

    try:
        resp = requests.get(article_url, timeout=timeout, headers=headers)
        resp.raise_for_status()
    except requests.RequestException as e:
        logging.info(f"Error fetching article URL: {e}")
        return None

    soup = BeautifulSoup(resp.content, "html.parser")

    # Öncelikli hedef: <figure id="attachment_featured"> içindeki <img>
    fig = soup.select_one('figure#attachment_featured')
    img = None
    if fig:
        img = fig.select_one('img')

    # Eğer bulunamadıysa, istenen outer div yapısını kullanarak arama yap
    if not img:
        outer = soup.select_one('div.xl\\:w-7\\/12.flex.py-8.xl\\:pt-8.xl\\:-mb-32.justify-end')
        if outer:
            img = outer.select_one('img')

    # Ek geri dönüşümler: daha genel arama (haber body içinde featured img)
    if not img:
        possible = soup.select('article img, .wp-post-image, figure img')
        for candidate in possible:
            # tercih: id veya class içeren wp-post-image veya attachment_featured
            cls = candidate.get('class') or []
            if 'wp-post-image' in cls or candidate.find_parent('figure') and candidate.find_parent('figure').get('id') == 'attachment_featured':
                img = candidate
                break
        if not img and possible:
            img = possible[0]

    if not img:
        return None

    # Try src first, then srcset
    image_url = img.get('src')
    if not image_url:
        srcset = img.get('srcset')
        if srcset:
            # srcset format: "url1 1500w, url2 768w, ..."
            image_url = srcset.split(',')[0].strip().split(' ')[0]

    if not image_url:
        return None

    # Mutlak URL yap
    image_url = urljoin(article_url, image_url)
    return image_url

def scrape_gizmodo_articles(url):
    """
    Gizmodo liste sayfasından en fazla 30 makale çeker.
    Her makale için: title, url, image_url (haber sayfasındaki featured image), content (kart içi özet varsa)
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, 'html.parser')
        articles = []

        # Başlık seçicisi: listede <a><h3> yapısını hedefliyoruz
        title_elements = soup.select('a h3')

        for title_element in title_elements:
            if len(articles) >= 30:
                break

            # Başlık metni ve başlığa bağlı <a>
            title = title_element.get_text(strip=True)
            title_anchor = title_element.find_parent('a')
            link = title_anchor.get('href') if title_anchor else None
            if not link:
                continue
            if not link.startswith('http'):
                link = f"https://gizmodo.com{link}"

            # Kart içindeki kısa özet varsa al
            container = title_element.find_parent()
            content = ''
            if container:
                p = container.select_one('p')
                if p:
                    content = p.get_text(strip=True)

            # Haber sayfasını ziyaret edip featured image al
            image_url = None
            try:
                image_url = get_gizmodo_featured_image(link, headers=headers)
            except Exception:
                image_url = None

            articles.append({
                'title': title,
                'url': link,
                'image_url': image_url,
                'content': content
            })

        return articles
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching URL: {e}")
    return []


def scrape_mashable_articles(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        articles = []

        # Find all <a> tags and filter for article links
        all_links = soup.find_all('a')
        for link_tag in all_links:
            if len(articles) >= 30:
                break
            href = link_tag.get('href')
            if href and '/article/' in href:
                # Construct absolute URL if it's relative
                if not href.startswith('http'):
                    link = f"https://mashable.com{href}"
                else:
                    link = href

                title_element = link_tag.select_one('h2')
                image_element = link_tag.select_one('img')

                if title_element:
                    title = title_element.get_text(strip=True)
                    image_url = image_element.get('src') if image_element else None
                    content = get_mashable_article_content(link) # Fetch content from article page
                    articles.append({'title': title, 'url': link, 'image_url': image_url, 'content': content})
        return articles
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching URL: {e}")
    return []

def get_cnet_article_content(article_url):
    try:
        response = requests.get(article_url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        content_element = soup.select_one('p.u-speakableText-dek.c-contentHeader_description')
        if content_element:
            return content_element.get_text(strip=True)
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching CNET article content from {article_url}: {e}")
    return ''

def get_techcrunch_article_content(article_url):
    try:
        response = requests.get(article_url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        content_element = soup.select_one('p#speakable-summary.wp-block-paragraph')
        if content_element:
            return content_element.get_text(strip=True)
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching TechCrunch article content from {article_url}: {e}")
    return ''

def get_mashable_article_content(article_url):
    try:
        response = requests.get(article_url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        content_element = soup.select_one('div.mt-2.leading-tight.md\\:leading-normal.text-xl.max-w-4xl')
        if content_element:
            return content_element.get_text(strip=True)
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching Mashable article content from {article_url}: {e}")
    return ''

def scrape_pcgamer_articles(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')
        articles = []
        for item in soup.select('div.listingResult'):
            if len(articles) >= 30:
                break
            
            link_element = item.select_one('a.article-link')
            title_element = item.select_one('h3.article-name')
            image_element = item.select_one('picture img')
            content_element = item.select_one('p.synopsis')

            if link_element and title_element and image_element:
                title = title_element.get_text(strip=True)
                link = link_element['href']
                image_url = image_element.get('data-original-mos') or image_element.get('src')
                content = content_element.get_text(strip=True) if content_element else title

                if not link.startswith('http'):
                    link = urljoin(url, link)
                if not image_url.startswith('http'):
                    image_url = urljoin(url, image_url)

                articles.append({'title': title, 'url': link, 'image_url': image_url, 'content': content})
        return articles
    except requests.exceptions.RequestException as e:
        logging.info(f"Error fetching PC Gamer URL: {e}")
    return []

def check_if_exists(url):
    file_path = "/home/webhosting/public_html/data/haberler.json"
    if not os.path.exists(file_path):
        return False
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            haberler = json.load(f)
            return any(h.get('kaynak', {}).get('link') == url for h in haberler)
    except:
        return False

def save_to_json(news_data):
    file_path = "/home/webhosting/public_html/data/haberler.json"
    try:
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                haberler = json.load(f)
        else:
            haberler = []
        
        # Check if already exists by original URL or title
        if any(h.get('kaynak', {}).get('link') == news_data['kaynak']['link'] for h in haberler):
            logging.info(f"Haber zaten var: {news_data['baslik']}")
            return

        # New ID
        max_id = max([h['id'] for h in haberler], default=0)
        news_data['id'] = max_id + 1
        
        haberler.insert(0, news_data) # Add to top
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(haberler, f, ensure_ascii=False, indent=4)
        logging.info(f"Haber JSON'a başarıyla eklendi: {news_data['baslik']}")
    except Exception as e:
        logging.error(f"Error saving to JSON: {e}")

def main():
    # Target categories from TrHaber
    site_categories = load_site_categories()
    
    logging.info("Scraper döngüsü başlatıldı.")
    
    
    try:
        sleep_until_after_first_quarter()
        config = load_config()
        logging.info("Yeni tarama döngüsü başlıyor...")
        
        for url in config['scrape_urls']:
            logging.info(f"Scraping {url}")
            articles = []
            url = (url or "").strip().replace("`", "").strip()
            if not re.match(r'^https?://', url):
                logging.info(f"Geçersiz URL atlandı: {url}")
                continue
            url_lower = url.lower()
            source_name = "Haber Merkezi"
            source_logo = "https://cdn-icons-png.flaticon.com/512/2991/2991148.png" # Default
            
            if "nytimes.com" in url_lower: 
                source_name = "The New York Times"
                source_logo = "https://www.nytimes.com/favicon.ico"
            elif "theverge.com" in url_lower: 
                source_name = "The Verge"
                source_logo = "https://www.theverge.com/favicon.ico"
            elif "techcrunch.com" in url_lower: 
                source_name = "TechCrunch"
                source_logo = "https://techcrunch.com/wp-content/uploads/2015/02/tc-logo-200x200.png"
            elif "wired.com" in url_lower: 
                source_name = "Wired"
                source_logo = "https://www.wired.com/favicon.ico"
            elif "gizmodo.com" in url_lower: 
                source_name = "Gizmodo"
                source_logo = "https://gizmodo.com/favicon.ico"
            elif "arstechnica.com" in url_lower: 
                source_name = "Ars Technica"
                source_logo = "https://arstechnica.com/favicon.ico"
            elif "pcgamer.com" in url_lower: 
                source_name = "PC Gamer"
                source_logo = "https://www.pcgamer.com/favicon.ico"
            elif "gamespot.com" in url_lower: 
                source_name = "GameSpot"
                source_logo = "https://www.gamespot.com/favicon.ico"
            elif "cnet.com" in url_lower: 
                source_name = "CNET"
                source_logo = "https://www.cnet.com/favicon.ico"
            elif "sciencedaily.com" in url_lower:
                source_name = "ScienceDaily"
                source_logo = "https://www.sciencedaily.com/favicon.ico"
            elif "livemint.com" in url_lower:
                source_name = "Livemint"
                source_logo = "https://www.livemint.com/favicon.ico"
            
            try:
                if "nytimes.com" in url: articles = scrape_nytimes_articles(url)
                elif "theverge.com" in url: articles = scrape_theverge_articles(url)
                elif "sciencedaily.com" in url: articles = scrape_sciencedaily_articles(url)
                elif "livemint.com" in url: articles = scrape_livemint_articles(url)
                elif "pcgamer.com" in url: articles = scrape_pcgamer_articles(url)
                elif "gamespot.com" in url: articles = scrape_gamespot_feed(url)
                elif "gizmodo.com" in url: articles = scrape_gizmodo_articles(url)
                elif "arstechnica.com" in url: articles = scrape_arstechnica_articles(url)
                elif "techcrunch.com" in url: articles = scrape_techcrunch_articles(url)
                elif "wired.com" in url: articles = scrape_wired_articles(url)
                elif "cnet.com" in url: articles = scrape_cnet_articles(url)
            except Exception as e:
                logging.error(f"Scrape error for {url}: {e}")
                continue

            logging.info(f"Found {len(articles)} items. Processing titles...")
            
            for item in articles:
                # PRE-CHECK: Duplicate URL check before processing anywhere
                if check_if_exists(item['url']):
                    logging.info(f"Atlanıyor (Zaten var): {item['title'][:50]}")
                    continue
                
                if not ("gamespot.com" in item['url']):
                    
                    if ("nytimes.com" in item['url']):
                        img = item.get('image_url')
                        full_text = item.get('content') or item['title']
                    else:
                        img, full_text = get_article_full_content(item['url'])
                        if not full_text:
                            full_text = item.get('content') or item['title']
                            logging.info(f"Tam içerik alınamadı, kısa özet kullanılıyor: {item['url']}")
                else:
                    full_text = item.get('content')
                    img = item.get('image_url')
                    
                # Clean the content before sending to Gemini
                full_text = fix_encoding(full_text)
                item['title'] = fix_encoding(item['title'])
                
                final_img = img if img else item.get('image_url')

                # GenAI Rewrite
                logging.info(f"Yapay zeka ile yeniden yazılıyor: {item['url']}{item['title'][:50]}...")
                
                result = rewrite_with_gemini(config['gemini_api_key'], item['title'], full_text, site_categories)
                


                #result = rewrite_with_gemini(config['gemini_api_key'], item['title'], full_text, site_categories)
                
                if result and isinstance(result, dict):
                    baslik = result.get('baslik')
                    icerik_out = result.get('icerik')
                    if not baslik or not icerik_out:
                        logging.info("Eksik alan (baslik/icerik) nedeniyle haber atlandı.")
                        continue
                    kisa_baslik = result.get('kisa_baslik') or baslik
                    ozet = result.get('ozet') or "boş"
                    kategori_out = normalize_category(result.get('kategori') or "Gündem", site_categories)
                    logging.info(f"Başarıyla Türkçe'ye çevrildi/yazıldı: {baslik[:50]}...")
                    news_item = {
                        "baslik": fix_encoding(baslik),
                        "kisa_baslik": fix_encoding(kisa_baslik),
                        "ozet": fix_encoding(ozet),
                        "icerik": fix_encoding(icerik_out),
                        "resim_url": final_img,
                        "kategori": kategori_out,
                        "kaynak": {
                            "isim": source_name,
                            "logo": source_logo,
                            "link": item['url']
                        },
                        "adult_only": False,
                        "tarih": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        "goruntulenme": 0,
                        "begeni_sayisi": 0
                    }
                    save_to_json(news_item)
                    
                    # Kotayı korumak için 60 saniye bekle (dakikada 1 haber)
                    logging.info("Kotayı korumak için 60 saniye bekleniyor...")
                    time.sleep(60)
                else:
                    logging.warning(f"Gemini haberi işleyemedi: {item['title'][:50]}")

        logging.info("Tüm siteler tarandı.")
        
        
    except Exception as e:
        logging.error(f"Kritik hata: {e}")
        time.sleep(60) # Hata sonrası biraz bekle

if __name__ == "__main__":
    main()
