import json
import os

def fix_encoding(text):
    if not isinstance(text, str): return text
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

file_path = r"c:\Users\musta\Desktop\TrHaber\data\haberler.json"

if os.path.exists(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    for item in data:
        item['baslik'] = fix_encoding(item.get('baslik', ''))
        item['kisa_baslik'] = fix_encoding(item.get('kisa_baslik', ''))
        item['ozet'] = fix_encoding(item.get('ozet', ''))
        item['icerik'] = fix_encoding(item.get('icerik', ''))
        
        # Also ensure logo AND NAME are updated for known sources
        link = item.get('kaynak', {}).get('link', '')
        if "nytimes.com" in link: 
            item['kaynak']['logo'] = "https://www.nytimes.com/favicon.ico"
            item['kaynak']['isim'] = "The New York Times"
        elif "theverge.com" in link: 
            item['kaynak']['logo'] = "https://www.theverge.com/favicon.ico"
            item['kaynak']['isim'] = "The Verge"
        elif "techcrunch.com" in link: 
            item['kaynak']['logo'] = "https://techcrunch.com/wp-content/uploads/2015/02/tc-logo-200x200.png"
            item['kaynak']['isim'] = "TechCrunch"
        elif "wired.com" in link: 
            item['kaynak']['logo'] = "https://www.wired.com/favicon.ico"
            item['kaynak']['isim'] = "Wired"
        elif "gizmodo.com" in link: 
            item['kaynak']['logo'] = "https://gizmodo.com/favicon.ico"
            item['kaynak']['isim'] = "Gizmodo"
        elif "arstechnica.com" in link: 
            item['kaynak']['logo'] = "https://arstechnica.com/favicon.ico"
            item['kaynak']['isim'] = "Ars Technica"
        elif "pcgamer.com" in link: 
            item['kaynak']['logo'] = "https://www.pcgamer.com/favicon.ico"
            item['kaynak']['isim'] = "PC Gamer"
        elif "gamespot.com" in link: 
            item['kaynak']['logo'] = "https://www.gamespot.com/favicon.ico"
            item['kaynak']['isim'] = "GameSpot"
        elif "cnet.com" in link: 
            item['kaynak']['logo'] = "https://www.cnet.com/favicon.ico"
            item['kaynak']['isim'] = "CNET"

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    print("Haberler.json başarıyla temizlendi, logolar ve isimler güncellendi.")
else:
    print("Haberler.json bulunamadı.")
