// js/utils.js
// Utilitas kecil yang dipakai bersama oleh app.js dan admin.js.
// Prinsip: tidak pernah memasukkan input pengguna via innerHTML tanpa lewat
// textContent / DOM API, supaya aman dari HTML/JS berbahaya.

/**
 * Buat elemen DOM dengan cepat tanpa innerHTML.
 * @param {string} tag
 * @param {object} [opts] - { className, text, attrs, children }
 */
export function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      if (v !== undefined && v !== null) node.setAttribute(k, v);
    }
  }
  if (opts.children) {
    for (const c of opts.children) {
      if (c) node.appendChild(c);
    }
  }
  return node;
}

/** Hapus semua child dari sebuah node. */
export function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Validasi kasar apakah string terlihat seperti URL gambar yang wajar. */
export function isLikelyUrl(str) {
  if (!str) return false;
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Pasang fallback aman ke <img> jika URL gagal dimuat. */
export function attachImageFallback(imgEl, fallbackText = "Foto belum tersedia") {
  imgEl.addEventListener("error", () => {
    if (imgEl.dataset.fallbackApplied) return;
    imgEl.dataset.fallbackApplied = "true";
    imgEl.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23dceefb'/%3E%3Ccircle cx='100' cy='78' r='34' fill='%23a9cfe8'/%3E%3Cpath d='M40 165c8-42 40-62 60-62s52 20 60 62' fill='%23a9cfe8'/%3E%3C/svg%3E";
    imgEl.alt = fallbackText;
    imgEl.classList.add("img-fallback");
  });
}

let toastTimer = null;
/**
 * Tampilkan notifikasi toast singkat.
 * @param {string} message
 * @param {"success"|"error"|"info"} [type]
 */
export function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = el("div", { attrs: { id: "toast-container" } });
    document.body.appendChild(container);
  }
  const toast = el("div", { className: `toast toast--${type}`, text: message });
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast--show"));
  window.setTimeout(() => {
    toast.classList.remove("toast--show");
    window.setTimeout(() => toast.remove(), 250);
  }, 3200);
}

/** Format timestamp (ms) ke teks tanggal/jam berbahasa Indonesia. */
export function formatWaktu(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Debounce sederhana. */
export function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Escape tidak diperlukan karena kita selalu pakai textContent — helper ini
 * hanya untuk memangkas & membatasi panjang string input pengguna. */
export function cleanInput(str, maxLen = 500) {
  return (str || "").toString().trim().slice(0, maxLen);
}

export function confirmAction(message) {
  return window.confirm(message);
}
