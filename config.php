<?php
/**
 * DokumaQC — Kalite Kontrol & Stok Takip Sistemi
 * Konfigürasyon ve Veritabanı Kurulumu
 */

date_default_timezone_set('Europe/Istanbul');

// ── Oturum Ayarları ──
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', 1);
    ini_set('session.cookie_samesite', 'Lax');
    // ini_set('session.cookie_secure', 1); // HTTPS varsa açılmalı
    session_start();
}

// CSRF Token oluşturma
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// ── Hata Raporlama ──
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/db/error.log');

// ── Sabitler ──
define('APP_NAME', 'DokumaQC');
define('APP_VERSION', '2.1.0 PRO');
define('APP_COMMIT', substr(exec('git rev-parse HEAD'), 0, 7));
define('DB_PATH', __DIR__ . '/db/dokuma_qc.db');
define('UPLOAD_PATH', __DIR__ . '/uploads/');
define('MAX_UPLOAD_SIZE', 5 * 1024 * 1024); // 5MB

// ── Veritabanı Bağlantısı ──
function getDB() {
    static $db = null;
    if ($db === null) {
        $dbDir = dirname(DB_PATH);
        if (!is_dir($dbDir)) {
            mkdir($dbDir, 0755, true);
        }
        $db = new SQLite3(DB_PATH);
        $db->busyTimeout(5000);
        $db->exec('PRAGMA journal_mode=WAL');
        $db->exec('PRAGMA foreign_keys=ON');
    }
    return $db;
}

