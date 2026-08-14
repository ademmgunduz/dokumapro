<?php
ob_start(); // Çıktı tamponlamayı başlat (gizli boşlukları ve hataları yakalamak için)
/**
 * DokumaQC — API Endpoint'leri
 * Tüm CRUD operasyonları
 */
error_reporting(E_ALL);
ini_set('display_errors', 0); // Hataları ekrana basma (JSON'ı bozmaması için)

require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

// Barkod üretme yardımcı fonksiyonu
function generateBarcode($type = 'internal') {
    $db = getDB();
    $key_last = $type === 'internal' ? 'internal_barcode_last' : 'external_barcode_last';
    $col_start = $type === 'internal' ? 'internal_barcode_start' : 'external_barcode_start';
    
    $maxRetries = 5;
    for ($i = 0; $i < $maxRetries; $i++) {
        $db->exec('BEGIN TRANSACTION');
        try {
            // Get current last from settings
            $stmt = $db->prepare("SELECT value FROM settings WHERE key = :k");
            $stmt->bindValue(':k', $key_last);
            $res = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
            $last = intval($res['value'] ?? 0);
            
            // Get start number from program_buyers (use the first one found)
            $startNo = $db->querySingle("SELECT $col_start FROM program_buyers ORDER BY id ASC LIMIT 1");
            $startNo = intval($startNo ?? 0);
            
            // New value should be at least startNo, or last + 1
            $new = max($last + 1, $startNo);
            
            // Update settings
            $stmt = $db->prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (:k, :v)");
            $stmt->bindValue(':v', $new, SQLITE3_INTEGER);
            $stmt->bindValue(':k', $key_last);
            $stmt->execute();
            
            $db->exec('COMMIT');
            return (string)$new;
        } catch (Exception $e) {
            $db->exec('ROLLBACK');
            if ($i === $maxRetries - 1) throw $e;
        }
    }
    return null;
}

// Kartela barkod üretme (örn. K0001, K0002...)
function generateKartelaBarcode() {
    $db = getDB();
    $prefix = $db->querySingle("SELECT value FROM settings WHERE key = 'kartela_barcode_prefix'") ?: 'K';

    $maxRetries = 5;
    for ($i = 0; $i < $maxRetries; $i++) {
        $db->exec('BEGIN TRANSACTION');
        try {
            $last = intval($db->querySingle("SELECT value FROM settings WHERE key = 'kartela_barcode_last'") ?: 0);
            $new = $last + 1;
            $stmt = $db->prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('kartela_barcode_last', :v)");
            $stmt->bindValue(':v', $new, SQLITE3_INTEGER);
            $stmt->execute();
            $db->exec('COMMIT');
            return $prefix . sprintf('%04d', $new);
        } catch (Exception $e) {
            $db->exec('ROLLBACK');
            if ($i === $maxRetries - 1) throw $e;
        }
    }
    return null;
}

// İplik kod üretme (örn. IPK-0001, IPK-0002...)
function generateYarnCode() {
    $db = getDB();

    $maxRetries = 5;
    for ($i = 0; $i < $maxRetries; $i++) {
        $db->exec('BEGIN TRANSACTION');
        try {
            $last = intval($db->querySingle("SELECT value FROM settings WHERE key = 'yarn_code_last'") ?: 0);
            $new = $last + 1;
            // Silinmiş (is_active=0) olsa bile kod UNIQUE kaldığı için kullanılan kodları atla
            $exists = true;
            $guard = 0;
            while ($exists && $guard < 10000) {
                $code = 'IPK-' . sprintf('%04d', $new);
                $st = $db->prepare("SELECT COUNT(*) FROM yarns WHERE code = :c");
                $st->bindValue(':c', $code);
                $exists = intval($st->execute()->fetchArray(SQLITE3_NUM)[0]) > 0;
                if ($exists) $new++;
                $guard++;
            }
            $stmt = $db->prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('yarn_code_last', :v)");
            $stmt->bindValue(':v', $new, SQLITE3_INTEGER);
            $stmt->execute();
            $db->exec('COMMIT');
            return 'IPK-' . sprintf('%04d', $new);
        } catch (Exception $e) {
            $db->exec('ROLLBACK');
            if ($i === $maxRetries - 1) throw $e;
        }
    }
    return null;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// JSON Input handling - Frontend sends JSON, PHP needs to decode it to $_POST
if ($method === 'POST') {
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        $inputData = json_decode($rawInput, true);
        if (is_array($inputData)) {
            $_POST = array_merge($_POST, $inputData);
        }
    }
}

// Release session lock early for read-only requests to prevent blocking
if ($method === 'GET') {
    session_write_close();
}


