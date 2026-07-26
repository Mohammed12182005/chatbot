<?php
// ============================================================
// mo.php — يستقبل النص من app_v2.js ويستدعي Gemini API بأمان
// (هذا هو الوسيط الوحيد الذي يجب أن يتصل بـ Gemini؛ المفتاح لا يُفترض
// أن يظهر أبدًا في أي ملف يعمل داخل المتصفح)
// ============================================================

header('Content-Type: application/json; charset=utf-8');

// يستدعي ملف الإعدادات من نفس المجلد
require __DIR__ . '/config.php';

// اسمح فقط بطلبات POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'الطريقة غير مسموحة']);
    exit;
}

$input  = json_decode(file_get_contents('php://input'), true);
$prompt = isset($input['prompt']) ? trim($input['prompt']) : '';

if ($prompt === '') {
    http_response_code(400);
    echo json_encode(['error' => 'الرجاء إرسال نص صالح في الحقل prompt']);
    exit;
}

// التحقق من وجود مفتاح API صالح
if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '' || GEMINI_API_KEY === 'ضع_مفتاحك_الجديد_هنا') {
    http_response_code(500);
    echo json_encode(['error' => 'لم يتم ضبط مفتاح Gemini في config.php بعد']);
    exit;
}

$model = 'gemini-3.5-flash';
$url   = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent";

$body = json_encode([
    'contents' => [
        ['parts' => [['text' => $prompt]]],
    ],
]);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        // الطريقة الموثقة حاليًا من Google لإرسال المفتاح هي عبر هذا الترويسة
        // بدل ?key=... في الرابط (وهي مطلوبة لمفاتيح "Auth key" الجديدة AQ.)
        'x-goog-api-key: ' . GEMINI_API_KEY,
    ],
    CURLOPT_POSTFIELDS     => $body,
    CURLOPT_TIMEOUT        => 25,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

// ملاحظة حول InfinityFree:
// 1) بعض الحسابات المجانية تمنع أو تقيّد الاتصالات الصادرة إلى نطاقات خارجية
//    مثل generativelanguage.googleapis.com. إذا ظهر خطأ مثل "Could not resolve
//    host" أو "Connection timed out"، فهذا سبب شائع — راسل دعم InfinityFree
//    لطلب تفعيل الاتصال الصادر لهذا النطاق تحديدًا، أو استضف mo.php بديلاً
//    على منصة تدعم الاتصالات الصادرة (مثل Render أو Deno Deploy).
// 2) إذا ظهر "cURL error 60: SSL certificate problem"، الحل الآمن هو تنزيل
//    حزمة شهادات CA حديثة من https://curl.se/ca/cacert.pem ورفعها بجانب هذا
//    الملف، ثم إضافة: CURLOPT_CAINFO => __DIR__ . '/cacert.pem'
//    تجنّب تعطيل CURLOPT_SSL_VERIFYPEER لأن ذلك يفتح الاتصال لهجمات التنصت.

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'فشل الاتصال بـ Gemini API: ' . $curlErr]);
    exit;
}

$data = json_decode($response, true);

if ($httpCode >= 400) {
    // نُمرر رمز الحالة الحقيقي القادم من Gemini (429 لتجاوز الحد، 400 لطلب غير
    // صالح...) بدل تحويله دائمًا إلى 502، حتى تستطيع الواجهة الأمامية التمييز
    http_response_code($httpCode);
    $googleMsg = $data['error']['message'] ?? null;

    if ($httpCode === 429) {
        echo json_encode([
            'error'   => 'تم تجاوز الحد المسموح به من الطلبات على Gemini API (429). انتظر قليلاً ثم أعد المحاولة، أو راجع حالة حصتك في aistudio.google.com/rate-limit',
            'details' => $data,
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode([
            'error'   => $googleMsg ?? 'رفض Gemini API الطلب',
            'details' => $data,
        ], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

$reply = $data['candidates'][0]['content']['parts'][0]['text'] ?? 'تعذر الحصول على رد من Gemini.';

echo json_encode(['reply' => $reply], JSON_UNESCAPED_UNICODE);