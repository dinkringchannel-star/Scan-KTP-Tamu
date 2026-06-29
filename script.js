// ⚠️ GANTI dengan URL Google Apps Script Web App Anda
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzJaDq5SzkyddtjKPhrzDu23KIikJtDiKVa2W1eHty3W9atcNcxO5EY5fnW2LHMYYxe/exec"; // ← URL Apps Script

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const btnCapture = document.getElementById("btnCapture");
const btnRetake = document.getElementById("btnRetake");
const btnScan = document.getElementById("btnScan");
const btnSubmit = document.getElementById("btnSubmit");
const resultBox = document.getElementById("result");
const statusBox = document.getElementById("status");
const nikInput = document.getElementById("nik");
const namaInput = document.getElementById("nama");

let stream = null;

// Mulai kamera
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 } }
    });
    video.srcObject = stream;
  } catch (err) {
    showStatus("❌ Gagal mengakses kamera: " + err.message, "error");
  }
}

function showStatus(msg, type = "info") {
  statusBox.textContent = msg;
  statusBox.className = "status show " + type;
}

function hideStatus() {
  statusBox.className = "status";
}

// Ambil foto
btnCapture.addEventListener("click", () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  video.style.display = "none";
  canvas.style.display = "block";
  btnCapture.style.display = "none";
  btnRetake.style.display = "block";
  btnScan.style.display = "block";
  resultBox.style.display = "none";
  hideStatus();
});

// Ambil ulang
btnRetake.addEventListener("click", () => {
  canvas.style.display = "none";
  video.style.display = "block";
  btnCapture.style.display = "block";
  btnRetake.style.display = "none";
  btnScan.style.display = "none";
  resultBox.style.display = "none";
  hideStatus();
});

// Scan OCR
btnScan.addEventListener("click", async () => {
  btnScan.disabled = true;
  showStatus("🔍 Memproses OCR... (butuh beberapa detik)", "info");

  try {
    const { data: { text } } = await Tesseract.recognize(canvas, "ind+eng", {
      logger: m => {
        if (m.status === "recognizing text") {
          showStatus(`🔍 Memproses... ${Math.round(m.progress * 100)}%`, "info");
        }
      }
    });

    console.log("Hasil OCR:", text);
    const parsed = parseKTP(text);
    nikInput.value = parsed.nik;
    namaInput.value = parsed.nama;
    resultBox.style.display = "block";
    showStatus("✅ Scan selesai. Periksa & edit jika perlu.", "success");
  } catch (err) {
    showStatus("❌ Gagal scan: " + err.message, "error");
  } finally {
    btnScan.disabled = false;
  }
});

// Parse NIK & Nama dari teks KTP
function parseKTP(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let nik = "", nama = "";

  // Cari NIK: 16 digit angka (biasanya di awal)
  const nikMatch = text.match(/\b(\d{16})\b/);
  if (nikMatch) nik = nikMatch[1];

  // Cari Nama: setelah kata "Nama" atau "Name"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^Nama\s*[:;]?/i.test(line) || /^Name\s*[:;]?/i.test(line)) {
      // Ambil bagian setelah "Nama:"
      const afterColon = line.replace(/^Nama\s*[:;]?\s*/i, "").replace(/^Name\s*[:;]?\s*/i, "");
      nama = afterColon.trim();
      // Jika kosong di baris yang sama, ambil baris berikutnya
      if (!nama && lines[i + 1]) nama = lines[i + 1].trim();
      break;
    }
  }

  // Bersihkan nama dari noise OCR
  nama = nama.replace(/[^\p{L}\s.'-]/gu, "").trim();

  return { nik, nama };
}

// Submit ke Google Sheet
btnSubmit.addEventListener("click", async () => {
  const nik = nikInput.value.trim();
  const nama = namaInput.value.trim();

  if (nik.length !== 16 || !/^\d+$/.test(nik)) {
    showStatus("❌ NIK harus 16 digit angka!", "error");
    return;
  }
  if (!nama) {
    showStatus("❌ Nama tidak boleh kosong!", "error");
    return;
  }

  btnSubmit.disabled = true;
  showStatus("⏳ Mengirim ke Google Sheet...", "info");

  try {
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nik: nik,
        nama: nama,
        timestamp: new Date().toISOString()
      })
    });
    showStatus("✅ Data berhasil disimpan ke Google Sheet!", "success");
    // Reset form untuk scan berikutnya
    setTimeout(() => {
      nikInput.value = "";
      namaInput.value = "";
      resultBox.style.display = "none";
      btnRetake.click();
    }, 2000);
  } catch (err) {
    showStatus("❌ Gagal mengirim: " + err.message, "error");
  } finally {
    btnSubmit.disabled = false;
  }
});

startCamera();