switch ($action) {

    // ═══════════════════════════════════════
    //  AUTH
    // ═══════════════════════════════════════
    case 'system_reset':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        if ($_SESSION['user_role'] !== 'admin' && $_SESSION['user_role'] !== 'superadmin') jsonResponse(['error' => 'Yetki yok'], 403);
        
        $db = getDB();
        try {
        $tables = [
            'quality_defects',     // quality_controls'e bağlı
            'quality_controls',   // looms, products, customers'a bağlı
            'stock_movements',     // products'a bağlı
            'loom_daily_entries',  // looms'a bağlı
            'looms',              // products, customers'a bağlı
            'shipments',          // customers, orders'a bağlı
            'orders',             // customers, products'a bağlı
            'products',           // ana tablo
            'customers',          // ana tablo
            'fabric_types',       // ana tablo
            'defect_types',       // ana tablo
            'units'               // ana tablo
        ];
            foreach ($tables as $t) {
                @$db->exec("DELETE FROM $t");
                @$db->exec("DELETE FROM sqlite_sequence WHERE name='$t'");
            }
            jsonResponse(['success' => true]);
        } catch (Exception $e) {
            jsonResponse(['error' => $e->getMessage()], 500);
        }
        break;

    case 'login':
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $input = json_decode(file_get_contents('php://input'), true);
        $username = sanitize($input['username'] ?? $_POST['username'] ?? '');
        $password = $input['password'] ?? $_POST['password'] ?? '';
        if (!$username || !$password) jsonResponse(['error' => 'Kullanıcı adı ve şifre gerekli'], 400);

        $db = getDB();
        $stmt = $db->prepare("SELECT * FROM users WHERE username = :u AND is_active = 1");
        $stmt->bindValue(':u', $username, SQLITE3_TEXT);
        $user = $stmt->execute()->fetchArray(SQLITE3_ASSOC);

        if (!$user || !password_verify($password, $user['password_hash'])) {
            jsonResponse(['error' => 'Geçersiz kullanıcı adı veya şifre'], 401);
        }

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_role'] = $user['role'];
        $stmtLL = $db->prepare("UPDATE users SET last_login = :now WHERE id = :id");
        $stmtLL->bindValue(':now', date('Y-m-d H:i:s'));
        $stmtLL->bindValue(':id', $user['id'], SQLITE3_INTEGER);
        $stmtLL->execute();

        jsonResponse(['success' => true, 'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'full_name' => $user['full_name'],
            'role' => $user['role'],
            'permissions' => $user['permissions']
        ], 'csrf_token' => $_SESSION['csrf_token']]);
        break;

    case 'logout':
        $_SESSION = array();
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params["path"], $params["domain"],
                $params["secure"], $params["httponly"]
            );
        }
        session_destroy();
        jsonResponse(['success' => true]);
        break;

    case 'check_session':
        if (isLoggedIn()) {
            $user = currentUser();
            jsonResponse(['logged_in' => true, 'user' => $user, 'csrf_token' => $_SESSION['csrf_token']]);
        } else {
            jsonResponse(['logged_in' => false]);
        }
        break;

    // ═══════════════════════════════════════
    //  DASHBOARD
    // ═══════════════════════════════════════
    case 'dashboard_stats':
        requireLogin();
        $db = getDB();

        // Toplam stok
        $totalStock = $db->querySingle("SELECT COALESCE(SUM(qc.length_m), 0) FROM quality_controls qc JOIN products p ON qc.product_id = p.id WHERE p.is_active = 1 AND qc.shipment_id IS NULL");

        // Bugünkü kontroller
        $todayStr = date('Y-m-d');
        $todayControls = $db->querySingle("SELECT COUNT(*) FROM quality_controls WHERE DATE(control_date) = '$todayStr'");

        // Ortalama kalite
        $monthAgo = date('Y-m-d', strtotime('-30 days'));
        $avgQuality = $db->querySingle("SELECT COALESCE(AVG(quality_score), 0) FROM quality_controls WHERE control_date >= '$monthAgo'");

        // Düşük stok uyarısı kaldırıldı (Kullanıcı talebi)
        $lowStock = 0;

        // Toplam ürün
        $totalProducts = $db->querySingle("SELECT COUNT(*) FROM products WHERE is_active = 1");

        // Bu ay kontrol
        $monthControls = $db->querySingle("SELECT COUNT(*) FROM quality_controls WHERE strftime('%Y-%m', control_date) = strftime('%Y-%m', 'now')");

        // --- BOSS MODE ADDITIONS ---
        
        // Aktif Tezgahlar & Toplam
        $totalLooms = $db->querySingle("SELECT COUNT(*) FROM looms WHERE is_active = 1");
        $activeLooms = $db->querySingle("SELECT COUNT(*) FROM looms WHERE status = 'çalışıyor' AND is_active = 1");
        
        // Finansal Özet (Alacak/Borç dengesi - Basitleştirilmiş)
        $totalReceivable = $db->querySingle("SELECT SUM(amount * exchange_rate) FROM acc_transactions WHERE type IN ('fatura_satis', 'odeme')");
        $totalPayable = $db->querySingle("SELECT SUM(amount * exchange_rate) FROM acc_transactions WHERE type IN ('fatura_alis', 'tahsilat')");
        $netBalance = ($totalReceivable ?? 0) - ($totalPayable ?? 0);

        // En Çok Sipariş Veren Müşteri
        $topCustomerVal = $db->querySingle("SELECT c.name FROM orders o JOIN customers c ON o.customer_id = c.id GROUP BY c.id ORDER BY COUNT(o.id) DESC LIMIT 1");
        $topCustomer = ($topCustomerVal !== false && $topCustomerVal !== null) ? $topCustomerVal : 'Veri Yok';

        // En Verimli Tezgah (Son 7 gün)
        $weekAgo = date('Y-m-d', strtotime('-7 days'));
        $topLoomVal = $db->querySingle("SELECT l.name FROM loom_daily_entries de JOIN looms l ON de.loom_id = l.id WHERE de.created_at >= '$weekAgo' GROUP BY l.id ORDER BY AVG(de.efficiency) DESC LIMIT 1");
        $topLoom = ($topLoomVal !== false && $topLoomVal !== null) ? $topLoomVal : 'Veri Yok';

        // Geciken Siparişler
        $todayStr = date('Y-m-d');
        $delayedOrdersVal = $db->querySingle("SELECT COUNT(*) FROM orders WHERE status = 'Açık' AND deadline_date < '$todayStr'");
        $delayedOrders = ($delayedOrdersVal !== false && $delayedOrdersVal !== null) ? intval($delayedOrdersVal) : 0;

        // Düşük çözgülü tezgahlar (Dashboard banner için)
        $warpLowThreshold = floatval($db->querySingle("SELECT value FROM settings WHERE key = 'warp_low_threshold'") ?: 2000);
        $warpDeduction = $db->querySingle("SELECT value FROM settings WHERE key = 'warp_deduction'");
        $loomWarpRes = $db->query("SELECT id, name, warp_total, warp_start_meter, current_meters, qc_consumed_meters FROM looms WHERE is_active = 1 AND warp_total > 0");
        $lowWarpLooms = 0;
        $lowWarpLoomNames = [];
        while ($lw = $loomWarpRes->fetchArray(SQLITE3_ASSOC)) {
            $consumed = ($warpDeduction === 'qc')
                ? floatval($lw['qc_consumed_meters'] ?? 0)
                : (floatval($lw['current_meters'] ?? 0) - floatval($lw['warp_start_meter'] ?? 0));
            $remaining = floatval($lw['warp_total']) - $consumed;
            if ($remaining > 0 && $remaining <= $warpLowThreshold) {
                $lowWarpLooms++;
                $lowWarpLoomNames[] = $lw['name'];
            }
        }

        // --- END BOSS MODE ---

        // Aktif Tezgahlar
        $activeLooms = $db->querySingle("SELECT COUNT(*) FROM looms WHERE status = 'çalışıyor' AND is_active = 1");

        // Açık Siparişler
        $openOrders = $db->querySingle("SELECT COUNT(*) FROM orders WHERE status = 'Açık'");

        // Bekleyen Sevkiyatlar
        $pendingShipments = $db->querySingle("SELECT COUNT(*) FROM shipments WHERE status = 'hazırlanıyor'");

        // Son Stok Hareketleri
        $stmtSM = $db->prepare("SELECT sm.*, p.name as product_name, p.code as product_code
            FROM stock_movements sm
            JOIN products p ON sm.product_id = p.id
            ORDER BY sm.created_at DESC LIMIT 5");
        $resSM = $stmtSM->execute();
        $recentStockMoves = [];
        while($r = $resSM->fetchArray(SQLITE3_ASSOC)) $recentStockMoves[] = $r;

        // Son kontroller
        $stmt = $db->prepare("SELECT qc.*, ft.name as fabric_type_name
            FROM quality_controls qc
            LEFT JOIN fabric_types ft ON qc.fabric_type_id = ft.id
            ORDER BY qc.created_at DESC LIMIT 10");
        $result = $stmt->execute();
        $recentControls = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $recentControls[] = $row;
        }

        // Düşük stok ürünler kaldırıldı (Kullanıcı talebi)
        $lowStockProducts = [];

        // Kalite trendi (son 30 gün)
        $monthAgo = date('Y-m-d', strtotime('-30 days'));
        $stmt = $db->prepare("SELECT DATE(control_date) as date, AVG(quality_score) as avg_score, COUNT(*) as count
            FROM quality_controls
            WHERE control_date >= :monthAgo
            GROUP BY DATE(control_date)
            ORDER BY date ASC");
        $stmt->bindValue(':monthAgo', $monthAgo);
        $result = $stmt->execute();
        $qualityTrend = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $qualityTrend[] = $row;
        }

        // Hata dağılımı
        $stmt = $db->prepare("SELECT dt.name, SUM(qd.count) as total
            FROM quality_defects qd
            JOIN defect_types dt ON qd.defect_type_id = dt.id
            JOIN quality_controls qc ON qd.control_id = qc.id
            WHERE qc.control_date >= :monthAgo
            GROUP BY dt.name
            ORDER BY total DESC LIMIT 8");
        $stmt->bindValue(':monthAgo', $monthAgo);
        $result = $stmt->execute();
        $defectDist = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $defectDist[] = $row;
        }

        // Aktif Siparişler Listesi (En yakın terminli 5 tanesi)
        $sqlOrders = "SELECT o.*, c.name as customer_name, p.name as product_name, p.code as product_code,
                (SELECT COALESCE(SUM(length_m), 0) FROM quality_controls qc JOIN shipments s ON qc.shipment_id = s.id WHERE s.order_id = o.id) as shipped_m,
                (SELECT COALESCE(SUM(length_m), 0) FROM quality_controls qc WHERE qc.order_id = o.id AND qc.shipment_id IS NULL) as ready_m
                FROM orders o
                LEFT JOIN customers c ON o.customer_id = c.id
                LEFT JOIN products p ON o.product_id = p.id
                WHERE o.status IN ('Açık', 'Üretimde')
                ORDER BY o.deadline_date ASC, o.id DESC LIMIT 5";
        $stmtOrders = $db->prepare($sqlOrders);
        $resOrders = $stmtOrders->execute();
        $dashboardOrders = [];
        while ($row = $resOrders->fetchArray(SQLITE3_ASSOC)) {
            $dashboardOrders[] = $row;
        }

        jsonResponse([
            'total_stock' => round($totalStock, 1),
            'today_controls' => $todayControls,
            'avg_quality' => round($avgQuality, 1),
            'low_stock_count' => $lowStock,
            'total_products' => $totalProducts,
            'month_controls' => $monthControls,
            'active_looms' => $activeLooms,
            'total_looms' => $totalLooms,
            'net_balance' => round($netBalance, 2),
            'top_customer' => $topCustomer,
            'top_loom' => $topLoom,
            'delayed_orders' => $delayedOrders,
            'low_warp_looms' => $lowWarpLooms,
            'low_warp_looms_list' => $lowWarpLoomNames,
            'open_orders' => $openOrders,
            'pending_shipments' => $pendingShipments,
            'recent_controls' => $recentControls,
            'recent_stock_moves' => $recentStockMoves,
            'low_stock_products' => $lowStockProducts,
            'quality_trend' => $qualityTrend,
            'defect_distribution' => $defectDist,
            'dashboard_orders' => $dashboardOrders
        ]);
        break;

    // ═══════════════════════════════════════
    //  KALİTE KONTROL
    // ═══════════════════════════════════════
    case 'quality_controls':
        requireLogin();
        $db = getDB();

        if ($method === 'GET') {
            $page = max(1, intval($_GET['page'] ?? 1));
            $limit = max(1, min(100, intval($_GET['limit'] ?? 20)));
            $offset = ($page - 1) * $limit;

            $where = "1=1";
            $params = [];

            if (!empty($_GET['search'])) {
                $where .= " AND (qc.id = :search_exact OR qc.roll_no LIKE :search OR qc.party_no LIKE :search OR qc.lot_no LIKE :search OR p.name LIKE :search OR p.code LIKE :search OR l.name LIKE :search OR qc.notes LIKE :search)";
                $params[':search'] = '%' . $_GET['search'] . '%';
                $params[':search_exact'] = $_GET['search'];
            }
            if (!empty($_GET['decision'])) {
                $where .= " AND qc.decision = :decision";
                $params[':decision'] = $_GET['decision'];
            }
            if (!empty($_GET['product_id'])) {
                $where .= " AND qc.product_id = :pid";
                $params[':pid'] = $_GET['product_id'];
            }
            if (!empty($_GET['loom_id'])) {
                $where .= " AND qc.loom_id = :lid";
                $params[':lid'] = $_GET['loom_id'];
            }
            if (!empty($_GET['date_from'])) {
                $where .= " AND qc.control_date >= :dfrom";
                $params[':dfrom'] = $_GET['date_from'];
            }
            if (!empty($_GET['date_to'])) {
                $where .= " AND qc.control_date <= :dto";
                $params[':dto'] = $_GET['date_to'];
            }
            if (isset($_GET['in_stock']) && $_GET['in_stock'] !== '') {
                if ($_GET['in_stock'] === '1') {
                    $where .= " AND qc.shipment_id IS NULL";
                } elseif ($_GET['in_stock'] === '0') {
                    $where .= " AND qc.shipment_id IS NOT NULL";
                }
            }
            if (isset($_GET['source']) && $_GET['source'] !== '') {
                $where .= " AND qc.is_external = :source";
                $params[':source'] = intval($_GET['source']);
            }
            if (!empty($_GET['order_id'])) {
                $where .= " AND qc.order_id = :oid";
                $params[':oid'] = intval($_GET['order_id']);
            }

            // Count
            $countSql = "SELECT COUNT(*) FROM quality_controls qc LEFT JOIN products p ON qc.product_id = p.id LEFT JOIN looms l ON qc.loom_id = l.id WHERE $where";
            $stmtC = $db->prepare($countSql);
            foreach ($params as $k => $v) $stmtC->bindValue($k, $v);
            $total = $stmtC->execute()->fetchArray()[0];

            // Data
            $sql = "SELECT qc.*, ft.name as fabric_type_name, u.full_name as user_name, p.name as product_name, p.code as product_code, l.name as loom_name
                 FROM quality_controls qc
                 LEFT JOIN fabric_types ft ON qc.fabric_type_id = ft.id
                 LEFT JOIN users u ON qc.user_id = u.id
                 LEFT JOIN products p ON qc.product_id = p.id
                 LEFT JOIN looms l ON qc.loom_id = l.id
                WHERE $where
                ORDER BY qc.created_at DESC
                LIMIT :limit OFFSET :offset";
            $stmt = $db->prepare($sql);
            foreach ($params as $k => $v) $stmt->bindValue($k, $v);
            $stmt->bindValue(':limit', $limit, SQLITE3_INTEGER);
            $stmt->bindValue(':offset', $offset, SQLITE3_INTEGER);
            $result = $stmt->execute();
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                // Hataları getir
                $dStmt = $db->prepare("SELECT qd.*, dt.name as defect_name, dt.code as defect_code
                    FROM quality_defects qd
                    JOIN defect_types dt ON qd.defect_type_id = dt.id
                    WHERE qd.control_id = :cid");
                $dStmt->bindValue(':cid', $row['id'], SQLITE3_INTEGER);
                $dResult = $dStmt->execute();
                $row['defects'] = [];
                while ($d = $dResult->fetchArray(SQLITE3_ASSOC)) {
                    $row['defects'][] = $d;
                }
                $rows[] = $row;
            }

            jsonResponse(['data' => $rows, 'total' => $total, 'page' => $page, 'limit' => $limit]);

        } elseif ($method === 'POST') {
            $input = $_POST;
            if (empty($input['control_date'])) {
                jsonResponse(['error' => 'Kontrol tarihi zorunludur'], 400);
            }

            // Sunucu tarafında barkod üret
            $barcode = generateBarcode('internal');
            if (!$barcode) jsonResponse(['error' => 'Barkod üretilemedi'], 500);

            $stmt = $db->prepare("INSERT INTO quality_controls 
                (roll_no, party_no, loom_id, fabric_type_id, product_id, length_m, weight_kg, m2, line_m, barcode, width_cm, inspector, control_date, total_defects, quality_score, decision, notes, user_id, lot_no, order_id, created_at)
                VALUES (:roll_no, :party_no, :loom_id, :ftid, :pid, :length, :weight, :m2, :line_m, :barcode, :width, :inspector, :date, :total_defects, :score, :decision, :notes, :uid, :lot, :oid, :now)");

            $stmt->bindValue(':roll_no', $barcode);
            $stmt->bindValue(':party_no', sanitize($input['party_no'] ?? ''));
            $stmt->bindValue(':lot', sanitize($input['lot_no'] ?? ''));
            $stmt->bindValue(':loom_id', intval($input['loom_id'] ?? 0) ?: null);
            $stmt->bindValue(':ftid', intval($input['fabric_type_id'] ?? 0) ?: null);
            $stmt->bindValue(':pid', intval($input['product_id'] ?? 0) ?: null);
            $stmt->bindValue(':length', floatval($input['length_m'] ?? 0));
            $stmt->bindValue(':weight', floatval($input['weight_kg'] ?? 0));
            $stmt->bindValue(':m2', floatval($input['m2'] ?? 0));
            $stmt->bindValue(':line_m', floatval($input['line_m'] ?? 0));
            $stmt->bindValue(':barcode', sanitize($input['barcode'] ?? ''));
            $stmt->bindValue(':width', floatval($input['width_cm'] ?? 0));
            $stmt->bindValue(':inspector', sanitize($input['inspector'] ?? ''));
            $stmt->bindValue(':date', sanitize($input['control_date']));
            $stmt->bindValue(':total_defects', intval($input['total_defects'] ?? 0));
            $stmt->bindValue(':score', floatval($input['quality_score'] ?? 100));
            $stmt->bindValue(':decision', sanitize($input['decision'] ?? '1. Kalite'));
            $stmt->bindValue(':notes', sanitize($input['notes'] ?? ''));
            $stmt->bindValue(':uid', $_SESSION['user_id'], SQLITE3_INTEGER);
            $stmt->bindValue(':now', date('Y-m-d H:i:s'));
            
            $loomIdForOrder = intval($input['loom_id'] ?? 0);
            $orderId = null;
            if ($loomIdForOrder > 0) {
                $stmtLO = $db->prepare("SELECT order_id FROM looms WHERE id = :id");
                $stmtLO->bindValue(':id', $loomIdForOrder, SQLITE3_INTEGER);
                $loomOrderRow = $stmtLO->execute()->fetchArray(SQLITE3_ASSOC);
                if ($loomOrderRow && !empty($loomOrderRow['order_id'])) {
                    $orderId = intval($loomOrderRow['order_id']);
                }
            }
            $stmt->bindValue(':oid', $orderId, $orderId ? SQLITE3_INTEGER : SQLITE3_NULL);

            $stmt->execute();
            $controlId = $db->lastInsertRowID();

            // Sadece QC girişleri ile çözgü sayacını artır (Eğer ayar açıksa, ki JS tarafında değerlendirilecek, biz DB'ye her halükarda işleyelim)
            if (!empty($input['loom_id']) && !empty($input['length_m'])) {
                $loomId = intval($input['loom_id']);
                $newMeters = floatval($input['length_m']);
                $stmtU = $db->prepare("UPDATE looms SET qc_consumed_meters = qc_consumed_meters + :m WHERE id = :id");
                $stmtU->bindValue(':m', $newMeters);
                $stmtU->bindValue(':id', $loomId, SQLITE3_INTEGER);
                $stmtU->execute();
            }

            // Loom Sync Logic — sadece kullanıcı yeni sayaç değeri girdiyse güncelle (mutlak değer, ekleme değil)
            if (!empty($input['new_meter_reading']) && !empty($input['loom_id'])) {
                $loomId = intval($input['loom_id']);
                $newReading = floatval($input['new_meter_reading']);
                $stmtO = $db->prepare("SELECT yesterday_meters FROM looms WHERE id = :id");
                $stmtO->bindValue(':id', $loomId, SQLITE3_INTEGER);
                $old = $stmtO->execute()->fetchArray(SQLITE3_ASSOC);
                if ($old) {
                    $daily = $newReading - floatval($old['yesterday_meters'] ?? 0);
                    $stmtUR = $db->prepare("UPDATE looms SET current_meters = :cm, daily_meters = :dm, updated_at = datetime('now') WHERE id = :id");
                    $stmtUR->bindValue(':cm', $newReading);
                    $stmtUR->bindValue(':dm', $daily);
                    $stmtUR->bindValue(':id', $loomId, SQLITE3_INTEGER);
                    $stmtUR->execute();
                }
            }

            // Hataları kaydet
            if (!empty($input['defects'])) {
                $defects = json_decode($input['defects'], true);
                if (is_array($defects)) {
                    foreach ($defects as $defect) {
                        $dStmt = $db->prepare("INSERT INTO quality_defects (control_id, defect_type_id, count, severity, position_m, notes)
                            VALUES (:cid, :dtid, :count, :severity, :pos, :notes)");
                        $dStmt->bindValue(':cid', $controlId, SQLITE3_INTEGER);
                        $dStmt->bindValue(':dtid', intval($defect['defect_type_id']), SQLITE3_INTEGER);
                        $dStmt->bindValue(':count', intval($defect['count'] ?? 1), SQLITE3_INTEGER);
                        $dStmt->bindValue(':severity', intval($defect['severity'] ?? 1), SQLITE3_INTEGER);
                        $dStmt->bindValue(':pos', floatval($defect['position_m'] ?? 0));
                        $dStmt->bindValue(':notes', sanitize($defect['notes'] ?? ''));
                        $dStmt->execute();
                    }
                }
            }

            jsonResponse(['success' => true, 'id' => $controlId, 'barcode' => $barcode], 201);
        }
        break;

    case 'quality_control_delete':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        $db = getDB();
        
        $stmtS = $db->prepare("SELECT loom_id, length_m FROM quality_controls WHERE id = :id");
        $stmtS->bindValue(':id', $id, SQLITE3_INTEGER);
        $qc = $stmtS->execute()->fetchArray(SQLITE3_ASSOC);
        
        // Kayıt sil (sayaç geri düşürülmez — sayaç sadece Sayaç Girişi'nden güncellenir)
        // Ancak QC tabanlı çözgü düşümü için qc_consumed_meters geriye alınır
        if ($qc && !empty($qc['loom_id']) && !empty($qc['length_m'])) {
            $lid = $qc['loom_id'];
            $len = floatval($qc['length_m']);
            $stmtU = $db->prepare("UPDATE looms SET qc_consumed_meters = MAX(0, qc_consumed_meters - :len) WHERE id = :lid");
            $stmtU->bindValue(':len', $len);
            $stmtU->bindValue(':lid', $lid, SQLITE3_INTEGER);
            $stmtU->execute();
        }

        $stmtD1 = $db->prepare("DELETE FROM quality_defects WHERE control_id = :id");
        $stmtD1->bindValue(':id', $id, SQLITE3_INTEGER);
        $stmtD1->execute();

        $stmtD2 = $db->prepare("DELETE FROM quality_controls WHERE id = :id");
        $stmtD2->bindValue(':id', $id, SQLITE3_INTEGER);
        $stmtD2->execute();
        
        jsonResponse(['success' => true]);
        break;

    // ═══════════════════════════════════════
    //  ÜRÜNLER (STOK)
    // ═══════════════════════════════════════
    case 'products':
        requireLogin();
        $db = getDB();

        if ($method === 'GET') {
            $search = $_GET['search'] ?? '';
            $where = "p.is_active = 1";
            $params = [];

            if ($search) {
                $where .= " AND (p.name LIKE :s OR p.code LIKE :s)";
                $params[':s'] = '%' . $search . '%';
            }
            if (!empty($_GET['fabric_type_id'])) {
                $where .= " AND p.fabric_type_id = :ftid";
                $params[':ftid'] = $_GET['fabric_type_id'];
            }
            if (!empty($_GET['low_stock'])) {
                // Min stok kaldırıldığı için bu filtre artık boş döner veya devre dışı bırakılır
                $where .= " AND 1=0"; 
            }

            $sql = "SELECT p.*, ft.name as fabric_type_name,
                (SELECT 
                    CASE 
                        WHEN p.unit = 'kg' THEN SUM(qc.weight_kg)
                        WHEN p.unit = 'metre' THEN SUM(qc.length_m)
                        ELSE COUNT(qc.id)
                    END
                 FROM quality_controls qc 
                 WHERE qc.product_id = p.id AND qc.shipment_id IS NULL
                ) as current_stock
                FROM products p
                LEFT JOIN fabric_types ft ON p.fabric_type_id = ft.id
                WHERE $where
                ORDER BY p.name ASC";
            $stmt = $db->prepare($sql);
            foreach ($params as $k => $v) $stmt->bindValue($k, $v);
            $result = $stmt->execute();
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                $rows[] = $row;
            }
            jsonResponse(['data' => $rows]);

        } elseif ($method === 'POST') {
            $input = $_POST;
            $editId = intval($input['id'] ?? 0);

            if (empty($input['code']) || empty($input['name'])) {
                jsonResponse(['error' => 'Ürün kodu ve adı zorunludur'], 400);
            }

            if ($editId > 0) {
                // Güncelle
                $stmt = $db->prepare("UPDATE products SET code=:code, name=:name, fabric_type_id=:ftid, composition=:comp, density=:den, unit=:unit, supplier=:sup, tech_details=:tech, notes=:notes, weft_report=:wr, updated_at=datetime('now') WHERE id=:id");
                $stmt->bindValue(':id', $editId, SQLITE3_INTEGER);
            } else {
                // Yeni ekle
                $stmt = $db->prepare("INSERT INTO products (code, name, fabric_type_id, composition, density, unit, supplier, tech_details, notes, weft_report) VALUES (:code, :name, :ftid, :comp, :den, :unit, :sup, :tech, :notes, :wr)");
            }

            $stmt->bindValue(':code', sanitize($input['code']));
            $stmt->bindValue(':name', sanitize($input['name']));
            $stmt->bindValue(':ftid', intval($input['fabric_type_id'] ?? 0) ?: null);
            $stmt->bindValue(':comp', sanitize($input['composition'] ?? ''));
            $stmt->bindValue(':den', sanitize($input['density'] ?? ''));
            $stmt->bindValue(':unit', sanitize($input['unit'] ?? 'metre'));
            $stmt->bindValue(':sup', sanitize($input['supplier'] ?? ''));
            $stmt->bindValue(':tech', $input['tech_details'] ?? null); // JSON nesnesi olduğu için sanitize etmeden/bozmadan alıyoruz
            $stmt->bindValue(':notes', sanitize($input['notes'] ?? ''));
            $stmt->bindValue(':wr', sanitize($input['weft_report'] ?? ''));
            $stmt->execute();

            $newId = $editId > 0 ? $editId : $db->lastInsertRowID();

            // ── Image upload ──
            if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                $file = $_FILES['image'];
                $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
                $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
                if (in_array($ext, $allowed) && $file['size'] <= MAX_UPLOAD_SIZE) {
                    // Delete old image if exists
                    $oldStmt = $db->prepare("SELECT image FROM products WHERE id=:id");
                    $oldStmt->bindValue(':id', $newId, SQLITE3_INTEGER);
                    $oldRow = $oldStmt->execute()->fetchArray(SQLITE3_ASSOC);
                    if ($oldRow && $oldRow['image']) {
                        @unlink(UPLOAD_PATH . $oldRow['image']);
                    }
                    $filename = 'product_' . $newId . '_' . time() . '.' . $ext;
                    if (move_uploaded_file($file['tmp_name'], UPLOAD_PATH . $filename)) {
                        $imgStmt = $db->prepare("UPDATE products SET image=:img WHERE id=:id");
                        $imgStmt->bindValue(':img', $filename);
                        $imgStmt->bindValue(':id', $newId, SQLITE3_INTEGER);
                        $imgStmt->execute();
                    }
                }
            } elseif (!empty($input['remove_image'])) {
                // Remove image signal
                $oldStmt = $db->prepare("SELECT image FROM products WHERE id=:id");
                $oldStmt->bindValue(':id', $newId, SQLITE3_INTEGER);
                $oldRow = $oldStmt->execute()->fetchArray(SQLITE3_ASSOC);
                if ($oldRow && $oldRow['image']) {
                    @unlink(UPLOAD_PATH . $oldRow['image']);
                }
                $imgStmt = $db->prepare("UPDATE products SET image=NULL WHERE id=:id");
                $imgStmt->bindValue(':id', $newId, SQLITE3_INTEGER);
                $imgStmt->execute();
            }

            jsonResponse(['success' => true, 'id' => $newId]);
        }
        break;

    case 'product_delete':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        $db = getDB();
        $db->exec("UPDATE products SET is_active = 0 WHERE id = $id");
        jsonResponse(['success' => true]);
        break;

    case 'products_bulk':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $data = json_decode($_POST['data'] ?? '[]', true);
        if (empty($data)) jsonResponse(['error' => 'Veri bulunamadı'], 400);

        $db = getDB();
        $db->exec('BEGIN TRANSACTION');
        try {
            foreach ($data as $p) {
                $code = sanitize($p['code'] ?? '');
                $name = sanitize($p['name'] ?? '');
                if (!$code || !$name) continue;

                $stmt = $db->prepare("INSERT OR REPLACE INTO products (code, name, fabric_type_id, density, unit, supplier, composition, is_active) 
                                     VALUES (:c, :n, :ft, :d, :u, :s, :comp, 1)");
                $stmt->bindValue(':c', $code);
                $stmt->bindValue(':n', $name);
                $stmt->bindValue(':ft', intval($p['fabric_type_id'] ?? 0) ?: null);
                $stmt->bindValue(':d', sanitize($p['density'] ?? ''));
                $stmt->bindValue(':u', sanitize($p['unit'] ?? 'metre'));
                $stmt->bindValue(':s', sanitize($p['supplier'] ?? ''));
                $stmt->bindValue(':comp', sanitize($p['composition'] ?? ''));
                $stmt->execute();
            }
            $db->exec('COMMIT');
            jsonResponse(['success' => true]);
        } catch (Exception $e) {
            $db->exec('ROLLBACK');
            jsonResponse(['error' => $e->getMessage()], 500);
        }
        break;

    // ═══════════════════════════════════════
    //  TEZGAHLAR (ÜRETİM TAKİP)
    // ═══════════════════════════════════════
    case 'loom_order':
        requireLogin();
        $db = getDB();
        $id = intval($_POST['id'] ?? 0);
        if ($id > 0) {
            if (isset($_POST['order_id']) && $_POST['order_id'] !== '') {
                $orderId = intval($_POST['order_id']);
                $order = $db->query("SELECT customer_id, product_id FROM orders WHERE id = $orderId")->fetchArray(SQLITE3_ASSOC);
                if ($order) {
                    $stmt = $db->prepare("UPDATE looms SET order_id=:oid, customer_id=:cid, product_id=:pid, updated_at=datetime('now') WHERE id=:id");
                    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
                    $stmt->bindValue(':oid', $orderId, SQLITE3_INTEGER);
                    $stmt->bindValue(':cid', $order['customer_id'] ? $order['customer_id'] : SQLITE3_NULL, $order['customer_id'] ? SQLITE3_INTEGER : SQLITE3_NULL);
                    $stmt->bindValue(':pid', $order['product_id'] ? $order['product_id'] : SQLITE3_NULL, $order['product_id'] ? SQLITE3_INTEGER : SQLITE3_NULL);
                    $stmt->execute();
                    jsonResponse(['success' => true]);
                } else {
                    jsonResponse(['success' => false, 'error' => 'Sipariş bulunamadı']);
                }
            } else {
                $productId = isset($_POST['product_id']) ? intval($_POST['product_id']) : null;
                $customerId = isset($_POST['customer_id']) ? intval($_POST['customer_id']) : null;
                $stmt = $db->prepare("UPDATE looms SET order_id=NULL, product_id=:pid, customer_id=:cid, updated_at=datetime('now') WHERE id=:id");
                $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
                $stmt->bindValue(':pid', $productId, $productId ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->bindValue(':cid', $customerId, $customerId ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->execute();
                jsonResponse(['success' => true]);
            }
        } else {
            jsonResponse(['success' => false, 'error' => 'Invalid ID']);
        }
        break;

    case 'looms':
        requireLogin();
        $db = getDB();
        if ($method === 'GET') {
            $activeStatus = isset($_GET['archived']) && $_GET['archived'] == '1' ? 0 : 1;
            $stmt = $db->prepare("SELECT l.*, 
                                p.name as product_name, p.code as product_code, p.tech_details as product_tech, p.density as product_density, 
                                c.name as customer_name, o.order_no,
                                p_next.name as next_product_name, p_next.code as next_product_code,
                                c_next.name as next_customer_name,
                                o_next.order_no as next_order_no,
                                (SELECT efficiency FROM loom_daily_entries WHERE loom_id = l.id ORDER BY created_at DESC LIMIT 1) as last_efficiency
                                FROM looms l 
                                LEFT JOIN products p ON l.product_id = p.id 
                                LEFT JOIN customers c ON l.customer_id = c.id
                                LEFT JOIN orders o ON l.order_id = o.id
                                LEFT JOIN products p_next ON l.next_product_id = p_next.id
                                LEFT JOIN customers c_next ON l.next_customer_id = c_next.id
                                LEFT JOIN orders o_next ON l.next_order_id = o_next.id
                                WHERE l.is_active = :active
                                ORDER BY l.name ASC");
            $stmt->bindValue(':active', $activeStatus, SQLITE3_INTEGER);
            $result = $stmt->execute();
            $rows = [];
            $now = time();
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                $resetAt = !empty($row['reset_at']) ? strtotime($row['reset_at']) : $now;
                $row['mins_passed'] = floor(($now - $resetAt) / 60);
                $rows[] = $row;
            }
            jsonResponse(['data' => $rows]);
        } elseif ($method === 'POST') {
            $id = intval($_POST['id'] ?? 0);
            $name = sanitize($_POST['name'] ?? '');
            $productId = intval($_POST['product_id'] ?? 0) ?: null;
            $customerId = intval($_POST['customer_id'] ?? 0) ?: null;
            $orderId = intval($_POST['order_id'] ?? 0) ?: null;
            $status = sanitize($_POST['status'] ?? 'çalışıyor');
            $rpm = intval($_POST['rpm'] ?? 0);
            $currentMeters = floatval($_POST['current_meters'] ?? 0);
            $warpTotal = floatval($_POST['warp_total'] ?? 0);
            $lotNo = sanitize($_POST['lot_no'] ?? '');

            // Sıradaki İş Planı
            $nextProductId = intval($_POST['next_product_id'] ?? 0) ?: null;
            $nextCustomerId = intval($_POST['next_customer_id'] ?? 0) ?: null;
            $nextOrderId = intval($_POST['next_order_id'] ?? 0) ?: null;
            $nextLotNo = sanitize($_POST['next_lot_no'] ?? '');
            $nextJobNotes = sanitize($_POST['next_job_notes'] ?? '');

            // Yeni teknik alanlar
            $type = sanitize($_POST['type'] ?? '');
            $workHours = floatval($_POST['work_hours'] ?? 24);
            $frames = intval($_POST['frames'] ?? 0);
            $warpYarn = sanitize($_POST['warp_yarn'] ?? '');
            $weftYarn = sanitize($_POST['weft_yarn'] ?? '');
            $width = floatval($_POST['width'] ?? 0);
            $location = sanitize($_POST['location'] ?? 'Fabrika');
            $warpStartDate = sanitize($_POST['warp_start_date'] ?? '');
            if (!$warpStartDate) $warpStartDate = date('Y-m-d');
            
            $warpSpareStatus = sanitize($_POST['warp_spare_status'] ?? '');
            $warpSpareNotes = sanitize($_POST['warp_spare_notes'] ?? '');
            $notes = sanitize($_POST['notes'] ?? '');
            $warpStartOverride = isset($_POST['warp_start_meter']) ? floatval($_POST['warp_start_meter']) : null;
            
            $reset = intval($_POST['reset'] ?? 0);
            
            if ($id > 0) {
                if ($reset === 1) {
                    $stmt = $db->prepare("UPDATE looms SET 
                        yesterday_meters = current_meters,
                        reset_at = datetime('now'),
                        updated_at = datetime('now')
                        WHERE id = :id");
                    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
                    $stmt->execute();
                    jsonResponse(['success' => true]);
                }

                $stmtO = $db->prepare("SELECT yesterday_meters, warp_total, warp_start_meter FROM looms WHERE id = :id");
                $stmtO->bindValue(':id', $id, SQLITE3_INTEGER);
                $old = $stmtO->execute()->fetchArray(SQLITE3_ASSOC);
                $daily = $currentMeters - ($old['yesterday_meters'] ?? 0);
                
                $warpStart = $old['warp_start_meter'];
                $resetQcMeters = false;
                if ($warpStartOverride !== null) {
                    $warpStart = $warpStartOverride;
                    $resetQcMeters = true;
                } elseif ($warpTotal != $old['warp_total'] && $warpTotal > 0) {
                    $warpStart = $currentMeters;
                    $warpStartDate = date('Y-m-d');
                    $resetQcMeters = true;
                }

                $qcConsumedUpdate = $resetQcMeters ? "qc_consumed_meters=0," : "";

                $stmt = $db->prepare("UPDATE looms SET name=:n, product_id=:p, customer_id=:c, order_id=:oid, status=:s, rpm=:r, current_meters=:cm, warp_total=:wt, warp_start_meter=:ws, $qcConsumedUpdate daily_meters=:dm, lot_no=:lot, 
                    type=:t, work_hours=:wh, frames=:f, warp_yarn=:wy, weft_yarn=:wey, width=:w, location=:l, warp_start_date=:wsd, warp_spare_status=:wss, warp_spare_notes=:wsn, notes=:not,
                    next_product_id=:npi, next_customer_id=:nci, next_order_id=:noi, next_lot_no=:nlot, next_job_notes=:njn,
                    updated_at=datetime('now') WHERE id=:id");
                $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
                $stmt->bindValue(':c', $customerId, $customerId ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->bindValue(':oid', $orderId, $orderId ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->bindValue(':dm', $daily);
                $stmt->bindValue(':wt', $warpTotal);
                $stmt->bindValue(':ws', $warpStart);
                $stmt->bindValue(':lot', $lotNo);
                $stmt->bindValue(':npi', $nextProductId, $nextProductId ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->bindValue(':nci', $nextCustomerId, $nextCustomerId ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->bindValue(':noi', $nextOrderId, $nextOrderId ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->bindValue(':nlot', $nextLotNo);
                $stmt->bindValue(':njn', $nextJobNotes);
            } else {
                $stmt = $db->prepare("INSERT INTO looms (name, product_id, customer_id, order_id, status, rpm, current_meters, yesterday_meters, daily_meters, warp_total, warp_start_meter, lot_no, 
                    type, work_hours, frames, warp_yarn, weft_yarn, width, location, warp_start_date, warp_spare_status, warp_spare_notes, notes, reset_at,
                    next_product_id, next_customer_id, next_order_id, next_lot_no, next_job_notes) 
                    VALUES (:n, :p, :c, :oid, :s, :r, :cm, :cm, 0, :wt, :ws, :lot, :t, :wh, :f, :wy, :wey, :w, :l, :wsd, :wss, :wsn, :not, datetime('now'),
                    :npi, :nci, :noi, :nlot, :njn)");
                $stmt->bindValue(':c', $customerId, $customerId ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->bindValue(':oid', $orderId, $orderId ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->bindValue(':wt', $warpTotal);
                $stmt->bindValue(':ws', $warpStartOverride !== null ? $warpStartOverride : $currentMeters);
                $stmt->bindValue(':lot', $lotNo);
                $stmt->bindValue(':npi', $nextProductId, $nextProductId ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->bindValue(':nci', $nextCustomerId, $nextCustomerId ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->bindValue(':noi', $nextOrderId, $nextOrderId ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->bindValue(':nlot', $nextLotNo);
                $stmt->bindValue(':njn', $nextJobNotes);
            }
            $stmt->bindValue(':n', $name);
            $stmt->bindValue(':p', $productId, $productId ? SQLITE3_INTEGER : SQLITE3_NULL);
            $stmt->bindValue(':s', $status);
            $stmt->bindValue(':r', $rpm, SQLITE3_INTEGER);
            $stmt->bindValue(':cm', $currentMeters);
            $stmt->bindValue(':t', $type);
            $stmt->bindValue(':wh', $workHours);
            $stmt->bindValue(':f', $frames);
            $stmt->bindValue(':wy', $warpYarn);
            $stmt->bindValue(':wey', $weftYarn);
            $stmt->bindValue(':w', $width);
            $stmt->bindValue(':l', $location);
            $stmt->bindValue(':wsd', $warpStartDate);
            $stmt->bindValue(':wss', $warpSpareStatus);
            $stmt->bindValue(':wsn', $warpSpareNotes);
            $stmt->bindValue(':not', $notes);
            $stmt->execute();
            jsonResponse(['success' => true]);
        }
        break;

    case 'customers':
        requireLogin();
        $db = getDB();
        if ($method === 'GET') {
            $result = $db->query("SELECT c.*, 
                COALESCE((SELECT SUM(CASE WHEN currency='TL' THEN (CASE WHEN type IN ('fatura_satis', 'odeme') THEN amount WHEN type IN ('fatura_alis', 'tahsilat') THEN -amount ELSE 0 END) ELSE 0 END) FROM acc_transactions WHERE customer_id = c.id), 0) as balance,
                COALESCE((SELECT SUM(CASE WHEN currency='USD' THEN (CASE WHEN type IN ('fatura_satis', 'odeme') THEN amount WHEN type IN ('fatura_alis', 'tahsilat') THEN -amount ELSE 0 END) ELSE 0 END) FROM acc_transactions WHERE customer_id = c.id), 0) as balance_usd,
                COALESCE((SELECT SUM(CASE WHEN currency='EUR' THEN (CASE WHEN type IN ('fatura_satis', 'odeme') THEN amount WHEN type IN ('fatura_alis', 'tahsilat') THEN -amount ELSE 0 END) ELSE 0 END) FROM acc_transactions WHERE customer_id = c.id), 0) as balance_eur
                FROM customers c WHERE c.is_active = 1 ORDER BY c.name ASC");
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
            jsonResponse(['data' => $rows]);
        } elseif ($method === 'POST') {
            $id = intval($_POST['id'] ?? 0);
            $name = sanitize($_POST['name'] ?? '');
            $phone = sanitize($_POST['phone'] ?? '');
            $email = sanitize($_POST['email'] ?? '');
            $notes = sanitize($_POST['notes'] ?? '');

            if ($id > 0) {
                $stmt = $db->prepare("UPDATE customers SET name=:n, phone=:p, email=:e, notes=:nt WHERE id=:id");
                $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
            } else {
                $stmt = $db->prepare("INSERT INTO customers (name, phone, email, notes) VALUES (:n, :p, :e, :nt)");
            }
            $stmt->bindValue(':n', $name);
            $stmt->bindValue(':p', $phone);
            $stmt->bindValue(':e', $email);
            $stmt->bindValue(':nt', $notes);
            $stmt->execute();
            jsonResponse(['success' => true]);
        }
        break;

    case 'acc_transactions':
        requireLogin();
        $db = getDB();
        if ($method === 'GET') {
            $customerId = intval($_GET['customer_id'] ?? 0);
            if (!$customerId) jsonResponse(['error' => 'Cari ID gerekli'], 400);

            $stmt = $db->prepare("SELECT * FROM acc_transactions WHERE customer_id = :cid ORDER BY date DESC, id DESC");
            $stmt->bindValue(':cid', $customerId, SQLITE3_INTEGER);
            $result = $stmt->execute();
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                $rows[] = $row;
            }
            jsonResponse(['data' => $rows]);
        } elseif ($method === 'POST') {
            $data = json_decode(file_get_contents('php://input'), true);
            if (!$data) $data = $_POST;

            $customerId = intval($data['customer_id'] ?? 0);
            $type = sanitize($data['type'] ?? '');
            $amount = floatval($data['amount'] ?? 0);
            $currency = sanitize($data['currency'] ?? 'TL');
            $rate = floatval($data['exchange_rate'] ?? 1);
            $methodType = sanitize($data['payment_method'] ?? 'Nakit');
            $date = sanitize($data['date'] ?? date('Y-m-d'));
            $notes = sanitize($data['notes'] ?? '');

            if (!$customerId || !$type || $amount <= 0) jsonResponse(['error' => 'Eksik veya hatalı bilgi'], 400);

            $stmt = $db->prepare("INSERT INTO acc_transactions (customer_id, type, amount, currency, exchange_rate, payment_method, date, notes) 
                                  VALUES (:cid, :typ, :amt, :cur, :rat, :pm, :dt, :nt)");
            $stmt->bindValue(':cid', $customerId, SQLITE3_INTEGER);
            $stmt->bindValue(':typ', $type);
            $stmt->bindValue(':amt', $amount);
            $stmt->bindValue(':cur', $currency);
            $stmt->bindValue(':rat', $rate);
            $stmt->bindValue(':pm', $methodType);
            $stmt->bindValue(':dt', $date);
            $stmt->bindValue(':nt', $notes);
            $stmt->execute();
            jsonResponse(['success' => true]);
        }
        break;

    case 'unbilled_shipments':
        requireLogin();
        $db = getDB();
        $cid = intval($_GET['customer_id'] ?? 0);
        
        $stmtS = $db->prepare("SELECT * FROM shipments WHERE customer_id = :cid AND (is_billed IS NULL OR is_billed = 0) ORDER BY shipment_date DESC");
        $stmtS->bindValue(':cid', $cid, SQLITE3_INTEGER);
        $res = $stmtS->execute();
        $shipments = [];
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
            $sid = $row['id'];
            $stmtI = $db->prepare("
                SELECT qc.product_id, p.name as product_name, SUM(qc.length_m) as total_qty, COUNT(qc.id) as roll_count
                FROM quality_controls qc
                JOIN products p ON qc.product_id = p.id
                WHERE qc.shipment_id = :sid
                GROUP BY qc.product_id, p.name
            ");
            $stmtI->bindValue(':sid', $sid, SQLITE3_INTEGER);
            $itemsRes = $stmtI->execute();
            $items = [];
            while ($item = $itemsRes->fetchArray(SQLITE3_ASSOC)) {
                $items[] = $item;
            }
            $row['items'] = $items;
            $shipments[] = $row;
        }
        jsonResponse(['data' => $shipments]);
        break;

    case 'unbilled_entries':
        requireLogin();
        $db = getDB();
        $cid = intval($_GET['customer_id'] ?? 0);
        
        $stmtE = $db->prepare("
            SELECT qc.id, qc.control_date, qc.product_id, p.name as product_name, qc.length_m as total_qty, qc.roll_no as doc_no
            FROM quality_controls qc
            JOIN products p ON qc.product_id = p.id
            WHERE qc.customer_id = :cid AND qc.is_external = 1 AND (qc.is_billed IS NULL OR qc.is_billed = 0)
            ORDER BY qc.control_date DESC
        ");
        $stmtE->bindValue(':cid', $cid, SQLITE3_INTEGER);
        $res = $stmtE->execute();
        $entries = [];
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
            $entries[] = $row;
        }
        jsonResponse(['data' => $entries]);
        break;

    case 'save_invoice':
        requireLogin();
        $db = getDB();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) $data = $_POST; // fallback

        $customerId = intval($data['customer_id'] ?? 0);
        $type = sanitize($data['type'] ?? 'satis');
        $invoiceNo = sanitize($data['invoice_no'] ?? '');
        $date = sanitize($data['date'] ?? date('Y-m-d'));
        $currency = sanitize($data['currency'] ?? 'TL');
        $rate = floatval($data['exchange_rate'] ?? 1);
        $subtotal = floatval($data['subtotal'] ?? 0);
        $tax = floatval($data['tax'] ?? 0);
        $total = floatval($data['total'] ?? 0);
        $notes = sanitize($data['notes'] ?? '');
        
        $shipments = $data['shipment_ids'] ?? [];
        $entries = $data['entry_ids'] ?? [];
        $items = $data['items'] ?? [];

        if (!$customerId || empty($items) || $total <= 0) {
            jsonResponse(['error' => 'Geçersiz fatura verisi'], 400);
        }

        $db->exec("BEGIN TRANSACTION");
        try {
            $stmt = $db->prepare("INSERT INTO acc_invoices (type, customer_id, invoice_no, invoice_date, currency, exchange_rate, subtotal, tax_amount, total_amount, notes) 
                                  VALUES (:t, :cid, :no, :dt, :cur, :rat, :sub, :tax, :tot, :not)");
            $stmt->bindValue(':t', $type);
            $stmt->bindValue(':cid', $customerId);
            $stmt->bindValue(':no', $invoiceNo);
            $stmt->bindValue(':dt', $date);
            $stmt->bindValue(':cur', $currency);
            $stmt->bindValue(':rat', $rate);
            $stmt->bindValue(':sub', $subtotal);
            $stmt->bindValue(':tax', $tax);
            $stmt->bindValue(':tot', $total);
            $stmt->bindValue(':not', $notes);
            $stmt->execute();
            $invoiceId = $db->lastInsertRowID();

            // 1. Ürün bazlı kalemleri kaydet
            $stmtItem = $db->prepare("INSERT INTO acc_invoice_items (invoice_id, entity_type, product_id, quantity, unit_price, total_price) 
                                      VALUES (:inv, :et, :pid, :qty, :up, :tp)");
            foreach ($items as $item) {
                $eType = ($type === 'satis') ? 'shipment' : 'depo_giris';
                $stmtItem->bindValue(':inv', $invoiceId);
                $stmtItem->bindValue(':et', $eType);
                $stmtItem->bindValue(':pid', $item['product_id']);
                $stmtItem->bindValue(':qty', $item['quantity']);
                $stmtItem->bindValue(':up', $item['unit_price']);
                $stmtItem->bindValue(':tp', $item['total_price']);
                $stmtItem->execute();
            }

            // 2. Bağlı ID'leri kaydet (is_billed geri almak için gerekli)
            if (!empty($shipments)) {
                $ids = implode(',', array_map('intval', $shipments));
                $db->exec("UPDATE shipments SET is_billed = 1 WHERE id IN ($ids)");
                $stmtSI = $db->prepare("INSERT INTO acc_invoice_items (invoice_id, entity_type, entity_id) VALUES (:inv, 'shipment', :eid)");
                foreach($shipments as $sid) {
                    $stmtSI->bindValue(':inv', $invoiceId, SQLITE3_INTEGER);
                    $stmtSI->bindValue(':eid', intval($sid), SQLITE3_INTEGER);
                    $stmtSI->execute();
                }
            }
            if (!empty($entries)) {
                $ids = implode(',', array_map('intval', $entries));
                $db->exec("UPDATE quality_controls SET is_billed = 1 WHERE id IN ($ids)");
                $stmtEI = $db->prepare("INSERT INTO acc_invoice_items (invoice_id, entity_type, entity_id) VALUES (:inv, 'depo_giris', :eid)");
                foreach($entries as $eid) {
                    $stmtEI->bindValue(':inv', $invoiceId, SQLITE3_INTEGER);
                    $stmtEI->bindValue(':eid', intval($eid), SQLITE3_INTEGER);
                    $stmtEI->execute();
                }
            }

            $txType = ($type === 'satis') ? 'fatura_satis' : 'fatura_alis';
            $stmtTx = $db->prepare("INSERT INTO acc_transactions (customer_id, type, document_id, currency, exchange_rate, amount, payment_method, date, notes) 
                                    VALUES (:cid, :typ, :doc, :cur, :rat, :amt, 'Cari', :dt, :not)");
            $stmtTx->bindValue(':cid', $customerId);
            $stmtTx->bindValue(':typ', $txType);
            $stmtTx->bindValue(':doc', $invoiceId);
            $stmtTx->bindValue(':cur', $currency);
            $stmtTx->bindValue(':rat', $rate);
            $stmtTx->bindValue(':amt', $total);
            $stmtTx->bindValue(':dt', $date);
            $stmtTx->bindValue(':not', ($invoiceNo ? "Fatura No: $invoiceNo" : "Fatura") . ($notes ? " - $notes" : ""));
            $stmtTx->execute();

            $db->exec("COMMIT");
            jsonResponse(['success' => true]);
        } catch (Throwable $e) {
            $db->exec("ROLLBACK");
            jsonResponse(['error' => 'Fatura kaydedilemedi: ' . $db->lastErrorMsg() . ' (Hata: ' . $e->getMessage() . ')'], 500);
        }
        break;

    case 'delete_transaction':
        requireLogin();
        $db = getDB();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        
        $data = json_decode(file_get_contents('php://input'), true);
        $id = intval($data['id'] ?? $_POST['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);

        $stmtTxS = $db->prepare("SELECT * FROM acc_transactions WHERE id = :id");
        $stmtTxS->bindValue(':id', $id, SQLITE3_INTEGER);
        $tx = $stmtTxS->execute()->fetchArray(SQLITE3_ASSOC);
        if (!$tx) jsonResponse(['error' => 'İşlem bulunamadı'], 404);

        $db->exec("BEGIN TRANSACTION");
        try {
            if ($tx['type'] === 'fatura_satis' || $tx['type'] === 'fatura_alis') {
                $invId = $tx['document_id'];
                
                // Bağlı sevkiyatları veya girişleri serbest bırak (is_billed = 0)
                $stmtUS = $db->prepare("UPDATE shipments SET is_billed = 0 WHERE id IN (SELECT entity_id FROM acc_invoice_items WHERE invoice_id = :inv AND entity_type = 'shipment' AND entity_id IS NOT NULL)");
                $stmtUS->bindValue(':inv', $invId, SQLITE3_INTEGER);
                $stmtUS->execute();

                $stmtUQC = $db->prepare("UPDATE quality_controls SET is_billed = 0 WHERE id IN (SELECT entity_id FROM acc_invoice_items WHERE invoice_id = :inv AND entity_type = 'depo_giris' AND entity_id IS NOT NULL)");
                $stmtUQC->bindValue(':inv', $invId, SQLITE3_INTEGER);
                $stmtUQC->execute();

                // Fatura ve kalemlerini sil
                $stmtDI = $db->prepare("DELETE FROM acc_invoice_items WHERE invoice_id = :inv");
                $stmtDI->bindValue(':inv', $invId, SQLITE3_INTEGER);
                $stmtDI->execute();

                $stmtDIN = $db->prepare("DELETE FROM acc_invoices WHERE id = :inv");
                $stmtDIN->bindValue(':inv', $invId, SQLITE3_INTEGER);
                $stmtDIN->execute();
            }

            $stmtDT = $db->prepare("DELETE FROM acc_transactions WHERE id = :id");
            $stmtDT->bindValue(':id', $id, SQLITE3_INTEGER);
            $stmtDT->execute();

            $db->exec("COMMIT");
            jsonResponse(['success' => true]);
        } catch (Throwable $e) {
            $db->exec("ROLLBACK");
            jsonResponse(['error' => 'Silme hatası: ' . $e->getMessage()], 500);
        }
        break;

    case 'customer_delete':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $data = json_decode(file_get_contents('php://input'), true);
        $id = intval($data['id'] ?? $_POST['id'] ?? 0);
        $db = getDB();
        $stmtC = $db->prepare("UPDATE customers SET is_active = 0 WHERE id = :id");
        $stmtC->bindValue(':id', $id, SQLITE3_INTEGER);
        $stmtC->execute();
        jsonResponse(['success' => true]);
        break;

    case 'customer_summary':
        requireLogin();
        $id = intval($_GET['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        $db = getDB();
        
        // Girişler (Dış Alım)
        $stmt1 = $db->prepare("
            SELECT q.*, p.name as product_name, p.code as product_code
            FROM quality_controls q
            LEFT JOIN products p ON q.product_id = p.id
            WHERE q.customer_id = :id AND q.is_external = 1
            ORDER BY q.control_date DESC
        ");
        $stmt1->bindValue(':id', $id, SQLITE3_INTEGER);
        $res1 = $stmt1->execute();
        $entries = [];
        while($r = $res1->fetchArray(SQLITE3_ASSOC)) $entries[] = $r;

        // Sevkler
        $stmt2 = $db->prepare("
            SELECT q.*, p.name as product_name, p.code as product_code, s.shipment_date
            FROM quality_controls q
            JOIN shipments s ON q.shipment_id = s.id
            LEFT JOIN products p ON q.product_id = p.id
            WHERE s.customer_id = :id
            ORDER BY s.shipment_date DESC
        ");
        $stmt2->bindValue(':id', $id, SQLITE3_INTEGER);
        $res2 = $stmt2->execute();
        $shipments = [];
        while($r = $res2->fetchArray(SQLITE3_ASSOC)) $shipments[] = $r;

        jsonResponse(['entries' => $entries, 'shipments' => $shipments]);
        break;

    case 'loom_delete':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        $db = getDB();
        $stmt = $db->prepare("UPDATE looms SET is_active = 0 WHERE id = :id");
        $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
        $stmt->execute();
        jsonResponse(['success' => true]);
        break;

    case 'loom_restore':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        $db = getDB();
        $stmt = $db->prepare("UPDATE looms SET is_active = 1 WHERE id = :id");
        $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
        $stmt->execute();
        jsonResponse(['success' => true]);
        break;

    case 'loom_reset':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        $type = sanitize($_POST['type'] ?? 'day');
        $db = getDB();
        
        if ($type === 'warp') {
            $sql = "UPDATE looms SET yesterday_meters = 0, current_meters = 0, daily_meters = 0, warp_start_meter = 0, qc_consumed_meters = 0, warp_start_date = date('now'), reset_at = datetime('now'), warp_spare_status = CASE WHEN warp_spare_status = 'Hazır' THEN '' ELSE warp_spare_status END";
            if ($id > 0) $sql .= " WHERE id = $id";
            $db->exec($sql);
        } else {
            $sql = "UPDATE looms SET yesterday_meters = current_meters, daily_meters = 0, reset_at = datetime('now')";
            if ($id > 0) $sql .= " WHERE id = $id";
            $db->exec($sql);
        }
        jsonResponse(['success' => true]);
        break;

    case 'loom_daily_entries':
        requireLogin();
        $db = getDB();
        if ($method === 'GET') {
            $loomId = intval($_GET['loom_id'] ?? 0);
            if (!$loomId) jsonResponse(['error' => 'loom_id gerekli'], 400);
            $result = $db->query("SELECT * FROM loom_daily_entries WHERE loom_id = $loomId ORDER BY date DESC LIMIT 30");
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
            jsonResponse(['data' => $rows]);
        } elseif ($method === 'POST') {
            $loomId = intval($_POST['loom_id'] ?? 0);
            $date = sanitize($_POST['date'] ?? '');
            $meters = floatval($_POST['meters'] ?? 0);
            $hours = floatval($_POST['hours'] ?? 0);
            $efficiency = floatval($_POST['efficiency'] ?? 0);
            $notes = sanitize($_POST['notes'] ?? '');

            if (!$loomId || !$date) jsonResponse(['error' => 'Eksik bilgi'], 400);

            // Önce o tarihte kayıt var mı bak
            $check = $db->query("SELECT id FROM loom_daily_entries WHERE loom_id = $loomId AND date = '$date'")->fetchArray(SQLITE3_ASSOC);
            if ($check) {
                $stmt = $db->prepare("UPDATE loom_daily_entries SET meters=:m, hours=:h, efficiency=:e, notes=:n WHERE id=:id");
                $stmt->bindValue(':id', $check['id'], SQLITE3_INTEGER);
            } else {
                $stmt = $db->prepare("INSERT INTO loom_daily_entries (loom_id, date, meters, hours, efficiency, notes) VALUES (:lid, :d, :m, :h, :e, :n)");
                $stmt->bindValue(':lid', $loomId, SQLITE3_INTEGER);
                $stmt->bindValue(':d', $date);
            }
            $stmt->bindValue(':m', $meters);
            $stmt->bindValue(':h', $hours);
            $stmt->bindValue(':e', $efficiency);
            $stmt->bindValue(':n', $notes);
            $stmt->execute();
            jsonResponse(['success' => true]);
        }
        break;

    case 'loom_daily_entry_delete':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        $db = getDB();
        $db->exec("DELETE FROM loom_daily_entries WHERE id = $id");
        jsonResponse(['success' => true]);
        break;

    case 'looms_bulk_update':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $itemsRaw = $_POST['items'] ?? '[]';
        $data = is_array($itemsRaw) ? $itemsRaw : json_decode($itemsRaw, true);
        if (!is_array($data)) jsonResponse(['error' => 'Geçersiz veri formatı'], 400);
        
        $db = getDB();
        $db->exec('BEGIN TRANSACTION');
        try {
            $dateStr = sanitize($_POST['date'] ?? date('Y-m-d H:i'));
            foreach ($data as $item) {
                $lid = intval($item['id']);
                $pid = intval($item['product_id'] ?? 0) ?: null;
                $cid = intval($item['customer_id'] ?? 0) ?: null;
                $curM = floatval($item['current_meters'] ?? 0);
                $lot = sanitize($item['lot_no'] ?? '');
                $hours = floatval($item['hours'] ?? 24);
                
                // Get old data for production diff and efficiency calculation
                $old = $db->query("SELECT l.yesterday_meters, l.current_meters, l.rpm, p.density as product_density 
                                   FROM looms l 
                                   LEFT JOIN products p ON l.product_id = p.id 
                                   WHERE l.id = $lid")->fetchArray(SQLITE3_ASSOC);
                if (!$old) continue;

                $daily = $curM - ($old['yesterday_meters'] ?? 0);
                
                // Randıman Hesapla
                $eff = 0;
                $rpm = floatval($old['rpm'] ?? 0);
                $density = floatval($old['product_density'] ?? 0);
                if ($rpm > 0 && $density > 0 && $hours > 0) {
                    $theoretical = ($rpm * $hours * 60) / ($density * 100);
                    $eff = $theoretical > 0 ? min(100, ($daily / $theoretical) * 100) : 0;
                }

                $stmt = $db->prepare("UPDATE looms SET product_id=:p, customer_id=:c, current_meters=:cm, daily_meters=:dm, lot_no=:lot, updated_at=datetime('now') WHERE id=:id");
                $stmt->bindValue(':id', $lid, SQLITE3_INTEGER);
                $stmt->bindValue(':p', $pid, $pid ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->bindValue(':c', $cid, $cid ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->bindValue(':cm', $curM);
                $stmt->bindValue(':dm', $daily);
                $stmt->bindValue(':lot', $lot);
                $stmt->execute();

                // Sayaç veya saat değişmişse tarihçeye ekle
                if ($curM != floatval($old['current_meters'])) {
                    // O tarihte zaten kayıt var mı bak (Sadece tarih kısmını al)
                    $dateOnly = explode(' ', $dateStr)[0];
                    $check = $db->query("SELECT id FROM loom_daily_entries WHERE loom_id = $lid AND date LIKE '$dateOnly%'")->fetchArray(SQLITE3_ASSOC);
                    
                    if ($check) {
                        $hStmt = $db->prepare("UPDATE loom_daily_entries SET meters=:m, hours=:h, efficiency=:e, notes=:n WHERE id=:id");
                        $hStmt->bindValue(':id', $check['id'], SQLITE3_INTEGER);
                    } else {
                        $hStmt = $db->prepare("INSERT INTO loom_daily_entries (loom_id, date, meters, hours, efficiency, notes) VALUES (:lid, :d, :m, :h, :e, :n)");
                        $hStmt->bindValue(':lid', $lid, SQLITE3_INTEGER);
                        $hStmt->bindValue(':d', $dateStr);
                    }
                    
                    $hStmt->bindValue(':m', $daily);
                    $hStmt->bindValue(':h', $hours);
                    $hStmt->bindValue(':e', $eff);
                    $hStmt->bindValue(':n', 'Toplu Güncelleme: ' . $curM . ' mt (LOT: ' . $lot . ', Saat: ' . $hours . ')');
                    $hStmt->execute();
                }
            }
            $db->exec('COMMIT');
            jsonResponse(['success' => true]);
        } catch (Exception $e) {
            $db->exec('ROLLBACK');
            jsonResponse(['error' => $e->getMessage()], 500);
        }
        break;

    // ═══════════════════════════════════════
    //  STOK HAREKETLERİ
    // ═══════════════════════════════════════
    case 'stock_movements':
        requireLogin();
        $db = getDB();

        if ($method === 'GET') {
            $productId = intval($_GET['product_id'] ?? 0);
            $where = "1=1";
            $params = [];

            if ($productId) {
                $where .= " AND product_id = :pid";
                $params[':pid'] = $productId;
            }
            if (!empty($_GET['type'])) {
                $where .= " AND type = :type";
                $params[':type'] = $_GET['type'];
            }
            if (!empty($_GET['act_type'])) {
                $where .= " AND act_type = :at";
                $params[':at'] = $_GET['act_type'];
            }
            if (!empty($_GET['date_from'])) {
                $where .= " AND DATE(created_at) >= :dfrom";
                $params[':dfrom'] = $_GET['date_from'];
            }
            if (!empty($_GET['date_to'])) {
                $where .= " AND DATE(created_at) <= :dto";
                $params[':dto'] = $_GET['date_to'];
            }

            if (!empty($_GET['q'])) {
                $q = '%' . $_GET['q'] . '%';
                $where .= " AND (product_name LIKE :q OR customer_name LIKE :q OR document_no LIKE :q OR info LIKE :q)";
                $params[':q'] = $q;
            }

            $sql = "
                SELECT * FROM (
                    SELECT sm.act_type, sm.id, sm.created_at, p.name as product_name, p.code as product_code, p.unit as product_unit, sm.quantity as qty, sm.type, 
                           COALESCE((SELECT weight_kg FROM quality_controls WHERE roll_no = sm.document_no LIMIT 1), 0) as weight_kg,
                           sm.document_no, sm.description as info, u.full_name as user_name, sm.product_id,
                           CASE 
                             WHEN sm.act_type = 'external' THEN (SELECT c.name FROM quality_controls qc JOIN customers c ON qc.customer_id = c.id WHERE qc.roll_no = sm.document_no LIMIT 1)
                             WHEN sm.act_type = 'ship' THEN (SELECT c.name FROM shipments s JOIN customers c ON s.customer_id = c.id WHERE 'S-'||s.id = sm.document_no LIMIT 1)
                             ELSE '-' 
                           END as customer_name,
                           '-' as loom_name
                    FROM stock_movements sm 
                    JOIN products p ON sm.product_id = p.id
                    LEFT JOIN users u ON sm.user_id = u.id
                    
                    UNION ALL
                    
                    SELECT CASE WHEN qc.is_external = 1 THEN 'external' ELSE 'qc' END as act_type, qc.id, qc.created_at, p.name as product_name, p.code as product_code, 'mt' as product_unit, qc.length_m as qty, 'giris' as type, 
                           qc.weight_kg,
                           qc.roll_no as document_no, 
                           CASE WHEN qc.is_external = 1 THEN 'Dış Alım Girişi' ELSE 'İç Üretim' END as info, 
                           u.full_name as user_name, qc.product_id, COALESCE(c.name, '-') as customer_name,
                           COALESCE(l.name, '-') as loom_name
                    FROM quality_controls qc
                    JOIN products p ON qc.product_id = p.id
                    LEFT JOIN customers c ON qc.customer_id = c.id
                    LEFT JOIN looms l ON qc.loom_id = l.id
                    LEFT JOIN users u ON qc.user_id = u.id
                    WHERE qc.roll_no NOT IN (SELECT document_no FROM stock_movements WHERE document_no IS NOT NULL)
                    
                    UNION ALL
                    
                    SELECT 'ship' as act_type, s.id, s.created_at, p.name as product_name, p.code as product_code, 'mt' as product_unit, (SELECT SUM(length_m) FROM quality_controls WHERE shipment_id = s.id) as qty, 'cikis' as type, 
                           (SELECT SUM(weight_kg) FROM quality_controls WHERE shipment_id = s.id) as weight_kg,
                           'S-' || s.id as document_no, 'Sevkiyat' as info, '' as user_name, qc.product_id, c.name as customer_name,
                           '-' as loom_name
                    FROM shipments s
                    JOIN customers c ON s.customer_id = c.id
                    JOIN quality_controls qc ON qc.shipment_id = s.id
                    JOIN products p ON qc.product_id = p.id
                    WHERE ('S-' || s.id) NOT IN (SELECT document_no FROM stock_movements WHERE document_no IS NOT NULL)
                    GROUP BY s.id
                ) t
                WHERE $where
                ORDER BY created_at DESC LIMIT 500";
                
            $stmt = $db->prepare($sql);
            foreach ($params as $k => $v) $stmt->bindValue($k, $v);
            $result = $stmt->execute();
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                $rows[] = $row;
            }
            jsonResponse(['data' => $rows]);

        } elseif ($method === 'POST') {
            $input = $_POST;
            $productId = intval($input['product_id'] ?? 0);
            $type = sanitize($input['type'] ?? '');
            $quantity = floatval($input['quantity'] ?? 0);

            if (!$productId || !$type || $quantity <= 0) {
                jsonResponse(['error' => 'Ürün, hareket tipi ve miktar zorunludur'], 400);
            }

            // Mevcut stok
            $current = $db->querySingle("SELECT current_stock FROM products WHERE id = $productId");
            if ($current === false) jsonResponse(['error' => 'Ürün bulunamadı'], 404);

            $newStock = ($type === 'giris') ? $current + $quantity : $current - $quantity;
            if ($newStock < 0) {
                jsonResponse(['error' => 'Yetersiz stok! Mevcut: ' . $current], 400);
            }

            // Hareketi kaydet
            $stmt = $db->prepare("INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, document_no, description, user_id, created_at)
                VALUES (:pid, :type, :qty, :prev, :new, :doc, :desc, :uid, :now)");
            $stmt->bindValue(':pid', $productId, SQLITE3_INTEGER);
            $stmt->bindValue(':type', $type);
            $stmt->bindValue(':qty', $quantity);
            $stmt->bindValue(':prev', $current);
            $stmt->bindValue(':new', $newStock);
            $stmt->bindValue(':doc', sanitize($input['document_no'] ?? ''));
            $stmt->bindValue(':desc', sanitize($input['description'] ?? ''));
            $stmt->bindValue(':uid', $_SESSION['user_id'], SQLITE3_INTEGER);
            $stmt->bindValue(':now', date('Y-m-d H:i:s'));
            $stmt->execute();

            // Stoku güncelle
            $db->exec("UPDATE products SET current_stock = $newStock, updated_at = datetime('now') WHERE id = $productId");

            jsonResponse(['success' => true, 'new_stock' => $newStock]);
        }
        break;

    case 'activities':
        requireLogin();
        $db = getDB();
        $limit = intval($_GET['limit'] ?? 15);

        $sql = "
            SELECT * FROM (
                SELECT 'manual' as act_type, sm.id, sm.created_at, p.name as product_name, p.code as product_code, sm.quantity as qty, sm.type, sm.description as info, u.full_name as user_name
                FROM stock_movements sm 
                JOIN products p ON sm.product_id = p.id
                LEFT JOIN users u ON sm.user_id = u.id
                
                UNION ALL
                
                SELECT 'qc' as act_type, qc.id, qc.created_at, p.name as product_name, p.code as product_code, qc.length_m as qty, 'giris' as type, 'Top No: ' || qc.roll_no as info, u.full_name as user_name
                FROM quality_controls qc
                JOIN products p ON qc.product_id = p.id
                LEFT JOIN users u ON qc.user_id = u.id
                
                UNION ALL
                
                SELECT 'ship' as act_type, s.id, s.created_at, c.name as product_name, '' as product_code, (SELECT SUM(length_m) FROM quality_controls WHERE shipment_id = s.id) as qty, 'cikis' as type, 'Plaka: ' || s.plate_no as info, null as user_name
                FROM shipments s
                JOIN customers c ON s.customer_id = c.id
            ) 
            WHERE qty IS NOT NULL
            ORDER BY created_at DESC LIMIT :limit";
            
        $stmt = $db->prepare($sql);
        $stmt->bindValue(':limit', $limit, SQLITE3_INTEGER);
        $result = $stmt->execute();
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        jsonResponse(['data' => $rows]);
        break;

    // ═══════════════════════════════════════
    //  REFERANS VERİLER
    // ═══════════════════════════════════════
    case 'fabric_types':
        requireLogin();
        $db = getDB();
        if ($method === 'GET') {
            $result = $db->query("SELECT * FROM fabric_types WHERE is_active = 1 ORDER BY name");
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
            jsonResponse(['data' => $rows]);
        } elseif ($method === 'POST') {
            $name = sanitize($_POST['name'] ?? '');
            if (!$name) jsonResponse(['error' => 'İsim gerekli'], 400);
            $editId = intval($_POST['id'] ?? 0);
            if ($editId) {
                $stmt = $db->prepare("UPDATE fabric_types SET name=:n WHERE id=:id");
                $stmt->bindValue(':id', $editId, SQLITE3_INTEGER);
            } else {
                $stmt = $db->prepare("INSERT INTO fabric_types (name) VALUES (:n)");
            }
            $stmt->bindValue(':n', $name);
            $stmt->execute();
            jsonResponse(['success' => true]);
        }
        break;

    case 'defect_types':
        requireLogin();
        $db = getDB();
        if ($method === 'GET') {
            $result = $db->query("SELECT * FROM defect_types WHERE is_active = 1 ORDER BY name");
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
            jsonResponse(['data' => $rows]);
        } elseif ($method === 'POST') {
            $name = sanitize($_POST['name'] ?? '');
            if (!$name) jsonResponse(['error' => 'İsim gerekli'], 400);
            $editId = intval($_POST['id'] ?? 0);
            if ($editId) {
                $stmt = $db->prepare("UPDATE defect_types SET name=:n, code=:c, severity_default=:s WHERE id=:id");
                $stmt->bindValue(':id', $editId, SQLITE3_INTEGER);
            } else {
                $stmt = $db->prepare("INSERT INTO defect_types (name, code, severity_default) VALUES (:n, :c, :s)");
            }
            $stmt->bindValue(':n', $name);
            $stmt->bindValue(':c', sanitize($_POST['code'] ?? ''));
            $stmt->bindValue(':s', intval($_POST['severity_default'] ?? 1), SQLITE3_INTEGER);
            $stmt->execute();
            jsonResponse(['success' => true]);
        }
        break;

    case 'fabric_type_delete':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        $db = getDB();
        $db->exec("UPDATE fabric_types SET is_active = 0 WHERE id = $id");
        jsonResponse(['success' => true]);
        break;

    case 'defect_type_delete':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        $db = getDB();
        $db->exec("UPDATE defect_types SET is_active = 0 WHERE id = $id");
        jsonResponse(['success' => true]);
        break;

    // ═══════════════════════════════════════
    //  AYARLAR
    // ═══════════════════════════════════════
    case 'settings':
        requireLogin();
        $db = getDB();
        if ($method === 'GET') {
            $result = $db->query("SELECT * FROM settings");
            $settings = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                $settings[$row['key']] = $row['value'];
            }
            jsonResponse(['data' => $settings]);
        } elseif ($method === 'POST') {
            $data = $_POST;
            $isSuperAdmin = ($_SESSION['user_role'] === 'superadmin');
            foreach ($data as $key => $value) {
                if ($key === 'action') continue;
                $stmt = $db->prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (:k, :v)");
                $stmt->bindValue(':k', $key);
                $stmt->bindValue(':v', sanitize($value));
                $stmt->execute();
            }
            jsonResponse(['success' => true]);
        }
        break;

    // ═══════════════════════════════════════
    //  LİSANS YÖNETİMİ
    // ═══════════════════════════════════════
    case 'check_license':
        $license = checkLicense();
        $db = getDB();
        $resDate = $db->querySingle("SELECT value FROM settings WHERE key = 'license_end_date'");
        $resWarning = $db->querySingle("SELECT value FROM settings WHERE key = 'license_warning_days'");
        $license['end_date'] = $resDate ?: '';
        $license['warning_days'] = intval($resWarning ?: 7);
        jsonResponse($license);
        break;
        
    case 'set_license':
        requireLogin();
        if ($_SESSION['user_role'] !== 'superadmin') jsonResponse(['error' => 'Yetkiniz yok'], 403);
        
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) $data = $_POST;
        
        $endDate = $data['license_end_date'] ?? '';
        $startDate = $data['license_start_date'] ?? date('Y-m-d');
        $warningDays = intval($data['license_warning_days'] ?? 7);
        
        if (empty($endDate)) {
            jsonResponse(['error' => 'Lisans bitiş tarihi gerekli'], 400);
        }
        
        $db = getDB();
        $stmt = $db->prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_end_date', :v)");
        $stmt->bindValue(':v', $endDate);
        $stmt->execute();
        
        $stmt = $db->prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_start_date', :v)");
        $stmt->bindValue(':v', $startDate);
        $stmt->execute();
        
        $stmt = $db->prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_warning_days', :v)");
        $stmt->bindValue(':v', $warningDays, SQLITE3_INTEGER);
        $stmt->execute();
        
        jsonResponse(['success' => true, 'message' => 'Lisans güncellendi']);
        break;

    // ═══════════════════════════════════════
    //  KULLANICI YÖNETİMİ
    // ═══════════════════════════════════════
    case 'users':
        requireLogin();
        $db = getDB();
        if ($_SESSION['user_role'] !== 'admin' && $_SESSION['user_role'] !== 'superadmin') jsonResponse(['error' => 'Yetkiniz yok'], 403);

        if ($method === 'GET') {
            // Normal adminler 'root' kullanıcısını görmesin
            $where = "username != 'root'";
            if ($_SESSION['user_role'] === 'superadmin') {
                $where = "1=1";
            }
            $stmt = $db->prepare("SELECT id, username, full_name, role, permissions, is_active, created_at, last_login FROM users WHERE $where ORDER BY id");
            $result = $stmt->execute();
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
            jsonResponse(['data' => $rows]);
        } elseif ($method === 'POST') {
            $input = $_POST;
            $editId = intval($input['id'] ?? 0);

            if (empty($input['username']) || empty($input['full_name'])) {
                jsonResponse(['error' => 'Kullanıcı adı ve isim zorunludur'], 400);
            }

            if ($editId > 0) {
                $sql = "UPDATE users SET username=:u, full_name=:fn, role=:r, permissions=:p WHERE id=:id";
                $stmt = $db->prepare($sql);
                $stmt->bindValue(':id', $editId, SQLITE3_INTEGER);
                $stmt->bindValue(':u', sanitize($input['username']));
                $stmt->bindValue(':fn', sanitize($input['full_name']));
                $stmt->bindValue(':r', sanitize($input['role'] ?? 'operator'));
                $stmt->bindValue(':p', $input['permissions'] ?? '');
                $stmt->execute();

                if (!empty($input['password'])) {
                    $hash = password_hash($input['password'], PASSWORD_DEFAULT);
                    $stmtP = $db->prepare("UPDATE users SET password_hash = :h WHERE id = :id");
                    $stmtP->bindValue(':h', $hash);
                    $stmtP->bindValue(':id', $editId, SQLITE3_INTEGER);
                    $stmtP->execute();
                }
            } else {
                if (empty($input['password'])) jsonResponse(['error' => 'Şifre zorunludur'], 400);
                $hash = password_hash($input['password'], PASSWORD_DEFAULT);
                $stmt = $db->prepare("INSERT INTO users (username, password_hash, full_name, role, permissions) VALUES (:u, :p, :fn, :r, :perm)");
                $stmt->bindValue(':u', sanitize($input['username']));
                $stmt->bindValue(':p', $hash);
                $stmt->bindValue(':fn', sanitize($input['full_name']));
                $stmt->bindValue(':r', sanitize($input['role'] ?? 'operator'));
                $stmt->bindValue(':perm', $input['permissions'] ?? '');
                $stmt->execute();
            }
            jsonResponse(['success' => true]);
        }
        break;

    case 'messages':
        requireLogin();
        $db = getDB();
        $userId = $_SESSION['user_id'];

        if ($method === 'GET') {
            $limit = intval($_GET['limit'] ?? 50);
            $sql = "SELECT m.*, u.full_name as sender_name 
                    FROM messages m 
                    JOIN users u ON m.sender_id = u.id 
                    ORDER BY m.created_at DESC LIMIT :limit";
            $stmt = $db->prepare($sql);
            $stmt->bindValue(':limit', $limit, SQLITE3_INTEGER);
            $result = $stmt->execute();
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                $rows[] = $row;
            }
            // Reverse to get chronological order in chat
            jsonResponse(['data' => array_reverse($rows)]);
        } elseif ($method === 'POST') {
            $msg = sanitize($_POST['message'] ?? '');
            if (!$msg) jsonResponse(['error' => 'Mesaj boş olamaz'], 400);

            $stmt = $db->prepare("INSERT INTO messages (sender_id, message) VALUES (:s, :m)");
            $stmt->bindValue(':s', $userId, SQLITE3_INTEGER);
            $stmt->bindValue(':m', $msg);
            $stmt->execute();
            jsonResponse(['success' => true]);
        }
        break;

    case 'messages_read':
        requireLogin();
        $db = getDB();
        $db->exec("UPDATE messages SET is_read = 1 WHERE is_read = 0");
        jsonResponse(['success' => true]);
        break;

    case 'messages_clear':
        requireLogin();
        if ($_SESSION['user_role'] !== 'admin' && $_SESSION['user_role'] !== 'superadmin') jsonResponse(['error' => 'Yetkiniz yok'], 403);
        $db = getDB();
        $db->exec("DELETE FROM messages");
        $db->exec("VACUUM"); // Shrink db size
        jsonResponse(['success' => true]);
        break;

    case 'user_toggle':
        requireLogin();
        if ($_SESSION['user_role'] !== 'admin' && $_SESSION['user_role'] !== 'superadmin') jsonResponse(['error' => 'Yetkiniz yok'], 403);
        $id = intval($_POST['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        $db = getDB();
        $db->exec("UPDATE users SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = $id");
        jsonResponse(['success' => true]);
        break;

    // ═══════════════════════════════════════
    //  RAPORLAR
    // ═══════════════════════════════════════
    case 'report_quality':
        requireLogin();
        $db = getDB();
        $from = $_GET['from'] ?? date('Y-m-01');
        $to = $_GET['to'] ?? date('Y-m-d');

        // Karar dağılımı
        $stmt = $db->prepare("SELECT decision, COUNT(*) as count FROM quality_controls WHERE control_date BETWEEN :f AND :t GROUP BY decision");
        $stmt->bindValue(':f', $from);
        $stmt->bindValue(':t', $to);
        $result = $stmt->execute();
        $decisions = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $decisions[] = $row;

        // Hata tipi dağılımı
        $stmt = $db->prepare("SELECT dt.name, SUM(qd.count) as total, AVG(qd.severity) as avg_severity
            FROM quality_defects qd
            JOIN defect_types dt ON qd.defect_type_id = dt.id
            JOIN quality_controls qc ON qd.control_id = qc.id
            WHERE qc.control_date BETWEEN :f AND :t
            GROUP BY dt.name ORDER BY total DESC");
        $stmt->bindValue(':f', $from);
        $stmt->bindValue(':t', $to);
        $result = $stmt->execute();
        $defectTypeDist = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $defectTypeDist[] = $row;

        // Günlük trend
        $stmt = $db->prepare("SELECT DATE(control_date) as date, AVG(quality_score) as avg_score, COUNT(*) as count
            FROM quality_controls WHERE control_date BETWEEN :f AND :t
            GROUP BY DATE(control_date) ORDER BY date");
        $stmt->bindValue(':f', $from);
        $stmt->bindValue(':t', $to);
        $result = $stmt->execute();
        $dailyTrend = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $dailyTrend[] = $row;

        // Personel performansı
        $stmt = $db->prepare("SELECT inspector, COUNT(*) as count, AVG(quality_score) as avg_score
            FROM quality_controls WHERE control_date BETWEEN :f AND :t AND inspector != ''
            GROUP BY inspector ORDER BY count DESC");
        $stmt->bindValue(':f', $from);
        $stmt->bindValue(':t', $to);
        $result = $stmt->execute();
        $inspectors = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $inspectors[] = $row;

        jsonResponse([
            'decisions' => $decisions,
            'defect_types' => $defectTypeDist,
            'daily_trend' => $dailyTrend,
            'inspectors' => $inspectors,
            'period' => ['from' => $from, 'to' => $to]
        ]);
        break;

    case 'report_stock':
        requireLogin();
        $db = getDB();
        $from = $_GET['from'] ?? date('Y-m-01');
        $to = $_GET['to'] ?? date('Y-m-d');

        // Hareket özeti
        $stmt = $db->prepare("SELECT type, COUNT(*) as count, SUM(quantity) as total
            FROM stock_movements WHERE DATE(created_at) BETWEEN :f AND :t GROUP BY type");
        $stmt->bindValue(':f', $from);
        $stmt->bindValue(':t', $to);
        $result = $stmt->execute();
        $summary = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $summary[] = $row;

        // Ürün bazlı
        $stmt = $db->prepare("SELECT p.name, p.code,
            SUM(CASE WHEN sm.type='giris' THEN sm.quantity ELSE 0 END) as total_in,
            SUM(CASE WHEN sm.type='cikis' THEN sm.quantity ELSE 0 END) as total_out,
            p.current_stock, p.unit
            FROM stock_movements sm
            JOIN products p ON sm.product_id = p.id
            WHERE DATE(sm.created_at) BETWEEN :f AND :t
            GROUP BY p.id ORDER BY p.name");
        $stmt->bindValue(':f', $from);
        $stmt->bindValue(':t', $to);
        $result = $stmt->execute();
        $byProduct = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $byProduct[] = $row;

        jsonResponse([
            'summary' => $summary,
            'by_product' => $byProduct,
            'period' => ['from' => $from, 'to' => $to]
        ]);
        break;

    // ═══════════════════════════════════════
    //  EXPORT
    // ═══════════════════════════════════════
    case 'export_quality':
        requireLogin();
        $db = getDB();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="kalite_kontrol_' . date('Y-m-d') . '.csv"');
        $output = fopen('php://output', 'w');
        fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF)); // UTF-8 BOM
        fputcsv($output, ['ID', 'Top No', 'Parti No', 'Kumaş Tipi', 'Kontrol Tarihi', 'Kontrolcü', 'Hata Sayısı', 'Kalite Puanı', 'Karar', 'Notlar'], ';');

        $result = $db->query("SELECT qc.*, ft.name as fabric_type_name FROM quality_controls qc LEFT JOIN fabric_types ft ON qc.fabric_type_id = ft.id ORDER BY qc.control_date DESC");
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            fputcsv($output, [
                $row['id'], $row['roll_no'], $row['party_no'], $row['fabric_type_name'] ?? '',
                $row['control_date'], $row['inspector'], $row['total_defects'],
                $row['quality_score'], $row['decision'], $row['notes']
            ], ';');
        }
        fclose($output);
        exit;

    case 'export_stock':
        requireLogin();
        $db = getDB();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="stok_durumu_' . date('Y-m-d') . '.csv"');
        $output = fopen('php://output', 'w');
        fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));
        fputcsv($output, ['Kod', 'Ürün Adı', 'Kumaş Tipi', 'Birim', 'Mevcut Stok', 'Tedarikçi'], ';');

        $sql = "SELECT p.*, ft.name as fabric_type_name,
                (SELECT 
                    CASE 
                        WHEN p.unit = 'kg' THEN SUM(qc.weight_kg)
                        WHEN p.unit = 'metre' THEN SUM(qc.length_m)
                        ELSE COUNT(qc.id)
                    END
                 FROM quality_controls qc 
                 WHERE qc.product_id = p.id AND qc.shipment_id IS NULL
                ) as current_stock
                FROM products p 
                LEFT JOIN fabric_types ft ON p.fabric_type_id = ft.id 
                WHERE p.is_active = 1 
                ORDER BY p.name";
        $result = $db->query($sql);
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            fputcsv($output, [
                $row['code'], $row['name'], $row['fabric_type_name'] ?? '',
                $row['unit'], $row['current_stock'], $row['supplier']
            ], ';');
        }
        fclose($output);
        exit;

    case 'backup':
        requireLogin();
        if ($_SESSION['user_role'] !== 'admin') jsonResponse(['error' => 'Yetkiniz yok'], 403);
        $dbFile = DB_PATH;
        if (file_exists($dbFile)) {
            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename="dokuma_qc_yedek_' . date('Y-m-d_H-i') . '.db"');
            header('Content-Length: ' . filesize($dbFile));
            readfile($dbFile);
            exit;
        }
        jsonResponse(['error' => 'Veritabanı dosyası bulunamadı'], 404);
        break;
    case 'restore':
        requireLogin();
        if ($_SESSION['user_role'] !== 'admin') jsonResponse(['error' => 'Yetkiniz yok'], 403);
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        
        if (!isset($_FILES['backup_file'])) {
            jsonResponse(['error' => 'Dosya yüklenmedi'], 400);
        }
        
        $file = $_FILES['backup_file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            jsonResponse(['error' => 'Dosya yükleme hatası: ' . $file['error']], 500);
        }
        
        // SQLite dosyası olup olmadığını kontrol et (Opsiyonel)
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        if ($ext !== 'db' && $ext !== 'sqlite') {
            jsonResponse(['error' => 'Geçersiz dosya formatı. .db veya .sqlite gereklidir.'], 400);
        }
        
        $dbFile = DB_PATH;
        
        // Mevcut bağlantıyı kapatmak için (SQLite3 nesnesini null yaparak)
        // Ancak getDB() her seferinde yeni nesne döndürüyor olabilir.
        
        if (move_uploaded_file($file['tmp_name'], $dbFile)) {
            jsonResponse(['success' => true]);
        } else {
            jsonResponse(['error' => 'Dosya kaydedilemedi'], 500);
        }
        break;

    // ═══════════════════════════════════════
    //  SEVKİYAT (SHIPMENTS)
    // ═══════════════════════════════════════
    case 'shipments':
        requireLogin();
        $db = getDB();
        if ($method === 'GET') {
            $sql = "SELECT s.*, c.name as customer_name, o.order_no,
                    (SELECT COUNT(*) FROM quality_controls WHERE shipment_id = s.id) as roll_count,
                    (SELECT SUM(length_m) FROM quality_controls WHERE shipment_id = s.id) as total_meters,
                    (SELECT SUM(weight_kg) FROM quality_controls WHERE shipment_id = s.id) as total_weight,
                    (SELECT GROUP_CONCAT(code, ', ') FROM (SELECT DISTINCT p.code
                     FROM quality_controls qc
                     LEFT JOIN products p ON qc.product_id = p.id
                     WHERE qc.shipment_id = s.id)) as products_text
                    FROM shipments s 
                    LEFT JOIN customers c ON s.customer_id = c.id 
                    LEFT JOIN orders o ON s.order_id = o.id
                    ORDER BY s.shipment_date DESC, c.name ASC, s.id DESC";
            $result = $db->query($sql);
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
            jsonResponse(['data' => $rows]);
        } elseif ($method === 'POST') {
            $input = $_POST;
            $id = intval($input['id'] ?? 0);
            if ($id > 0) {
                if (isset($input['customer_id'])) {
                    $stmt = $db->prepare("UPDATE shipments SET customer_id=:cid, order_id=:oid, shipment_date=:sdate, shipping_address=:addr, plate_no=:plate, notes=:notes, status=:status WHERE id=:id");
                    $stmt->bindValue(':cid', intval($input['customer_id']));
                    $oid = !empty($input['order_id']) ? intval($input['order_id']) : null;
                    $stmt->bindValue(':oid', $oid, $oid ? SQLITE3_INTEGER : SQLITE3_NULL);
                    $stmt->bindValue(':sdate', sanitize($input['shipment_date']));
                    $stmt->bindValue(':addr', sanitize($input['shipping_address']));
                    $stmt->bindValue(':plate', sanitize($input['plate_no'] ?? ''));
                    $stmt->bindValue(':notes', sanitize($input['notes'] ?? ''));
                } else {
                    $stmt = $db->prepare("UPDATE shipments SET status=:status WHERE id=:id");
                }
                $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
            } else {
                $stmt = $db->prepare("INSERT INTO shipments (customer_id, order_id, shipment_date, shipping_address, plate_no, notes, status, created_at) 
                                      VALUES (:cid, :oid, :sdate, :addr, :plate, :notes, :status, :now)");
                $stmt->bindValue(':cid', intval($input['customer_id']));
                $oid = !empty($input['order_id']) ? intval($input['order_id']) : null;
                $stmt->bindValue(':oid', $oid, $oid ? SQLITE3_INTEGER : SQLITE3_NULL);
                $stmt->bindValue(':sdate', sanitize($input['shipment_date']));
                $stmt->bindValue(':addr', sanitize($input['shipping_address']));
                $stmt->bindValue(':plate', sanitize($input['plate_no'] ?? ''));
                $stmt->bindValue(':notes', sanitize($input['notes'] ?? ''));
            }
            $stmt->bindValue(':status', sanitize($input['status'] ?? 'hazırlanıyor'));
            $stmt->execute();
            $shipmentId = $id > 0 ? $id : $db->lastInsertRowID();
            jsonResponse(['success' => true, 'id' => $shipmentId], $id > 0 ? 200 : 201);
        }
        break;

    // ═══════════════════════════════════════
    //  SİPARİŞLER (ORDERS)
    // ═══════════════════════════════════════
    case 'orders':
        requireLogin();
        $db = getDB();
        if ($method === 'GET') {
            $customer_id = intval($_GET['customer_id'] ?? 0);
            $status = sanitize($_GET['status'] ?? '');
            
            $where = "1=1";
            if ($customer_id > 0) $where .= " AND o.customer_id = :cid";
            if ($status) $where .= " AND o.status = :status";
            
            $sql = "SELECT o.*, c.name as customer_name, p.name as product_name, p.code as product_code,
                    (SELECT COALESCE(SUM(length_m), 0) FROM quality_controls qc JOIN shipments s ON qc.shipment_id = s.id WHERE s.order_id = o.id) as shipped_m,
            (SELECT COALESCE(SUM(length_m), 0) FROM quality_controls qc WHERE qc.order_id = o.id AND qc.shipment_id IS NULL) as ready_m
                    FROM orders o
                    LEFT JOIN customers c ON o.customer_id = c.id
                    LEFT JOIN products p ON o.product_id = p.id
                    WHERE $where
                    ORDER BY o.deadline_date ASC, o.id DESC";
            
            $stmt = $db->prepare($sql);
            if ($customer_id > 0) $stmt->bindValue(':cid', $customer_id, SQLITE3_INTEGER);
            if ($status) $stmt->bindValue(':status', $status);
            $result = $stmt->execute();
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
            jsonResponse(['data' => $rows]);
            
        } elseif ($method === 'POST') {
            $id = intval($_POST['id'] ?? 0);
            $order_no = sanitize($_POST['order_no'] ?? '');
            $customer_id = intval($_POST['customer_id'] ?? 0);
            $product_id = intval($_POST['product_id'] ?? 0);
            $order_date = sanitize($_POST['order_date'] ?? date('Y-m-d'));
            $deadline_date = sanitize($_POST['deadline_date'] ?? '');
            $quantity_m = floatval($_POST['quantity_m'] ?? 0);
            $status = sanitize($_POST['status'] ?? 'Açık');
            $notes = sanitize($_POST['notes'] ?? '');
            
            if (!$order_no || !$customer_id || !$product_id) {
                if ($id > 0 && $status) {
                    $stmtU = $db->prepare("UPDATE orders SET status=:s, updated_at=datetime('now') WHERE id=:id");
                    $stmtU->bindValue(':s', $status);
                    $stmtU->bindValue(':id', $id, SQLITE3_INTEGER);
                    $stmtU->execute();
                    jsonResponse(['success' => true]);
                    return;
                }
                jsonResponse(['error' => 'Sipariş No, Müşteri ve Ürün zorunludur'], 400);
            }

            if ($id > 0) {
                $stmt = $db->prepare("UPDATE orders SET order_no=:on, customer_id=:cid, product_id=:pid, order_date=:od, deadline_date=:dd, quantity_m=:q, status=:s, notes=:n, updated_at=datetime('now') WHERE id=:id");
                $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
            } else {
                $stmt = $db->prepare("INSERT INTO orders (order_no, customer_id, product_id, order_date, deadline_date, quantity_m, status, notes) VALUES (:on, :cid, :pid, :od, :dd, :q, :s, :n)");
            }
            $stmt->bindValue(':on', $order_no);
            $stmt->bindValue(':cid', $customer_id);
            $stmt->bindValue(':pid', $product_id);
            $stmt->bindValue(':od', $order_date);
            $stmt->bindValue(':dd', $deadline_date);
            $stmt->bindValue(':q', $quantity_m);
            $stmt->bindValue(':s', $status);
            $stmt->bindValue(':n', $notes);
            $stmt->execute();
            jsonResponse(['success' => true]);
        } elseif ($method === 'DELETE') {
            $data = json_decode(file_get_contents('php://input'), true);
            $id = intval($data['id'] ?? 0);
            if (!$id) jsonResponse(['error' => 'ID required'], 400);
            $stmtD = $db->prepare("DELETE FROM orders WHERE id = :id");
            $stmtD->bindValue(':id', $id, SQLITE3_INTEGER);
            $stmtD->execute();
            jsonResponse(['success' => true]);
        }
        break;

    case 'order_card':
        requireLogin();
        $db = getDB();
        $id = intval($_GET['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);

        // Order + customer + product
        $stmt = $db->prepare("SELECT o.*, c.name as customer_name, p.name as product_name, p.code as product_code,
            (SELECT COALESCE(SUM(length_m), 0) FROM quality_controls qc JOIN shipments s ON qc.shipment_id = s.id WHERE s.order_id = o.id) as shipped_m,
            (SELECT COALESCE(SUM(length_m), 0) FROM quality_controls qc WHERE qc.order_id = o.id AND qc.shipment_id IS NULL) as ready_m
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            LEFT JOIN products p ON o.product_id = p.id
            WHERE o.id = :id");
        $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
        $order = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
        if (!$order) jsonResponse(['error' => 'Sipariş bulunamadı'], 404);

        // Assigned looms
        $stmtL = $db->prepare("SELECT id, name, status, customer_id, product_id FROM looms WHERE order_id = :id");
        $stmtL->bindValue(':id', $id, SQLITE3_INTEGER);
        $looms = [];
        $resL = $stmtL->execute();
        while ($row = $resL->fetchArray(SQLITE3_ASSOC)) $looms[] = $row;

        // Production summary per loom
        $stmtP = $db->prepare("SELECT l.id as loom_id, l.name as loom_name,
            COALESCE(SUM(de.meters), 0) as total_meters,
            COALESCE(SUM(de.hours), 0) as total_hours,
            COALESCE(AVG(de.efficiency), 0) as avg_efficiency
            FROM looms l
            LEFT JOIN loom_daily_entries de ON de.loom_id = l.id
            WHERE l.order_id = :id2
            GROUP BY l.id");
        $stmtP->bindValue(':id2', $id, SQLITE3_INTEGER);
        $prod = [];
        $resP = $stmtP->execute();
        while ($row = $resP->fetchArray(SQLITE3_ASSOC)) $prod[] = $row;

        // QC records (production rolls for this order)
        $stmtQc = $db->prepare("SELECT qc.*, l.name as loom_name FROM quality_controls qc LEFT JOIN looms l ON qc.loom_id = l.id WHERE qc.order_id = :id3 ORDER BY qc.control_date DESC");
        $stmtQc->bindValue(':id3', $id, SQLITE3_INTEGER);
        $qcRecords = [];
        $resQc = $stmtQc->execute();
        while ($row = $resQc->fetchArray(SQLITE3_ASSOC)) $qcRecords[] = $row;

        // QC summary
        $stmtQ = $db->prepare("SELECT COUNT(*) as qc_count, COALESCE(AVG(qc.quality_score), 0) as avg_score, COALESCE(SUM(qc.length_m), 0) as total_meters FROM quality_controls qc WHERE qc.order_id = :id");
        $stmtQ->bindValue(':id', $id, SQLITE3_INTEGER);
        $qcSummary = $stmtQ->execute()->fetchArray(SQLITE3_ASSOC);

        jsonResponse(['data' => [
            'order' => $order,
            'looms' => $looms,
            'production' => $prod,
            'qc_records' => $qcRecords,
            'qc_summary' => $qcSummary
        ]]);
        break;

    case 'shipment_details':
        requireLogin();
        $db = getDB();
        $id = intval($_GET['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        
        $stmtS = $db->prepare("SELECT s.*, c.name as customer_name FROM shipments s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id = :id");
        $stmtS->bindValue(':id', $id, SQLITE3_INTEGER);
        $shipment = $stmtS->execute()->fetchArray(SQLITE3_ASSOC);
        if (!$shipment) jsonResponse(['error' => 'Sevkiyat bulunamadı'], 404);
        
        $stmtI = $db->prepare("SELECT qc.*, p.name as product_name, p.code as product_code, l.name as loom_name
                                FROM quality_controls qc 
                                LEFT JOIN products p ON qc.product_id = p.id 
                                LEFT JOIN looms l ON qc.loom_id = l.id
                                WHERE qc.shipment_id = :id 
                                ORDER BY qc.roll_no ASC");
        $stmtI->bindValue(':id', $id, SQLITE3_INTEGER);
        $itemsRes = $stmtI->execute();
        $items = [];
        while ($row = $itemsRes->fetchArray(SQLITE3_ASSOC)) $items[] = $row;
        
        jsonResponse(['data' => ['shipment' => $shipment, 'items' => $items]]);
        break;

    case 'shipment_add_rolls':
        requireLogin();
        $db = getDB();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $shipmentId = intval($_POST['shipment_id'] ?? 0);
        $rollIds = json_decode($_POST['roll_ids'] ?? '[]', true);
        
        if (!$shipmentId) jsonResponse(['error' => 'Geçersiz veri'], 400);
        
        // Önce bu sevkiyattaki mevcut topları boşa çıkar (güncelleme durumunda)
        $stmtU = $db->prepare("UPDATE quality_controls SET shipment_id = NULL WHERE shipment_id = :id");
        $stmtU->bindValue(':id', $shipmentId, SQLITE3_INTEGER);
        $stmtU->execute();
        
        if (!empty($rollIds)) {
            $idsStr = implode(',', array_map('intval', $rollIds));
            // idsStr is safe because we map to intval
            $db->exec("UPDATE quality_controls SET shipment_id = $shipmentId WHERE id IN ($idsStr)");
        }
        jsonResponse(['success' => true]);
        break;

    case 'depo_giris':
        requireLogin();
        $db = getDB();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        
        $control_date = $_POST['control_date'] ?? date('Y-m-d');
        
        // Sunucu tarafında barkod üret
        $barcode = generateBarcode('external');
        if (!$barcode) jsonResponse(['error' => 'Barkod üretilemedi'], 500);

        $stmt = $db->prepare("INSERT INTO quality_controls (roll_no, product_id, length_m, weight_kg, party_no, notes, inspector, user_id, control_date, is_external, quality_score, decision, customer_id, barcode, order_id, created_at) VALUES (:roll, :prod, :len, :kg, :party, :notes, :insp, :uid, :cdate, 1, 100, '1. Kalite', :cid, :barcode, :oid, :now)");
        $stmt->bindValue(':roll', $barcode);
        $stmt->bindValue(':prod', $_POST['product_id'] ?? null);
        $stmt->bindValue(':len', $_POST['length_m'] ?? 0);
        $stmt->bindValue(':kg', $_POST['weight_kg'] ?? 0);
        $stmt->bindValue(':party', $_POST['party_no'] ?? '');
        $stmt->bindValue(':notes', $_POST['notes'] ?? '');
        $stmt->bindValue(':insp', $_SESSION['user']['full_name']);
        $stmt->bindValue(':uid', $_SESSION['user']['id']);
        $stmt->bindValue(':cdate', $control_date);
        $stmt->bindValue(':cid', $_POST['customer_id'] ?? null);
        $stmt->bindValue(':barcode', $barcode);
        $stmt->bindValue(':oid', $_POST['order_id'] ?? null);
        $stmt->bindValue(':now', date('Y-m-d H:i:s'));
        $stmt->execute();
        
        // Stok hareketini işle
        $prodId = intval($_POST['product_id'] ?? 0);
        $qty = floatval($_POST['length_m'] ?? 0);
        if ($prodId && $qty > 0) {
            $p = $db->querySingle("SELECT current_stock FROM products WHERE id = $prodId", true);
            $prev = $p ? floatval($p['current_stock']) : 0;
            $next = $prev + $qty;
            
            $db->exec("UPDATE products SET current_stock = $next WHERE id = $prodId");
            
            $sm = $db->prepare("INSERT INTO stock_movements (product_id, type, quantity, previous_stock, new_stock, document_no, description, act_type, user_id) 
                               VALUES (:pid, 'giris', :qty, :prev, :next, :doc, :info, 'external', :uid)");
            $sm->bindValue(':pid', $prodId);
            $sm->bindValue(':qty', $qty);
            $sm->bindValue(':prev', $prev);
            $sm->bindValue(':next', $next);
            $sm->bindValue(':doc', $_POST['roll_no'] ?? '');
            $sm->bindValue(':info', 'Dış Üretim/Alım Girişi');
            $sm->bindValue(':uid', $_SESSION['user']['id']);
            $sm->execute();
        }
        
        jsonResponse(['success' => true]);
        break;

    case 'recent_depo_giris':
        requireLogin();
        $db = getDB();
        $stmt = $db->prepare("
            SELECT q.*, p.name as product_name, p.code as product_code, c.name as supplier_name, o.order_no as order_no
            FROM quality_controls q
            LEFT JOIN products p ON q.product_id = p.id
            LEFT JOIN customers c ON q.customer_id = c.id
            LEFT JOIN orders o ON q.order_id = o.id
            WHERE q.is_external = 1 AND q.shipment_id IS NULL
            ORDER BY q.id DESC LIMIT 500
        ");
        $res = $stmt->execute();
        $data = [];
        while ($row = $res->fetchArray(SQLITE3_ASSOC)) {
            $data[] = $row;
        }
        jsonResponse(['data' => $data]);
        break;

    case 'depo_giris_delete':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        $ids = $_POST['ids'] ?? '';
        $db = getDB();
        
        if ($ids) {
            $idsArr = array_map('intval', explode(',', $ids));
            $idsStr = implode(',', $idsArr);
            $db->exec("DELETE FROM quality_controls WHERE id IN ($idsStr) AND is_external = 1");
        } elseif ($id) {
            $db->exec("DELETE FROM quality_controls WHERE id = $id AND is_external = 1");
        } else {
            jsonResponse(['error' => 'ID veya IDs gerekli'], 400);
        }
        jsonResponse(['success' => true]);
        break;

    case 'shipment_delete':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        $db = getDB();
        $db->exec("UPDATE quality_controls SET shipment_id = NULL WHERE shipment_id = $id");
        $db->exec("DELETE FROM shipments WHERE id = $id");
        jsonResponse(['success' => true]);
        break;

    case 'stock_rolls':
        requireLogin();
        $db = getDB();
        $id = intval($_GET['shipment_id'] ?? 0);
        $where = "qc.shipment_id IS NULL";
        if ($id > 0) {
            $where = "(qc.shipment_id IS NULL OR qc.shipment_id = $id)";
        }
        // Stokta olan (sevk edilmemiş veya bu sevkiyata ait olan) topları getir
        $sql = "SELECT qc.id, qc.roll_no, COALESCE(qc.lot_no, qc.party_no) as lot_no, qc.length_m, qc.weight_kg, qc.barcode,
                       p.name as product_name, p.code as product_code,
                       o.order_no, c.name as customer_name
                FROM quality_controls qc 
                LEFT JOIN products p ON qc.product_id = p.id 
                LEFT JOIN orders o ON qc.order_id = o.id
                LEFT JOIN customers c ON o.customer_id = c.id
                WHERE $where 
                ORDER BY qc.created_at DESC";
        $result = $db->query($sql);
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        jsonResponse(['data' => $rows]);
        break;

    case 'boss_reports':
        requireLogin();
        $db = getDB();
        $from = $_GET['from'] ?? date('Y-m-01');
        $to = $_GET['to'] ?? date('Y-m-d');

        // 1. Üretim Özeti (Kalite Kontrol)
        $prod = $db->querySingle("SELECT COUNT(*) as count, SUM(length_m) as meters, SUM(weight_kg) as weight, AVG(quality_score) as avg_score FROM quality_controls WHERE is_external = 0 AND control_date BETWEEN '$from' AND '$to'", true);

        // 2. Sevkiyat Özeti
        $ship = $db->querySingle("SELECT COUNT(*) as count FROM shipments WHERE shipment_date BETWEEN '$from' AND '$to'", true);
        $shipStats = $db->querySingle("SELECT SUM(qc.length_m) as meters, SUM(qc.weight_kg) as weight 
                                       FROM quality_controls qc 
                                       JOIN shipments s ON qc.shipment_id = s.id 
                                       WHERE s.shipment_date BETWEEN '$from' AND '$to'", true);

        // 3. Stok Özeti (Fiziksel Stok - Kalite Kontrolden)
        $stockMeters = $db->querySingle("SELECT SUM(length_m) as total FROM quality_controls WHERE shipment_id IS NULL", true);
        $stockKg = $db->querySingle("SELECT SUM(weight_kg) as total_kg FROM quality_controls WHERE shipment_id IS NULL", true);
        $stockCount = $db->querySingle("SELECT COUNT(*) as total_rolls FROM quality_controls WHERE shipment_id IS NULL", true);

        $topStock = [];
        $res = $db->query("SELECT p.name, SUM(qc.length_m) as qty 
                           FROM quality_controls qc 
                           JOIN products p ON qc.product_id = p.id 
                           WHERE qc.shipment_id IS NULL 
                           GROUP BY p.id 
                           ORDER BY qty DESC 
                           LIMIT 10");
        while($r = $res->fetchArray(SQLITE3_ASSOC)) $topStock[] = $r;

        // 4. Tezgah Özeti
        $loomCount = $db->querySingle("SELECT COUNT(*) FROM looms WHERE is_active = 1", true)['COUNT(*)'];
        $loomProd = $db->querySingle("SELECT SUM(meters) as total FROM loom_daily_entries WHERE date BETWEEN '$from' AND '$to'", true);
        
        $loomStatuses = [];
        $res = $db->query("SELECT status, COUNT(*) as count FROM looms WHERE is_active = 1 GROUP BY status");
        while($r = $res->fetchArray(SQLITE3_ASSOC)) $loomStatuses[] = $r;

        $looms = [];
        $res = $db->query("SELECT l.name, l.status, l.current_meters, l.daily_meters, l.rpm, p.density as product_density,
                            (SELECT efficiency FROM loom_daily_entries WHERE loom_id = l.id ORDER BY created_at DESC LIMIT 1) as last_efficiency
                            FROM looms l 
                            LEFT JOIN products p ON l.product_id = p.id
                            WHERE l.is_active = 1");
        while($r = $res->fetchArray(SQLITE3_ASSOC)) $looms[] = $r;

        // 5. En Çok Sevk Edilen Müşteriler
        $topCustomers = [];
        $res = $db->query("SELECT c.name, SUM(qc.length_m) as total_mt FROM quality_controls qc JOIN shipments s ON qc.shipment_id = s.id JOIN customers c ON s.customer_id = c.id WHERE s.shipment_date BETWEEN '$from' AND '$to' GROUP BY c.id ORDER BY total_mt DESC LIMIT 5");
        while($r = $res->fetchArray(SQLITE3_ASSOC)) $topCustomers[] = $r;

        // 6. Günlük Üretim Trendi
        $trend = [];
        $res = $db->query("SELECT control_date as label, SUM(length_m) as value FROM quality_controls WHERE is_external = 0 AND control_date BETWEEN '$from' AND '$to' GROUP BY control_date ORDER BY control_date ASC");
        while($r = $res->fetchArray(SQLITE3_ASSOC)) $trend[] = $r;

        jsonResponse([
            'stats' => [
                'production' => [
                    'rolls' => $prod['count'] ?? 0,
                    'meters' => $prod['meters'] ?? 0,
                    'weight' => $prod['weight'] ?? 0,
                    'quality' => round($prod['avg_score'] ?? 0, 1)
                ],
                'shipment' => [
                    'count' => $ship['count'] ?? 0,
                    'meters' => $shipStats['meters'] ?? 0,
                    'weight' => $shipStats['weight'] ?? 0
                ],
                'stock' => [
                    'total_meters' => $stockMeters['total'] ?? 0,
                    'total_kg' => $stockKg['total_kg'] ?? 0,
                    'total_rolls' => $stockCount['total_rolls'] ?? 0
                ],
                'looms' => [
                    'count' => $loomCount,
                    'total_meters' => $loomProd['total'] ?? 0,
                    'status_distribution' => $loomStatuses,
                    'list' => $looms
                ]
            ],
            'top_customers' => $topCustomers,
            'top_stock' => $topStock,
            'trend' => $trend
        ]);
        break;

    case 'toggle_warp_spare':
        requireLogin();
        $db = getDB();
        $id = intval($_POST['id'] ?? 0);
        if ($id > 0) {
            $current = $db->querySingle("SELECT warp_spare_status FROM looms WHERE id = $id");
            $next = 'Yok';
            if ($current === 'Yok' || empty($current)) $next = 'Hazırlanıyor';
            elseif ($current === 'Hazırlanıyor') $next = 'Hazır';
            else $next = 'Yok';
            
            $stmt = $db->prepare("UPDATE looms SET warp_spare_status = :next, updated_at = datetime('now') WHERE id = :id");
            $stmt->bindValue(':next', $next);
            $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
            $stmt->execute();
            jsonResponse(['success' => true, 'new_status' => $next]);
        }
        break;

    case 'toggle_loom_status':
        requireLogin();
        $db = getDB();
        $id = intval($_POST['id'] ?? 0);
        if ($id > 0) {
            $current = $db->querySingle("SELECT status FROM looms WHERE id = $id");
            $cycle = ['çalışıyor' => 'durdu', 'durdu' => 'bekliyor', 'bekliyor' => 'arıza', 'arıza' => 'çalışıyor'];
            $next = $cycle[$current] ?? 'çalışıyor';
            $stmt = $db->prepare("UPDATE looms SET status = :next, updated_at = datetime('now') WHERE id = :id");
            $stmt->bindValue(':next', $next);
            $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
            $stmt->execute();
            jsonResponse(['success' => true, 'new_status' => $next]);
        }
        break;

    case 'program_buyers':
        requireLogin();
        if ($_SESSION['user_role'] !== 'superadmin') jsonResponse(['error' => 'Yetkiniz yok'], 403);
        $db = getDB();
        if ($method === 'GET') {
            $result = $db->query("SELECT * FROM program_buyers ORDER BY created_at DESC");
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
            jsonResponse(['data' => $rows]);
        } elseif ($method === 'POST') {
            $id = intval($_POST['id'] ?? 0);
            $customerName = sanitize($_POST['customer_name'] ?? '');
            $internalStart = sanitize($_POST['internal_barcode_start'] ?? '');
            $externalStart = sanitize($_POST['external_barcode_start'] ?? '');
            $saleDate = sanitize($_POST['sale_date'] ?? date('Y-m-d'));
            $notes = sanitize($_POST['notes'] ?? '');
            
            if (!$customerName) jsonResponse(['error' => 'Müşteri adı zorunlu'], 400);
            
            if ($id > 0) {
                $stmt = $db->prepare("UPDATE program_buyers SET customer_name=:n, internal_barcode_start=:i, external_barcode_start=:e, sale_date=:d, notes=:notes WHERE id=:id");
                $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
            } else {
                $stmt = $db->prepare("INSERT INTO program_buyers (customer_name, internal_barcode_start, external_barcode_start, sale_date, notes) VALUES (:n, :i, :e, :d, :notes)");
            }
            $stmt->bindValue(':n', $customerName);
            $stmt->bindValue(':i', $internalStart);
            $stmt->bindValue(':e', $externalStart);
            $stmt->bindValue(':d', $saleDate);
            $stmt->bindValue(':notes', $notes);
            $stmt->execute();
            jsonResponse(['success' => true]);
        }
        break;
        
    case 'program_buyer_delete':
        requireLogin();
        if ($_SESSION['user_role'] !== 'superadmin') jsonResponse(['error' => 'Yetkiniz yok'], 403);
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        $db = getDB();
        $db->exec("DELETE FROM program_buyers WHERE id = $id");
        jsonResponse(['success' => true]);
        break;

    // ═══════════════════════════════════════
    //  KARTELA TAKİP (Kumaş Numune Kartı)
    // ═══════════════════════════════════════
    case 'kartelas':
        requireLogin();
        $db = getDB();

        if ($method === 'GET') {
            $search = $_GET['search'] ?? '';
            $status = $_GET['status'] ?? '';
            $customerId = $_GET['customer_id'] ?? '';
            $productId = $_GET['product_id'] ?? '';

            $where = "k.is_active = 1";
            $params = [];
            if ($search) {
                $where .= " AND (k.kartela_no LIKE :s OR k.location LIKE :s OR k.notes LIKE :s OR c.name LIKE :s OR p.name LIKE :s OR p.code LIKE :s)";
                $params[':s'] = '%' . $search . '%';
            }
            if ($status) { $where .= " AND k.status = :st"; $params[':st'] = $status; }
            if ($customerId) { $where .= " AND k.customer_id = :cid"; $params[':cid'] = intval($customerId); }
            if ($productId) { $where .= " AND k.product_id = :pid"; $params[':pid'] = intval($productId); }

            $sql = "SELECT k.*, p.code as product_code, p.name as product_name,
                    ft.name as fabric_type_name, c.name as customer_name,
                    (SELECT COUNT(*) FROM kartela_history kh WHERE kh.kartela_id = k.id) as history_count
                    FROM kartelas k
                    LEFT JOIN products p ON k.product_id = p.id
                    LEFT JOIN fabric_types ft ON k.fabric_type_id = ft.id
                    LEFT JOIN customers c ON k.customer_id = c.id
                    WHERE $where
                    ORDER BY k.id DESC";
            $stmt = $db->prepare($sql);
            foreach ($params as $k => $v) $stmt->bindValue($k, $v);
            $result = $stmt->execute();
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
            jsonResponse(['data' => $rows]);

        } elseif ($method === 'POST') {
            $editId = intval($_POST['id'] ?? 0);
            $kartelaNo = trim($_POST['kartela_no'] ?? '');
            $status = sanitize($_POST['status'] ?? 'fabrikada');
            $validStatuses = ['fabrikada', 'musteride', 'iade_edildi', 'onaylandi', 'reddedildi', 'kayip'];
            if (!in_array($status, $validStatuses)) $status = 'fabrikada';

            if ($editId > 0) {
                $stmt = $db->prepare("UPDATE kartelas SET kartela_no=:no, product_id=:pid, fabric_type_id=:ftid,
                    customer_id=:cid, status=:st, location=:loc, sample_count=:cnt,
                    send_date=:sd, return_date=:rd, notes=:notes, updated_at=datetime('now')
                    WHERE id=:id");
                $stmt->bindValue(':id', $editId, SQLITE3_INTEGER);
            } else {
                if (empty($kartelaNo)) {
                    $kartelaNo = generateKartelaBarcode();
                    if (!$kartelaNo) jsonResponse(['error' => 'Kartela numarası üretilemedi'], 500);
                }
                $stmt = $db->prepare("INSERT INTO kartelas (kartela_no, product_id, fabric_type_id, customer_id,
                    status, location, sample_count, send_date, return_date, notes, created_by)
                    VALUES (:no, :pid, :ftid, :cid, :st, :loc, :cnt, :sd, :rd, :notes, :uid)");
                $stmt->bindValue(':uid', $_SESSION['user_id'], SQLITE3_INTEGER);
            }

            $stmt->bindValue(':no', sanitize($kartelaNo));
            $stmt->bindValue(':pid', intval($_POST['product_id'] ?? 0) ?: null);
            $stmt->bindValue(':ftid', intval($_POST['fabric_type_id'] ?? 0) ?: null);
            $stmt->bindValue(':cid', intval($_POST['customer_id'] ?? 0) ?: null);
            $stmt->bindValue(':st', $status);
            $stmt->bindValue(':loc', sanitize($_POST['location'] ?? ''));
            $stmt->bindValue(':cnt', intval($_POST['sample_count'] ?? 1) ?: 1);
            $stmt->bindValue(':sd', sanitize($_POST['send_date'] ?? '') ?: null);
            $stmt->bindValue(':rd', sanitize($_POST['return_date'] ?? '') ?: null);
            $stmt->bindValue(':notes', sanitize($_POST['notes'] ?? ''));
            $stmt->execute();

            $newId = $editId > 0 ? $editId : $db->lastInsertRowID();

            // Yeni kayıtta başlangıç durumu geçmişe işlenir
            if ($editId === 0) {
                $stmtH = $db->prepare("INSERT INTO kartela_history (kartela_id, status, date, notes, user_id) VALUES (:kid, :st, :d, :n, :uid)");
                $stmtH->bindValue(':kid', $newId, SQLITE3_INTEGER);
                $stmtH->bindValue(':st', $status);
                $stmtH->bindValue(':d', date('Y-m-d'));
                $stmtH->bindValue(':n', sanitize($_POST['notes'] ?? ''));
                $stmtH->bindValue(':uid', $_SESSION['user_id'], SQLITE3_INTEGER);
                $stmtH->execute();
            }

            jsonResponse(['success' => true, 'id' => $newId, 'kartela_no' => $kartelaNo]);
        }
        break;

    case 'kartela_delete':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        $db = getDB();
        $db->exec("UPDATE kartelas SET is_active = 0 WHERE id = $id");
        jsonResponse(['success' => true]);
        break;

    case 'kartela_status_update':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        $status = sanitize($_POST['status'] ?? '');
        $validStatuses = ['fabrikada', 'musteride', 'iade_edildi', 'onaylandi', 'reddedildi', 'kayip'];
        if (!in_array($status, $validStatuses)) jsonResponse(['error' => 'Geçersiz durum'], 400);
        $date = sanitize($_POST['date'] ?? date('Y-m-d'));
        $notes = sanitize($_POST['notes'] ?? '');
        $db = getDB();

        $stmt = $db->prepare("UPDATE kartelas SET status=:st,
            send_date = CASE WHEN :st = 'musteride' AND :sd != '' THEN :sd ELSE send_date END,
            return_date = CASE WHEN :st IN ('iade_edildi','onaylandi','reddedildi') AND :rd != '' THEN :rd ELSE return_date END,
            updated_at=datetime('now') WHERE id=:id");
        $stmt->bindValue(':st', $status);
        $stmt->bindValue(':sd', $date);
        $stmt->bindValue(':rd', $date);
        $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
        $stmt->execute();

        $stmtH = $db->prepare("INSERT INTO kartela_history (kartela_id, status, date, notes, user_id) VALUES (:kid, :st, :d, :n, :uid)");
        $stmtH->bindValue(':kid', $id, SQLITE3_INTEGER);
        $stmtH->bindValue(':st', $status);
        $stmtH->bindValue(':d', $date);
        $stmtH->bindValue(':n', $notes);
        $stmtH->bindValue(':uid', $_SESSION['user_id'], SQLITE3_INTEGER);
        $stmtH->execute();

        jsonResponse(['success' => true]);
        break;

    case 'kartela_history':
        requireLogin();
        $id = intval($_GET['kartela_id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'kartela_id gerekli'], 400);
        $db = getDB();
        $stmt = $db->prepare("SELECT kh.*, u.full_name as user_name
            FROM kartela_history kh
            LEFT JOIN users u ON kh.user_id = u.id
            WHERE kh.kartela_id = :id ORDER BY kh.created_at DESC, kh.id DESC");
        $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
        $result = $stmt->execute();
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        jsonResponse(['data' => $rows]);
        break;

    case 'kartela_stats':
        requireLogin();
        $db = getDB();
        $result = $db->query("SELECT status, COUNT(*) as count FROM kartelas WHERE is_active = 1 GROUP BY status");
        $counts = ['fabrikada' => 0, 'musteride' => 0, 'iade_edildi' => 0, 'onaylandi' => 0, 'reddedildi' => 0, 'kayip' => 0];
        $total = 0;
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            if (isset($counts[$row['status']])) $counts[$row['status']] = intval($row['count']);
            $total += intval($row['count']);
        }
        $counts['toplam'] = $total;
        jsonResponse($counts);
        break;

    case 'export_kartela':
        requireLogin();
        $db = getDB();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="kartela_listesi_' . date('Y-m-d') . '.csv"');
        $output = fopen('php://output', 'w');
        fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF)); // UTF-8 BOM
        fputcsv($output, ['ID', 'Kartela No', 'Ürün', 'Kumaş Tipi', 'Müşteri', 'Durum', 'Konum', 'Numune Adedi', 'Gönderim Tarihi', 'İade Tarihi', 'Notlar', 'Oluşturma'], ';');

        $sql = "SELECT k.*, p.code as product_code, p.name as product_name,
                ft.name as fabric_type_name, c.name as customer_name
                FROM kartelas k
                LEFT JOIN products p ON k.product_id = p.id
                LEFT JOIN fabric_types ft ON k.fabric_type_id = ft.id
                LEFT JOIN customers c ON k.customer_id = c.id
                WHERE k.is_active = 1 ORDER BY k.id DESC";
        $result = $db->query($sql);
        $statusLabels = ['fabrikada' => 'Fabrikada', 'musteride' => 'Müşteride', 'iade_edildi' => 'İade Edildi', 'onaylandi' => 'Onaylandı', 'reddedildi' => 'Reddedildi', 'kayip' => 'Kayıp'];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            fputcsv($output, [
                $row['id'], $row['kartela_no'],
                ($row['product_code'] ? $row['product_code'] . ' - ' : '') . ($row['product_name'] ?? ''),
                $row['fabric_type_name'] ?? '', $row['customer_name'] ?? '',
                $statusLabels[$row['status']] ?? $row['status'], $row['location'] ?? '',
                $row['sample_count'], $row['send_date'] ?? '', $row['return_date'] ?? '',
                $row['notes'] ?? '', $row['created_at']
            ], ';');
        }
        fclose($output);
        exit;

    // ═══════════════════════════════════════
    //  İPLİK STOK (Giriş/Çıkış Takibi)
    // ═══════════════════════════════════════
    case 'yarns':
        requireLogin();
        $db = getDB();

        if ($method === 'GET') {
            $search = $_GET['search'] ?? '';
            $cins = $_GET['cins'] ?? '';

            $where = "y.is_active = 1";
            $params = [];
            if ($search) {
                $where .= " AND (y.code LIKE :s OR y.numara LIKE :s OR y.cins LIKE :s OR y.supplier LIKE :s)";
                $params[':s'] = '%' . $search . '%';
            }
            if ($cins) { $where .= " AND y.cins = :c"; $params[':c'] = $cins; }

            $sql = "SELECT y.*,
                    COALESCE((SELECT SUM(CASE WHEN m.type = 'giris' THEN m.quantity ELSE -m.quantity END)
                               FROM yarn_movements m WHERE m.yarn_id = y.id), 0) as current_stock,
                    (SELECT COUNT(*) FROM yarn_movements m WHERE m.yarn_id = y.id) as movement_count
                    FROM yarns y
                    WHERE $where
                    ORDER BY y.code ASC";
            $stmt = $db->prepare($sql);
            foreach ($params as $k => $v) $stmt->bindValue($k, $v);
            $result = $stmt->execute();
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
            jsonResponse(['data' => $rows]);

        } elseif ($method === 'POST') {
            $editId = intval($_POST['id'] ?? 0);
            $code = trim($_POST['code'] ?? '');

            if ($editId > 0) {
                $stmt = $db->prepare("UPDATE yarns SET code=:code, numara=:no, numara_type=:ntype, kat=:kat, cins=:cins, unit=:unit,
                    supplier=:sup, unit_price=:up, currency=:cur, min_stock=:ms, notes=:notes,
                    updated_at=datetime('now') WHERE id=:id");
                $stmt->bindValue(':id', $editId, SQLITE3_INTEGER);
            } else {
                if (empty($code)) {
                    $code = generateYarnCode();
                    if (!$code) jsonResponse(['error' => 'İplik kodu üretilemedi'], 500);
                }
                $stmt = $db->prepare("INSERT INTO yarns (code, numara, numara_type, kat, cins, unit, supplier, unit_price, currency, min_stock, notes)
                    VALUES (:code, :no, :ntype, :kat, :cins, :unit, :sup, :up, :cur, :ms, :notes)");
            }

            $stmt->bindValue(':code', sanitize($code));
            $stmt->bindValue(':no', sanitize($_POST['numara'] ?? ''));
            $stmt->bindValue(':ntype', sanitize($_POST['numara_type'] ?? 'nm'));
            $stmt->bindValue(':kat', intval($_POST['kat'] ?? 1));
            $stmt->bindValue(':cins', sanitize($_POST['cins'] ?? ''));
            $stmt->bindValue(':unit', sanitize($_POST['unit'] ?? 'kg'));
            $stmt->bindValue(':sup', sanitize($_POST['supplier'] ?? ''));
            $stmt->bindValue(':up', floatval($_POST['unit_price'] ?? 0));
            $stmt->bindValue(':cur', sanitize($_POST['currency'] ?? 'TL'));
            $stmt->bindValue(':ms', floatval($_POST['min_stock'] ?? 0));
            $stmt->bindValue(':notes', sanitize($_POST['notes'] ?? ''));
            if (!$stmt->execute()) {
                jsonResponse(['error' => 'Kayıt eklenemedi: ' . $db->lastErrorMsg()], 400);
            }

            $newId = $editId > 0 ? $editId : $db->lastInsertRowID();
            jsonResponse(['success' => true, 'id' => $newId, 'code' => $code]);
        }
        break;

    case 'yarns_bulk':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $data = json_decode($_POST['data'] ?? '[]', true);
        if (empty($data)) jsonResponse(['error' => 'Veri bulunamadı'], 400);

        $db = getDB();
        $db->exec('BEGIN TRANSACTION');
        try {
            $inserted = 0;
            $skipped = 0;
            foreach ($data as $y) {
                $code = trim(sanitize($y['code'] ?? ''));
                $numara = trim(sanitize($y['numara'] ?? ''));
                $cins = trim(sanitize($y['cins'] ?? ''));
                if ($numara === '' && $cins === '') { $skipped++; continue; }

                // Numara / kat ayrıştırma: "40/1" veya "40" + Kat kolonu
                $kat = intval($y['kat'] ?? 1);
                $numaraSlash = explode('/', $numara);
                if (count($numaraSlash) > 1) {
                    $numara = trim($numaraSlash[0]);
                    $numKat = intval($numaraSlash[1]);
                    if ($numKat > 0) $kat = $numKat;
                }

                // Numara türü normalizasyonu (Nm / Ne / D / denye / nm / ne)
                $numaraType = strtolower(trim(sanitize($y['numara_type'] ?? '')));
                if (preg_match('/d$/i', $numara) && $numaraType === '') $numaraType = 'denye';
                $numara = preg_replace('/[^0-9.,]/', '', $numara);
                if ($numaraType === 'd' || $numaraType === 'denye') $numaraType = 'denye';
                elseif ($numaraType !== 'ne') $numaraType = 'nm';
                if ($kat < 1) $kat = 1;

                if (empty($code)) {
                    $code = generateYarnCode();
                    if (!$code) jsonResponse(['error' => 'İplik kodu üretilemedi'], 500);
                }

                // Aynı kod zaten varsa atla
                $dupSt = $db->prepare("SELECT COUNT(*) FROM yarns WHERE code = :c");
                $dupSt->bindValue(':c', $code);
                if (intval($dupSt->execute()->fetchArray(SQLITE3_NUM)[0]) > 0) { $skipped++; continue; }

                $stmt = $db->prepare("INSERT INTO yarns (code, numara, numara_type, kat, cins, unit, supplier, unit_price, currency, min_stock, notes)
                    VALUES (:code, :no, :ntype, :kat, :cins, :unit, :sup, :up, :cur, :ms, :notes)");
                $stmt->bindValue(':code', $code);
                $stmt->bindValue(':no', $numara);
                $stmt->bindValue(':ntype', $numaraType);
                $stmt->bindValue(':kat', $kat, SQLITE3_INTEGER);
                $stmt->bindValue(':cins', $cins);
                $stmt->bindValue(':unit', sanitize($y['unit'] ?? 'kg'));
                $stmt->bindValue(':sup', sanitize($y['supplier'] ?? ''));
                $stmt->bindValue(':up', floatval($y['unit_price'] ?? 0));
                $stmt->bindValue(':cur', sanitize($y['currency'] ?? 'TL'));
                $stmt->bindValue(':ms', floatval($y['min_stock'] ?? 0));
                $stmt->bindValue(':notes', sanitize($y['notes'] ?? ''));
                if (!$stmt->execute()) { $skipped++; continue; }
                $inserted++;
            }
            $db->exec('COMMIT');
            jsonResponse(['success' => true, 'inserted' => $inserted, 'skipped' => $skipped]);
        } catch (Exception $e) {
            $db->exec('ROLLBACK');
            jsonResponse(['error' => $e->getMessage()], 500);
        }
        break;

    case 'yarn_delete':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        $db = getDB();
        $db->exec("UPDATE yarns SET is_active = 0 WHERE id = $id");
        jsonResponse(['success' => true]);
        break;

    case 'yarn_movements':
        requireLogin();
        $db = getDB();

        if ($method === 'GET') {
            $yarnId = $_GET['yarn_id'] ?? '';
            $type = $_GET['type'] ?? '';
            $loomId = $_GET['loom_id'] ?? '';
            $from = $_GET['date_from'] ?? '';
            $to = $_GET['date_to'] ?? '';
            $search = $_GET['search'] ?? '';

            $where = "1=1";
            $params = [];
            if ($yarnId) { $where .= " AND m.yarn_id = :yid"; $params[':yid'] = intval($yarnId); }
            if ($type) { $where .= " AND m.type = :t"; $params[':t'] = $type; }
            if ($loomId) { $where .= " AND m.loom_id = :lid"; $params[':lid'] = intval($loomId); }
            if ($from) { $where .= " AND m.date >= :f"; $params[':f'] = $from; }
            if ($to) { $where .= " AND m.date <= :t2"; $params[':t2'] = $to; }
            if ($search) {
                $where .= " AND (y.code LIKE :s OR y.numara LIKE :s OR m.invoice_no LIKE :s OR m.supplier LIKE :s OR m.purpose LIKE :s)";
                $params[':s'] = '%' . $search . '%';
            }

            $sql = "SELECT m.*, y.code as yarn_code, y.numara as yarn_numara, y.kat as yarn_kat, y.numara_type as yarn_numara_type, y.cins as yarn_cins, y.unit as yarn_unit,
                    l.name as loom_name, u.full_name as user_name
                    FROM yarn_movements m
                    JOIN yarns y ON m.yarn_id = y.id
                    LEFT JOIN looms l ON m.loom_id = l.id
                    LEFT JOIN users u ON m.user_id = u.id
                    WHERE $where
                    ORDER BY m.date DESC, m.id DESC LIMIT 500";
            $stmt = $db->prepare($sql);
            foreach ($params as $k => $v) $stmt->bindValue($k, $v);
            $result = $stmt->execute();
            $rows = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
            jsonResponse(['data' => $rows]);

        } elseif ($method === 'POST') {
            $yarnId = intval($_POST['yarn_id'] ?? 0);
            if (!$yarnId) jsonResponse(['error' => 'İplik seçimi zorunludur'], 400);
            $type = $_POST['type'] ?? '';
            if (!in_array($type, ['giris', 'cikis'])) jsonResponse(['error' => 'Geçersiz hareket tipi'], 400);
            $quantity = floatval($_POST['quantity'] ?? 0);
            if ($quantity <= 0) jsonResponse(['error' => 'Geçerli bir miktar girin'], 400);
            $date = sanitize($_POST['date'] ?? date('Y-m-d'));

            $unitPrice = floatval($_POST['unit_price'] ?? 0);
            $currency = sanitize($_POST['currency'] ?? 'TL');

            // ── Çıkışta stok kontrolü ──
            if ($type === 'cikis') {
                $stmt = $db->prepare("SELECT COALESCE((SELECT SUM(CASE WHEN m.type = 'giris' THEN m.quantity ELSE -m.quantity END)
                                          FROM yarn_movements m WHERE m.yarn_id = :yid), 0)");
                $stmt->bindValue(':yid', $yarnId, SQLITE3_INTEGER);
                $currentStock = floatval($stmt->execute()->fetchArray(SQLITE3_NUM)[0]);
                if ($quantity > $currentStock) {
                    jsonResponse(['error' => 'Stoktan fazla çıkış yapılamaz. Mevcut stok: ' . rtrim(rtrim(number_format($currentStock, 2, ',', '.'), '0'), ',') . ' ' . (sanitize($_POST['unit'] ?? 'kg'))], 400);
                }
            }

            $stmt = $db->prepare("INSERT INTO yarn_movements (yarn_id, type, quantity, bale_count, supplier,
                invoice_no, unit_price, currency, total_price, loom_id, destination, purpose, date, user_id)
                VALUES (:yid, :type, :qty, :bale, :sup, :inv, :up, :cur, :total, :lid, :dest, :pur, :d, :uid)");
            $stmt->bindValue(':yid', $yarnId, SQLITE3_INTEGER);
            $stmt->bindValue(':type', $type);
            $stmt->bindValue(':qty', $quantity);
            $stmt->bindValue(':bale', intval($_POST['bale_count'] ?? 0));
            $stmt->bindValue(':sup', sanitize($_POST['supplier'] ?? ''));
            $stmt->bindValue(':inv', sanitize($_POST['invoice_no'] ?? ''));
            $stmt->bindValue(':up', $unitPrice);
            $stmt->bindValue(':cur', $currency);
            $stmt->bindValue(':total', $quantity * $unitPrice);
            $stmt->bindValue(':lid', $type === 'cikis' ? (intval($_POST['loom_id'] ?? 0) ?: null) : null, SQLITE3_INTEGER);
            $stmt->bindValue(':dest', sanitize($_POST['destination'] ?? ''));
            $stmt->bindValue(':pur', sanitize($_POST['purpose'] ?? ''));
            $stmt->bindValue(':d', $date);
            $stmt->bindValue(':uid', $_SESSION['user_id'], SQLITE3_INTEGER);
            if (!$stmt->execute()) {
                jsonResponse(['error' => 'Hareket kaydedilemedi: ' . $db->lastErrorMsg()], 400);
            }

            jsonResponse(['success' => true, 'id' => $db->lastInsertRowID()]);
        }
        break;

    case 'yarn_movement_delete':
        requireLogin();
        if ($method !== 'POST') jsonResponse(['error' => 'POST gerekli'], 405);
        $id = intval($_POST['id'] ?? 0);
        if (!$id) jsonResponse(['error' => 'ID gerekli'], 400);
        $db = getDB();
        $db->exec("DELETE FROM yarn_movements WHERE id = $id");
        jsonResponse(['success' => true]);
        break;

    case 'yarn_stats':
        requireLogin();
        $db = getDB();
        $from = $_GET['from'] ?? date('Y-m-01');
        $to = $_GET['to'] ?? date('Y-m-d');

        $totalYarns = intval($db->querySingle("SELECT COUNT(*) FROM yarns WHERE is_active = 1"));

        // Mevcut stok değeri ve kritik stok (tüm iplikler) — para birimine göre ayrı
        $result = $db->query("SELECT y.id, y.unit_price, y.min_stock, y.currency,
            COALESCE((SELECT SUM(CASE WHEN m.type = 'giris' THEN m.quantity ELSE -m.quantity END)
                       FROM yarn_movements m WHERE m.yarn_id = y.id), 0) as current_stock
            FROM yarns y WHERE y.is_active = 1");
        $lowStock = 0;
        $stockTl = 0.0;
        $stockUsd = 0.0;
        $stockEur = 0.0;
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $cs = floatval($row['current_stock']);
            if ($cs <= floatval($row['min_stock'])) $lowStock++;
            $val = $cs * floatval($row['unit_price']);
            if ($row['currency'] === 'USD') $stockUsd += $val;
            elseif ($row['currency'] === 'EUR') $stockEur += $val;
            else $stockTl += $val;
        }

        $stmt = $db->prepare("SELECT
            COALESCE(SUM(CASE WHEN type='giris' THEN quantity ELSE 0 END), 0) as giris_qty,
            COALESCE(SUM(CASE WHEN type='cikis' THEN quantity ELSE 0 END), 0) as cikis_qty,
            COUNT(*) as total_movements
            FROM yarn_movements WHERE date BETWEEN :f AND :t");
        $stmt->bindValue(':f', $from);
        $stmt->bindValue(':t', $to);
        $period = $stmt->execute()->fetchArray(SQLITE3_ASSOC);

        jsonResponse([
            'toplam' => $totalYarns,
            'kritik' => $lowStock,
            'stok_degeri' => $stockTl,
            'stok_degeri_tl' => $stockTl,
            'stok_degeri_usd' => $stockUsd,
            'stok_degeri_eur' => $stockEur,
            'giris_qty' => floatval($period['giris_qty']),
            'cikis_qty' => floatval($period['cikis_qty']),
            'hareket' => intval($period['total_movements']),
            'period' => ['from' => $from, 'to' => $to]
        ]);
        break;

    case 'export_yarns':
        requireLogin();
        $db = getDB();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="iplikler_' . date('Y-m-d') . '.csv"');
        $output = fopen('php://output', 'w');
        fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));
        fputcsv($output, ['Kod', 'Numara', 'Numara Türü', 'Kat', 'Cins', 'Birim', 'Mevcut Stok', 'Min Stok', 'Tedarikçi', 'Birim Fiyat', 'Para Birimi', 'Notlar'], ';');
        $result = $db->query("SELECT y.*,
            COALESCE((SELECT SUM(CASE WHEN m.type = 'giris' THEN m.quantity ELSE -m.quantity END)
                       FROM yarn_movements m WHERE m.yarn_id = y.id), 0) as current_stock
            FROM yarns y WHERE y.is_active = 1 ORDER BY y.code");
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $tLabel = $row['numara_type'] === 'ne' ? 'Ne' : ($row['numara_type'] === 'denye' ? 'Denye' : 'Nm');
            fputcsv($output, [
                $row['code'], $row['numara'] ?? '', $tLabel, $row['kat'] ?? 1, $row['cins'] ?? '', $row['unit'],
                $row['current_stock'], $row['min_stock'], $row['supplier'] ?? '',
                $row['unit_price'], $row['currency'], $row['notes'] ?? ''
            ], ';');
        }
        fclose($output);
        exit;

    case 'export_yarn_movements':
        requireLogin();
        $db = getDB();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="iplik_hareketleri_' . date('Y-m-d') . '.csv"');
        $output = fopen('php://output', 'w');
        fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));
        fputcsv($output, ['ID', 'Tarih', 'İplik', 'Tip', 'Miktar', 'Bobin/Top', 'Tedarikçi', 'Fatura No', 'Birim Fiyat', 'Toplam', 'Tezgah', 'Çıkış Yeri', 'Amaç/Not'], ';');
        $result = $db->query("SELECT m.*, y.code as yarn_code, y.numara as yarn_numara, y.kat as yarn_kat, y.unit as yarn_unit, l.name as loom_name
            FROM yarn_movements m
            JOIN yarns y ON m.yarn_id = y.id
            LEFT JOIN looms l ON m.loom_id = l.id
            ORDER BY m.date DESC, m.id DESC");
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            fputcsv($output, [
                $row['id'], $row['date'],
                $row['yarn_code'] . ($row['yarn_numara'] ? ' ' . $row['yarn_numara'] : ''),
                $row['type'] === 'giris' ? 'Giriş' : 'Çıkış', $row['quantity'], $row['bale_count'] ?? 0,
                $row['supplier'] ?? '', $row['invoice_no'] ?? '', $row['unit_price'], $row['total_price'],
                $row['loom_name'] ?? '', $row['destination'] ?? '', $row['purpose'] ?? ''
            ], ';');
        }
        fclose($output);
        exit;

    // ═══════════════════════════════════════
    //  AKILLI BİLDİRİMLER (Smart Alerts)
    // ═══════════════════════════════════════
    case 'smart_alerts':
        requireLogin();
        $db = getDB();
        $alerts = [];

        // 1) Çözgü bitimine yaklaşan tezgahlar
        $loomResult = $db->query("SELECT l.id, l.name, l.warp_total, l.warp_start_meter, l.current_meters,
                                         p.name as product_name
                                  FROM looms l
                                  LEFT JOIN products p ON l.product_id = p.id
                                  WHERE l.is_active = 1 AND l.warp_total > 0");
        while ($loom = $loomResult->fetchArray(SQLITE3_ASSOC)) {
            $warpTotal = floatval($loom['warp_total']);
            $warpStart = floatval($loom['warp_start_meter']);
            $currentM = floatval($loom['current_meters']);
            $produced = $currentM - $warpStart;
            $remaining = $warpTotal - $produced;
            $pct = ($warpTotal > 0) ? ($remaining / $warpTotal) * 100 : 100;

            if ($remaining <= 0) {
                $alerts[] = [
                    'type' => 'warp_end',
                    'severity' => 'danger',
                    'icon' => '🔴',
                    'title' => 'Çözgü Bitti!',
                    'message' => $loom['name'] . ' - ' . ($loom['product_name'] ?: 'Ürün Yok') . ' çözgüsü tükendi.',
                    'loom_id' => $loom['id'],
                    'remaining' => 0,
                    'page' => 'looms'
                ];
            } elseif ($pct <= 15) {
                $alerts[] = [
                    'type' => 'warp_low',
                    'severity' => 'warning',
                    'icon' => '⚠️',
                    'title' => 'Çözgü Azalıyor',
                    'message' => $loom['name'] . ' - Kalan: ' . round($remaining) . 'mt (%' . round($pct) . ')',
                    'loom_id' => $loom['id'],
                    'remaining' => round($remaining),
                    'page' => 'looms'
                ];
            }
        }

        // 2) Lisans bitiş uyarısı
        $endDate = $db->querySingle("SELECT value FROM settings WHERE key = 'license_end_date'");
        $warningDays = intval($db->querySingle("SELECT value FROM settings WHERE key = 'license_warning_days'") ?: 7);
        if ($endDate) {
            $endTs = strtotime($endDate);
            $nowTs = time();
            $daysLeft = floor(($endTs - $nowTs) / 86400);

            if ($daysLeft <= 0) {
                $alerts[] = [
                    'type' => 'license',
                    'severity' => 'danger',
                    'icon' => '🚫',
                    'title' => 'Lisans Süresi Doldu!',
                    'message' => 'Lisansınız ' . date('d.m.Y', $endTs) . ' tarihinde sona erdi.',
                    'days_left' => $daysLeft,
                    'page' => 'settings'
                ];
            } elseif ($daysLeft <= $warningDays) {
                $alerts[] = [
                    'type' => 'license',
                    'severity' => 'warning',
                    'icon' => '⏳',
                    'title' => 'Lisans Süresi Doluyor',
                    'message' => 'Lisansınızın bitmesine ' . $daysLeft . ' gün kaldı (' . date('d.m.Y', $endTs) . ').',
                    'days_left' => $daysLeft,
                    'page' => 'settings'
                ];
            }
        }

        // 3) Sipariş teslim tarihi yaklaşanlar (3 gün içinde)
        $orderStmt = $db->prepare("SELECT o.id, o.order_no, o.deadline_date, o.quantity_m, o.status,
                                          c.name as customer_name, p.name as product_name
                                   FROM orders o
                                   LEFT JOIN customers c ON o.customer_id = c.id
                                   LEFT JOIN products p ON o.product_id = p.id
                                   WHERE o.status = 'Açık' AND o.deadline_date IS NOT NULL AND o.deadline_date != ''
                                   ORDER BY o.deadline_date ASC");
        $orderResult = $orderStmt->execute();
        $today = date('Y-m-d');
        while ($order = $orderResult->fetchArray(SQLITE3_ASSOC)) {
            $deadlineTs = strtotime($order['deadline_date']);
            $todayTs = strtotime($today);
            $daysLeft = floor(($deadlineTs - $todayTs) / 86400);

            if ($daysLeft < 0) {
                $alerts[] = [
                    'type' => 'order_overdue',
                    'severity' => 'danger',
                    'icon' => '🔴',
                    'title' => 'Sipariş Gecikti!',
                    'message' => $order['order_no'] . ' - ' . ($order['customer_name'] ?: '') . ' (' . abs($daysLeft) . ' gün gecikme)',
                    'order_id' => $order['id'],
                    'days_left' => $daysLeft,
                    'page' => 'orders'
                ];
            } elseif ($daysLeft <= 3) {
                $alerts[] = [
                    'type' => 'order_deadline',
                    'severity' => $daysLeft === 0 ? 'danger' : 'warning',
                    'icon' => $daysLeft === 0 ? '🔔' : '📅',
                    'title' => $daysLeft === 0 ? 'Bugün Teslim!' : 'Teslim Yaklaşıyor',
                    'message' => $order['order_no'] . ' - ' . ($order['customer_name'] ?: '') . ($daysLeft > 0 ? ' (' . $daysLeft . ' gün kaldı)' : ''),
                    'order_id' => $order['id'],
                    'days_left' => $daysLeft,
                    'page' => 'orders'
                ];
            }
        }

        // Severity'e göre sırala: danger > warning > info
        usort($alerts, function($a, $b) {
            $order = ['danger' => 0, 'warning' => 1, 'info' => 2];
            return ($order[$a['severity']] ?? 3) - ($order[$b['severity']] ?? 3);
        });

        jsonResponse(['alerts' => $alerts, 'count' => count($alerts)]);
        break;

    default:
        jsonResponse(['error' => 'Geçersiz işlem: ' . $action], 400);
}