// ── Tablo Oluşturma ──
function initializeDatabase() {
    $db = getDB();

    // Kullanıcılar
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'operator',
        permissions TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    )");

    // Migration for users: Add permissions column silently if missing
    @$db->exec("ALTER TABLE users ADD COLUMN permissions TEXT");
    @$db->exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'operator'");
    // Ensure role column exists and update existing users
    $db->exec("UPDATE users SET role = 'admin' WHERE role = '' OR role IS NULL");
    
    // Create superadmin user (root)
    $stmtCheck = $db->prepare("SELECT COUNT(*) FROM users WHERE username = 'root'");
    $checkRoot = $stmtCheck->execute()->fetchArray(SQLITE3_NUM)[0];
    if (!$checkRoot) {
        $rootHash = password_hash('Bozkurt5878', PASSWORD_DEFAULT);
        $stmtRoot = $db->prepare("INSERT INTO users (username, password_hash, full_name, role, is_active) 
                    VALUES ('root', :hash, 'Süper Admin', 'superadmin', 1)");
        $stmtRoot->bindValue(':hash', $rootHash);
        $stmtRoot->execute();
    }

    // Kumaş Tipleri
    $db->exec("CREATE TABLE IF NOT EXISTS fabric_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // Hata Tipleri
    $db->exec("CREATE TABLE IF NOT EXISTS defect_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        severity_default INTEGER DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // Ürünler (Stok)
    $db->exec("CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        fabric_type_id INTEGER,
        composition TEXT,
        density TEXT,
        unit TEXT NOT NULL DEFAULT 'metre',
        min_stock REAL DEFAULT 0,
        current_stock REAL DEFAULT 0,
        supplier TEXT,
        tech_details TEXT,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fabric_type_id) REFERENCES fabric_types(id)
    )");

    // Migration for older DB versions: Add tech_details and density silently if missing
    @$db->exec("ALTER TABLE products ADD COLUMN tech_details TEXT");
    @$db->exec("ALTER TABLE products ADD COLUMN density TEXT");
    @$db->exec("ALTER TABLE products ADD COLUMN image TEXT");
    @$db->exec("ALTER TABLE products ADD COLUMN weft_report TEXT");

    // Stok Hareketleri
    $db->exec("CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        quantity REAL NOT NULL,
        previous_stock REAL,
        new_stock REAL,
        document_no TEXT,
        description TEXT,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )");

    // Kalite Kontrol
    $db->exec("CREATE TABLE IF NOT EXISTS quality_controls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roll_no TEXT NOT NULL,
        party_no TEXT,
        fabric_type_id INTEGER,
        product_id INTEGER,
        length_m REAL,
        width_cm REAL,
        inspector TEXT,
        control_date DATE NOT NULL,
        total_defects INTEGER DEFAULT 0,
        quality_score REAL DEFAULT 100,
        decision TEXT NOT NULL DEFAULT '1. Kalite',
        notes TEXT,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (fabric_type_id) REFERENCES fabric_types(id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )");

    // Kalite Kontrol Hataları
    $db->exec("CREATE TABLE IF NOT EXISTS quality_defects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        control_id INTEGER NOT NULL,
        defect_type_id INTEGER NOT NULL,
        count INTEGER DEFAULT 1,
        severity INTEGER DEFAULT 1,
        position_m REAL,
        notes TEXT,
        FOREIGN KEY (control_id) REFERENCES quality_controls(id) ON DELETE CASCADE,
        FOREIGN KEY (defect_type_id) REFERENCES defect_types(id)
    )");

    // Ayarlar
    $db->exec("CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )");

    // Tezgahlar
    $db->exec("CREATE TABLE IF NOT EXISTS units (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)");

    // Program Alıcıları (Sistemi satın alan müşteriler)
    $db->exec("CREATE TABLE IF NOT EXISTS program_buyers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        internal_barcode_start TEXT,
        external_barcode_start TEXT,
        sale_date DATE DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    
    // YENİ: Sevkiyat Tablosu
    $db->exec("CREATE TABLE IF NOT EXISTS shipments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        order_id INTEGER,
        shipment_date DATE,
        shipping_address TEXT,
        plate_no TEXT,
        notes TEXT,
        status TEXT DEFAULT 'hazırlanıyor',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    
    $db->exec("CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        order_date DATE NOT NULL,
        deadline_date DATE,
        quantity_m REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'Açık',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    )");

    @$db->exec("ALTER TABLE shipments ADD COLUMN order_id INTEGER");
    @$db->exec("ALTER TABLE shipments ADD COLUMN is_billed INTEGER DEFAULT 0");

    $db->exec("CREATE TABLE IF NOT EXISTS looms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        product_id INTEGER,
        status TEXT DEFAULT 'çalışıyor',
        rpm INTEGER DEFAULT 0,
        current_meters REAL DEFAULT 0,
        yesterday_meters REAL DEFAULT 0,
        daily_meters REAL DEFAULT 0,
        warp_total REAL DEFAULT 0,
        warp_start_meter REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
    )");
    @$db->exec("ALTER TABLE looms ADD COLUMN is_active INTEGER DEFAULT 1");

    // Müşteriler
    $db->exec("CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // ── ÖN MUHASEBE TABLOLARI ──
    // Faturalar (Satış / Alış)
    $db->exec("CREATE TABLE IF NOT EXISTS acc_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL, -- 'satis' veya 'alis'
        customer_id INTEGER NOT NULL,
        invoice_no TEXT,
        invoice_date DATE NOT NULL,
        currency TEXT DEFAULT 'TL',
        exchange_rate REAL DEFAULT 1,
        subtotal REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    @$db->exec("ALTER TABLE acc_invoices ADD COLUMN currency TEXT DEFAULT 'TL'");
    @$db->exec("ALTER TABLE acc_invoices ADD COLUMN exchange_rate REAL DEFAULT 1");

    // Fatura Kalemleri
    $db->exec("CREATE TABLE IF NOT EXISTS acc_invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        entity_type TEXT, -- 'shipment' (çeki) veya 'depo_giris'
        entity_id INTEGER, -- shipment_id vb.
        product_id INTEGER,
        quantity REAL DEFAULT 0,
        unit_price REAL DEFAULT 0,
        total_price REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES acc_invoices(id) ON DELETE CASCADE
    )");

    // Cari Hareketler (Tahsilat, Ödeme, Fatura)
    $db->exec("CREATE TABLE IF NOT EXISTS acc_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        type TEXT NOT NULL, -- 'fatura_satis', 'fatura_alis', 'tahsilat', 'odeme'
        document_id INTEGER, -- invoice_id veya makbuz_id
        currency TEXT DEFAULT 'TL',
        exchange_rate REAL DEFAULT 1,
        amount REAL NOT NULL, 
        payment_method TEXT, -- 'Nakit', 'Banka', 'Çek', 'Kredi Kartı', 'Cari' vb.
        date DATE NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    @$db->exec("ALTER TABLE acc_transactions ADD COLUMN currency TEXT DEFAULT 'TL'");
    @$db->exec("ALTER TABLE acc_transactions ADD COLUMN exchange_rate REAL DEFAULT 1");

    @$db->exec("ALTER TABLE acc_transactions ADD COLUMN document_id INTEGER");
    @$db->exec("ALTER TABLE acc_transactions ADD COLUMN payment_method TEXT");

    // Migration for looms: Add warp and customer columns silently if missing
    @$db->exec("ALTER TABLE looms ADD COLUMN warp_total REAL DEFAULT 0");
    @$db->exec("ALTER TABLE looms ADD COLUMN warp_start_meter REAL DEFAULT 0");
    @$db->exec("ALTER TABLE looms ADD COLUMN reset_at DATETIME");
    @$db->exec("UPDATE looms SET reset_at = datetime('now') WHERE reset_at IS NULL");
    // Migration for quality_controls: Add new columns silently if missing
    @$db->exec("ALTER TABLE quality_controls ADD COLUMN loom_id INTEGER");
    @$db->exec("ALTER TABLE quality_controls ADD COLUMN weight_kg REAL DEFAULT 0");
    @$db->exec("ALTER TABLE quality_controls ADD COLUMN m2 REAL DEFAULT 0");
    @$db->exec("ALTER TABLE quality_controls ADD COLUMN barcode TEXT");
    @$db->exec("ALTER TABLE quality_controls ADD COLUMN lot_no TEXT");
    @$db->exec("ALTER TABLE quality_controls ADD COLUMN is_billed INTEGER DEFAULT 0");
    @$db->exec("ALTER TABLE quality_controls ADD COLUMN shipment_id INTEGER");
    @$db->exec("ALTER TABLE quality_controls ADD COLUMN is_external INTEGER DEFAULT 0");
    @$db->exec("ALTER TABLE looms ADD COLUMN lot_no TEXT");
    @$db->exec("ALTER TABLE looms ADD COLUMN type TEXT");
    @$db->exec("ALTER TABLE looms ADD COLUMN work_hours REAL DEFAULT 24");
    @$db->exec("ALTER TABLE looms ADD COLUMN frames INTEGER DEFAULT 0");
    @$db->exec("ALTER TABLE looms ADD COLUMN warp_yarn TEXT");
    @$db->exec("ALTER TABLE looms ADD COLUMN weft_yarn TEXT");
    @$db->exec("ALTER TABLE looms ADD COLUMN width REAL DEFAULT 0");
    @$db->exec("ALTER TABLE looms ADD COLUMN location TEXT DEFAULT 'Fabrika'");
    @$db->exec("ALTER TABLE looms ADD COLUMN warp_start_date DATE");
    @$db->exec("ALTER TABLE looms ADD COLUMN warp_spare_status TEXT");
    @$db->exec("ALTER TABLE looms ADD COLUMN warp_spare_notes TEXT");
    @$db->exec("ALTER TABLE looms ADD COLUMN qc_consumed_meters REAL DEFAULT 0");
    @$db->exec("ALTER TABLE looms ADD COLUMN customer_id INTEGER");
    @$db->exec("ALTER TABLE looms ADD COLUMN next_product_id INTEGER");
    @$db->exec("ALTER TABLE looms ADD COLUMN next_order_id INTEGER");
    @$db->exec("ALTER TABLE looms ADD COLUMN next_customer_id INTEGER");
    @$db->exec("ALTER TABLE looms ADD COLUMN next_lot_no TEXT");
    @$db->exec("ALTER TABLE looms ADD COLUMN next_job_notes TEXT");
    @$db->exec("ALTER TABLE stock_movements ADD COLUMN act_type TEXT DEFAULT 'manual'");

    // ── KARTELA (Kumaş Numune Kartı) TAKİP ──
    $db->exec("CREATE TABLE IF NOT EXISTS kartelas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kartela_no TEXT UNIQUE NOT NULL,
        product_id INTEGER,
        fabric_type_id INTEGER,
        customer_id INTEGER,
        composition TEXT,
        status TEXT NOT NULL DEFAULT 'fabrikada',
        location TEXT,
        sample_count INTEGER DEFAULT 1,
        send_date DATE,
        return_date DATE,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (fabric_type_id) REFERENCES fabric_types(id),
        FOREIGN KEY (customer_id) REFERENCES customers(id)
    )");

    @$db->exec("ALTER TABLE kartelas ADD COLUMN composition TEXT");

    // Kartela durum geçmişi (zaman çizelgesi)
    $db->exec("CREATE TABLE IF NOT EXISTS kartela_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kartela_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        notes TEXT,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (kartela_id) REFERENCES kartelas(id) ON DELETE CASCADE
    )");

    @$db->exec("CREATE INDEX IF NOT EXISTS idx_kartela_status ON kartelas(status)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_kartela_customer ON kartelas(customer_id)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_kartela_product ON kartelas(product_id)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_kartela_history_id ON kartela_history(kartela_id)");

    // ── İPLİK STOK (Giriş/Çıkış Takibi) ──
    $db->exec("CREATE TABLE IF NOT EXISTS yarns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        numara TEXT,
        numara_type TEXT DEFAULT 'nm',
        kat INTEGER DEFAULT 1,
        cins TEXT,
        unit TEXT DEFAULT 'kg',
        supplier TEXT,
        unit_price REAL DEFAULT 0,
        currency TEXT DEFAULT 'TL',
        min_stock REAL DEFAULT 0,
        notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

    // Migration: kat + numara_type sütunları (mevcut kurulumlar için)
    $cols = @$db->query("PRAGMA table_info(yarns)");
    $hasKat = false;
    $hasType = false;
    while ($col = @$cols->fetchArray(SQLITE3_ASSOC)) {
        if ($col['name'] === 'kat') $hasKat = true;
        if ($col['name'] === 'numara_type') $hasType = true;
    }
    if (!$hasKat) @$db->exec("ALTER TABLE yarns ADD COLUMN kat INTEGER DEFAULT 1");
    if (!$hasType) @$db->exec("ALTER TABLE yarns ADD COLUMN numara_type TEXT DEFAULT 'nm'");

    $db->exec("CREATE TABLE IF NOT EXISTS yarn_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        yarn_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        quantity REAL NOT NULL,
        bale_count INTEGER DEFAULT 0,
        supplier TEXT,
        invoice_no TEXT,
        unit_price REAL DEFAULT 0,
        currency TEXT DEFAULT 'TL',
        total_price REAL DEFAULT 0,
        loom_id INTEGER,
        destination TEXT,
        purpose TEXT,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (yarn_id) REFERENCES yarns(id),
        FOREIGN KEY (loom_id) REFERENCES looms(id)
    )");

    // Migration: destination sütunu (mevcut kurulumlar için)
    $cols2 = @$db->query("PRAGMA table_info(yarn_movements)");
    $hasDest = false;
    while ($col = @$cols2->fetchArray(SQLITE3_ASSOC)) { if ($col['name'] === 'destination') $hasDest = true; }
    if (!$hasDest) @$db->exec("ALTER TABLE yarn_movements ADD COLUMN destination TEXT");

    @$db->exec("CREATE INDEX IF NOT EXISTS idx_yarn_movements_yarn ON yarn_movements(yarn_id)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_yarn_movements_type ON yarn_movements(type)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_yarn_movements_date ON yarn_movements(date)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_yarn_movements_loom ON yarn_movements(loom_id)");

    // Günlük Randıman Girişleri
    $db->exec("CREATE TABLE IF NOT EXISTS loom_daily_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loom_id INTEGER NOT NULL,
        date DATE NOT NULL,
        meters REAL DEFAULT 0,
        hours REAL DEFAULT 0,
        efficiency REAL DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (loom_id) REFERENCES looms(id)
    )");

    // ── Varsayılan Veriler ──
    // Admin kullanıcı oluşturma kaldırıldı - kullanıcılar manuel olarak eklenecek

    // Varsayılan kumaş tipleri
    $stmt = $db->prepare("SELECT COUNT(*) as cnt FROM fabric_types");
    $result = $stmt->execute()->fetchArray();
    if ($result['cnt'] == 0) {
        $types = ['Dokuma Kumaş', 'Örme Kumaş', 'Jakar', 'Saten', 'Polyester', 'Pamuklu', 'Karışım', 'Kadife', 'Gabardin', 'Poplin'];
        foreach ($types as $type) {
            $stmtInsert = $db->prepare("INSERT INTO fabric_types (name) VALUES (:name)");
            $stmtInsert->bindValue(':name', $type);
            $stmtInsert->execute();
        }
    }

    // Varsayılan hata tipleri
    $stmt = $db->prepare("SELECT COUNT(*) as cnt FROM defect_types");
    $result = $stmt->execute()->fetchArray();
    if ($result['cnt'] == 0) {
        $defects = [
            ['Atkı Hatası', 'ATK', 2],
            ['Çözgü Hatası', 'CZG', 2],
            ['Örgü Hatası', 'ORG', 2],
            ['Leke', 'LEK', 1],
            ['Delik', 'DLK', 3],
            ['Kenar Hatası', 'KNR', 1],
            ['İplik Kopuğu', 'IPK', 2],
            ['Desen Hatası', 'DSN', 3],
            ['Renk Farkı', 'RNK', 2],
            ['Boncuklanma', 'BNC', 1],
            ['Çekmezlik Hatası', 'CKM', 2],
            ['Yabancı Elyaf', 'YBN', 1]
        ];
        foreach ($defects as $d) {
            $stmtInsert = $db->prepare("INSERT INTO defect_types (name, code, severity_default) VALUES (:n, :c, :s)");
            $stmtInsert->bindValue(':n', $d[0]);
            $stmtInsert->bindValue(':c', $d[1]);
            $stmtInsert->bindValue(':s', $d[2]);
            $stmtInsert->execute();
        }
    }

    // UNIQUE index for roll_no to prevent duplicates
    @$db->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_roll_no_unique ON quality_controls(roll_no)");

    // Varsayılan ayarlar
    $stmt = $db->prepare("SELECT COUNT(*) as cnt FROM settings");
    $result = $stmt->execute()->fetchArray();
    if ($result['cnt'] == 0) {
        $defaults = [
            ['company_name', 'Firma Adı'], ['company_phone', ''], ['company_address', ''],
            ['quality_threshold_1', '85'], ['quality_threshold_2', '70'], ['barcode_width', '100'],
            ['barcode_height', '100'], ['theme', 'dark'], ['internal_barcode_start', '250000000'],
            ['internal_barcode_last', '250000000'], ['external_barcode_start', '255000000'],
            ['external_barcode_last', '255000000'], ['license_end_date', ''], ['license_start_date', ''],
            ['license_warning_days', '7'], ['last_online_time', ''],
            ['warp_low_threshold', '2000']
        ];
        foreach ($defaults as $d) {
            $stmtInsert = $db->prepare("INSERT INTO settings (key, value) VALUES (:k, :v)");
            $stmtInsert->bindValue(':k', $d[0]);
            $stmtInsert->bindValue(':v', $d[1]);
            $stmtInsert->execute();
        }
    }

    // Varsayılan çözgü uyarı eşiği (mevcut kurulumlar için)
    @$db->exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('warp_low_threshold', '2000')");

    // Kartela barkod serisi (mevcut kurulumlar için)
    @$db->exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('kartela_barcode_prefix', 'K')");
    @$db->exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('kartela_barcode_last', '0')");

    // İplik kod serisi (mevcut kurulumlar için)
    @$db->exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('yarn_code_last', '0')");

    // ── Indexler (Performans İçin) ──
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_qc_loom_id ON quality_controls(loom_id)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_qc_product_id ON quality_controls(product_id)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_qc_customer_id ON quality_controls(customer_id)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_qc_control_date ON quality_controls(control_date)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_stock_product_id ON stock_movements(product_id)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_daily_loom_id ON loom_daily_entries(loom_id)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_daily_date ON loom_daily_entries(date)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_trans_customer_id ON acc_transactions(customer_id)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_trans_date ON acc_transactions(date)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id)");
    @$db->exec("CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id)");
}

// ── Yardımcı Fonksiyonlar ──
function isLoggedIn() {
    return isset($_SESSION['user_id']);
}

// Lisans kontrolü
function checkLicense() {
    try {
        $db = getDB();
        
        // Lisans bitiş tarihini al
        $stmt = $db->prepare("SELECT value FROM settings WHERE key = 'license_end_date'");
        $res = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
        $endDate = $res['value'] ?? '';
        
        if (empty($endDate)) {
            return ['valid' => false, 'days_left' => 0, 'error' => 'Lisans bitiş tarihi belirlenmemiş'];
        }
        
        // İnternetten gerçek tarihi almaya çalış
        $onlineTime = null;
        if (function_exists('curl_init')) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, "http://worldtimeapi.org/api/timezone/Europe/Istanbul");
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $response = curl_exec($ch);
            if ($response) {
                $data = json_decode($response, true);
                if (isset($data['datetime'])) {
                    $onlineTime = substr($data['datetime'], 0, 10); // YYYY-MM-DD
                }
            }
        }
        
        // İnternet yoksa Google time API dene
        if (!$onlineTime && function_exists('curl_init')) {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, "https://timeapi.io/api/Time/current/zone?timeZone=Europe/Istanbul");
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $response = curl_exec($ch);
            if ($response) {
                $data = json_decode($response, true);
                if (isset($data['dateTime'])) {
                    $onlineTime = substr($data['dateTime'], 0, 10);
                }
            }
        }
    
    // Tarih belirleme (öncelik: internet > bilgisayar > son bilinen)
    if ($onlineTime) {
        $currentDate = $onlineTime;
        // Son online tarihi kaydet (güvenlik için)
        $stmtU = $db->prepare("UPDATE settings SET value = :v WHERE key = 'last_online_time'");
        $stmtU->bindValue(':v', $currentDate);
        $stmtU->execute();
    } else {
        // İnternet yok, bilgisayar tarihini kullan
        $currentDate = date('Y-m-d');
        
        // Son online tarihten küçükse şüpheli (tarih geri alınmış)
        $stmt = $db->prepare("SELECT value FROM settings WHERE key = 'last_online_time'");
        $res = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
        $lastOnline = $res['value'] ?? '';
        
        if ($lastOnline && $currentDate < $lastOnline) {
            // Tarih manipülasyonu tespit edildi!
            return ['valid' => false, 'days_left' => -999, 'error' => 'Tarih manipülasyonu tespit edildi'];
        }
    }
    
    // Gün farkını hesapla
    $end = new DateTime($endDate);
    $now = new DateTime($currentDate);
    $interval = $now->diff($end);
    $daysLeft = $interval->days;
    
    // Negatif kontrolü: eğer bitiş tarihi geçmişse
    if ($now > $end) {
        $daysLeft = -$daysLeft;
    }
    
    $warningDays = 7; // Varsayılan
    $stmt = $db->prepare("SELECT value FROM settings WHERE key = 'license_warning_days'");
    $res = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
    if ($res && is_numeric($res['value'])) {
        $warningDays = intval($res['value']);
    }
    
    $license = [
        'valid' => $daysLeft > 0,
        'days_left' => $daysLeft,
        'end_date' => $endDate,
        'current_date' => $currentDate
    ];
    
    if ($daysLeft <= $warningDays && $daysLeft > 0) {
        $license['warning'] = true;
        $license['message'] = "Lisansınızın süresi $daysLeft gün sonra dolacak!";
    } elseif ($daysLeft <= 0) {
        $license['warning'] = false;
        $license['message'] = 'Lisans süresi doldu!';
    }
    
        return $license;
    } catch (Throwable $e) {
        // Hata durumunda varsayılan olarak lisans geçerli say (giriş engellenmesin)
        return [
            'valid' => true,
            'days_left' => 999,
            'warning' => false,
            'error' => 'Lisans kontrolü yapılamadı: ' . $e->getMessage()
        ];
    }
}

function requireLogin() {
    if (!isLoggedIn()) {
        http_response_code(401);
        echo json_encode(['error' => 'Oturum açmanız gerekiyor']);
        exit;
    }
    
    // CSRF Kontrolü (POST, PUT, DELETE gibi işlemlerde)
    $method = $_SERVER['REQUEST_METHOD'];
    if (in_array($method, ['POST', 'PUT', 'DELETE'])) {
        $clientToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (empty($clientToken) || $clientToken !== ($_SESSION['csrf_token'] ?? '')) {
            http_response_code(403);
            echo json_encode(['error' => 'CSRF Doğrulama Hatası (Güvenlik İhlali)']);
            exit;
        }
    }
}

function currentUser() {
    if (!isLoggedIn()) return null;
    $db = getDB();
    $stmt = $db->prepare("SELECT id, username, full_name, role, permissions FROM users WHERE id = :id");
    $stmt->bindValue(':id', $_SESSION['user_id'], SQLITE3_INTEGER);
    return $stmt->execute()->fetchArray(SQLITE3_ASSOC);
}

function jsonResponse($data, $code = 200) {
    if (ob_get_length()) ob_clean(); 
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getSetting($key, $default = '') {
    $db = getDB();
    $stmt = $db->prepare("SELECT value FROM settings WHERE key = :k");
    $stmt->bindValue(':k', $key, SQLITE3_TEXT);
    $res = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
    return ($res && !empty($res['value'])) ? $res['value'] : $default;
}

function sanitize($str) {
    return htmlspecialchars(trim($str ?? ''), ENT_QUOTES, 'UTF-8');
}

// ── Veritabanını Başlat ──
initializeDatabase();
