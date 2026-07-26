// ============================================================
// app_v2.js — منطق الشات بوت الصوتي (يعمل في المتصفح)
// ============================================================

const micBtn = document.getElementById("micBtn");
const micIcon = document.getElementById("micIcon");
const chatLog = document.getElementById("chatLog");
const statusText = document.getElementById("statusText");

// اللغة المستخدمة للتعرف على الصوت وللنطق
const LANG = "ar-SA";

// رابط الخادم الخلفي (PHP) الذي يستدعي Gemini API بأمان.
// يجب أن يكون mo.php منشورًا في نفس مجلد هذا الملف على الاستضافة.
const BACKEND_URL = "mo.php";

let isListening = false;

// 1) إعداد التعرف على الصوت (Speech-to-Text)
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognitionAPI) {
  statusText.textContent = "متصفحك لا يدعم التعرف على الصوت. جرّب Chrome أو Edge.";
  micBtn.disabled = true;
} else {
  const recognition = new SpeechRecognitionAPI();
  recognition.lang = LANG;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  micBtn.addEventListener("click", () => {
    if (isListening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
    } catch (err) {
      console.error("تعذر بدء الاستماع:", err);
    }
  });

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add("listening");
    micIcon.textContent = "⏹️";
    statusText.textContent = "أستمع الآن... تحدّث بحرية";
  };

  recognition.onend = () => {
    isListening = false;
    micBtn.classList.remove("listening");
    micIcon.textContent = "🎤";
    statusText.textContent = "اضغط على الميكروفون وابدأ الحديث";
  };

  recognition.onerror = (event) => {
    console.error("خطأ في التعرف على الصوت:", event.error);
    statusText.textContent = "لم أستطع سماعك، حاول مرة أخرى";
  };

  recognition.onresult = async (event) => {
    const userText = event.results[0][0].transcript;
    if (!userText) return;

    addMessage("user", userText);
    const thinkingEl = addMessage("bot", "...يفكر", { thinking: true });

    // نمنع إرسال طلب آخر قبل انتهاء الطلب الحالي، لتفادي مضاعفة الضغط على الحصة
    micBtn.disabled = true;

    try {
      const reply = await askGemini(userText);
      thinkingEl.remove();
      addMessage("bot", reply);
      speak(reply);
    } catch (err) {
      console.error(err);
      thinkingEl.remove();
      addMessage("bot", err.message || "حدث خطأ أثناء الاتصال بالخادم.");
    } finally {
      micBtn.disabled = false;
    }
  };
}

// 2) الاتصال بـ Gemini عبر الخادم الخلفي (mo.php) - وليس مباشرة من المتصفح
//
// تحذير: لا تضع مفتاح Gemini في هذا الملف أو أي ملف js/html أبدًا.
// أي كود يعمل داخل المتصفح يمكن لأي زائر قراءته كاملًا عبر "عرض المصدر"
// أو أدوات المطوّر (F12)، فيصبح المفتاح مسروقًا فور نشر الموقع.
// المفتاح يبقى محفوظًا فقط في config.php على الخادم.
async function askGemini(prompt) {
  let response;
  try {
    response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
  } catch (networkErr) {
    throw new Error(
      "تعذّر الوصول إلى الخادم الخلفي. تأكد أن mo.php منشور بجانب index.html وأن اتصالك بالإنترنت يعمل."
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch (parseErr) {
    // الرد لم يكن JSON صالحًا (مثلاً صفحة خطأ HTML من الاستضافة نفسها)
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("تم تجاوز الحد المسموح به من الطلبات حاليًا. انتظر قليلاً ثم حاول مرة أخرى.");
    }
    throw new Error((data && data.error) || ("فشل الطلب (" + response.status + ")"));
  }

  return (data && data.reply) || "لم يصل رد من الخادم.";
}

// 3) تحويل النص إلى كلام (Text-to-Speech)
function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG;
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

// أدوات مساعدة لواجهة الدردشة
function addMessage(role, text, opts = {}) {
  const el = document.createElement("div");
  el.className = `message ${role}${opts.thinking ? " thinking" : ""}`;
  const p = document.createElement("p");
  p.textContent = text;
  el.appendChild(p);
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
  return el;
}