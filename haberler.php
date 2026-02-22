<?php
header('Content-Type: application/json; charset=utf-8');

// Basit güvenlik: API anahtarı kontrolü
$api_key = "a8f9c2d7e6b1"; // örn: a8f9c2d7e6b1
$gelen_key = isset($_GET['key']) ? $_GET['key'] : '';

if ($gelen_key !== $api_key) {
    http_response_code(403);
    echo json_encode(["error" => "Yetkisiz erişim!"]);
    exit;
}

// İşlem türünü belirle: haberler, yorumlar, yorum_yap
$turu = isset($_GET['turu']) ? $_GET['turu'] : 'haberler';

if ($turu == 'haberler') {
    // Haberler.json dosyasını oku
    $json_path = __DIR__ . "/data/haberler.json";
    if (!file_exists($json_path)) {
        http_response_code(500);
        echo json_encode(["error" => "haberler.json bulunamadı"]);
        exit;
    }

    $haberler = json_decode(file_get_contents($json_path), true);
    
    // Haber numarası parametresi
    $haber_id = isset($_GET['haber']) ? (int)$_GET['haber'] : 0;
    // Limit parametresi
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 0;
    // Kategori parametresi
    $kategori = isset($_GET['kategori']) ? $_GET['kategori'] : '';

    if ($haber_id > 0) {
        $bulunan_haber = null;
        foreach ($haberler as $h) {
            if (isset($h['id']) && $h['id'] == $haber_id) {
                $bulunan_haber = $h;
                break;
            }
        }
        
        if ($bulunan_haber) {
             echo json_encode($bulunan_haber, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        } else {
             if (isset($haberler[$haber_id - 1])) {
                echo json_encode($haberler[$haber_id - 1], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
             } else {
                http_response_code(404);
                echo json_encode(["error" => "Haber bulunamadı"]);
             }
        }
    } else {
        // Filtreleme işlemleri
        $filtrelenmis_haberler = $haberler;

        // Kategori varsa filtrele
        if (!empty($kategori)) {
            $filtrelenmis_haberler = array_filter($filtrelenmis_haberler, function($h) use ($kategori) {
                // Kategori eşleşmesi (küçük/büyük harf duyarsız yapalım)
                return isset($h['kategori']) && mb_strtolower($h['kategori']) == mb_strtolower($kategori);
            });
            // array_filter key'leri korur, JSON için indexleri resetleyelim
            $filtrelenmis_haberler = array_values($filtrelenmis_haberler);
        }

        // Limit varsa uygula
        if ($limit > 0) {
            $filtrelenmis_haberler = array_slice($filtrelenmis_haberler, 0, $limit);
        }
        // Tüm haberleri (veya filtrelenmiş/limitli) listele
        echo json_encode($filtrelenmis_haberler, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }

} elseif ($turu == 'yorumlar') {
    // Yorumları getir
    $haber_id = isset($_GET['haber_id']) ? (double)$_GET['haber_id'] : 0;
    
    if ($haber_id == 0) {
        http_response_code(400);
        echo json_encode(["error" => "haber_id parametresi gereklidir"]);
        exit;
    }

    $json_path = __DIR__ . "/data/yorumlar.json";
    if (!file_exists($json_path)) {
        // Dosya yoksa boş dizi dön
        echo json_encode([], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $yorumlar = json_decode(file_get_contents($json_path), true);
    if (!is_array($yorumlar)) $yorumlar = [];

    $ilgili_yorumlar = [];
    foreach ($yorumlar as $yorum) {
        // Double karşılaştırması hassas olabilir ama JSON'dan gelen sayısal değerler için genelde çalışır
        if (isset($yorum['haber_id']) && (double)$yorum['haber_id'] == $haber_id) {
            $ilgili_yorumlar[] = $yorum;
        }
    }

    echo json_encode($ilgili_yorumlar, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} elseif ($turu == 'yorum_yap') {
    // Yorum yapma işlemi (POST)
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(["error" => "Sadece POST isteği kabul edilir"]);
        exit;
    }

    // POST verisini al
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Eğer form-data olarak geliyorsa $_POST kullan
    if (!$input) {
        $input = $_POST;
    }

    $haber_id = isset($input['haber_id']) ? (double)$input['haber_id'] : 0;
    $kullanici_adi = isset($input['kullanici_adi']) ? trim($input['kullanici_adi']) : '';
    $icerik = isset($input['icerik']) ? trim($input['icerik']) : '';
    $parent_id = isset($input['parent_id']) ? $input['parent_id'] : null;

    if ($haber_id == 0 || empty($kullanici_adi) || empty($icerik)) {
        http_response_code(400);
        echo json_encode(["error" => "Eksik parametreler: haber_id, kullanici_adi ve icerik zorunludur."]);
        exit;
    }

    $json_path = __DIR__ . "/data/yorumlar.json";
    $yorumlar = [];
    if (file_exists($json_path)) {
        $yorumlar = json_decode(file_get_contents($json_path), true);
        if (!is_array($yorumlar)) $yorumlar = [];
    }

    // Yeni yorumu oluştur
    // ID için timestamp kullanıyoruz (JS'deki Date.now() benzeri)
    $now = microtime(true);
    $id = floor($now * 1000); 

    $yeni_yorum = [
        "id" => $id,
        "haber_id" => $haber_id,
        "kullanici_adi" => htmlspecialchars($kullanici_adi), // XSS koruması
        "icerik" => htmlspecialchars($icerik),
        "tarih" => gmdate("Y-m-d\TH:i:s.") . sprintf("%03d", ($now - floor($now)) * 1000) . "Z",
        "parent_id" => $parent_id
    ];

    $yorumlar[] = $yeni_yorum;

    // Dosyaya yaz
    if (file_put_contents($json_path, json_encode($yorumlar, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_NUMERIC_CHECK))) {
        echo json_encode(["success" => true, "message" => "Yorum eklendi", "data" => $yeni_yorum]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Yorum kaydedilemedi"]);
    }

} else {
    http_response_code(400);
    echo json_encode(["error" => "Geçersiz işlem türü"]);
}
