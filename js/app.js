// js/app.js
// Logika halaman publik: navigasi, render data dari Firebase, form catatan.

import { db, ref, onValue, push } from "./firebase-config.js";
import {
  HARI_LIST,
  HARI_LABEL,
  STRUKTUR_DEFAULT,
  JADWAL_DEFAULT,
  SERAGAM_DEFAULT,
  KONTEN_DEFAULT,
  KAS_PANJANG_PESAN_MAKS,
} from "./data.js";
import {
  el,
  clearNode,
  attachImageFallback,
  showToast,
  formatWaktu,
  cleanInput,
} from "./utils.js";

/* ==========================================================================
   Navbar: scroll state, mobile sheet, scrollspy
   ========================================================================== */

const navbar = document.getElementById("navbar");
const navToggle = document.getElementById("navToggle");
const navSheet = document.getElementById("navSheet");
const navLinks = document.querySelectorAll("[data-nav]");

window.addEventListener(
  "scroll",
  () => {
    navbar.classList.toggle("is-scrolled", window.scrollY > 8);
  },
  { passive: true }
);

navToggle.addEventListener("click", () => {
  const isOpen = navSheet.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

navSheet.querySelectorAll(".navbar__link").forEach((link) => {
  link.addEventListener("click", () => {
    navSheet.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

const sections = document.querySelectorAll(".page-section[id]");
if ("IntersectionObserver" in window) {
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((l) => {
            l.classList.toggle("is-active", l.dataset.nav === id);
          });
        }
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  sections.forEach((s) => spy.observe(s));

  const reveal = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          reveal.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  document.querySelectorAll(".fade-up").forEach((n) => reveal.observe(n));
}

/* ==========================================================================
   Hero: fallback jika welcome.png belum ada
   ========================================================================== */

const welcomeImg = document.getElementById("welcomeImg");
const welcomePlaceholder = document.getElementById("welcomePlaceholder");
welcomeImg.addEventListener("error", () => {
  welcomeImg.hidden = true;
  welcomePlaceholder.hidden = false;
});

/* ==========================================================================
   Konten hero (judul & deskripsi, dapat diedit admin)
   ========================================================================== */

onValue(ref(db, "konten/hero"), (snap) => {
  const data = snap.val() || KONTEN_DEFAULT;
  document.getElementById("heroTitle").textContent =
    data.judul || KONTEN_DEFAULT.judul;
  document.getElementById("heroDesc").textContent =
    data.deskripsi || KONTEN_DEFAULT.deskripsi;
});

/* ==========================================================================
   Struktur Kelas
   ========================================================================== */

const strukturLeadEl = document.getElementById("strukturLead");
const strukturGridEl = document.getElementById("strukturGrid");

function objToSortedArray(obj) {
  if (!obj) return [];
  return Object.entries(obj)
    .map(([id, val]) => ({ id, ...val }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function renderStruktur(list) {
  clearNode(strukturLeadEl);
  clearNode(strukturGridEl);

  if (!list.length) {
    strukturGridEl.appendChild(
      emptyState("Struktur kelas belum ditambahkan.")
    );
    return;
  }

  const [lead, ...rest] = list;

  const leadPhotoBox = el("div", { className: "struktur__lead-photo" });
  leadPhotoBox.appendChild(makePhoto(lead.foto, lead.nama || lead.jabatan));

  strukturLeadEl.appendChild(
    el("div", {
      className: "struktur__lead",
      children: [
        leadPhotoBox,
        el("div", {
          children: [
            el("span", { className: "struktur__lead-role", text: lead.jabatan }),
            el("h3", {
              className: "struktur__lead-name",
              text: lead.nama || "Belum ditambahkan",
            }),
            lead.deskripsi
              ? el("p", { className: "struktur__lead-desc", text: lead.deskripsi })
              : null,
          ],
        }),
      ],
    })
  );

  rest.forEach((member) => {
    const photoBox = el("div", { className: "struktur-card__photo" });
    photoBox.appendChild(makePhoto(member.foto, member.nama || member.jabatan));

    strukturGridEl.appendChild(
      el("div", {
        className: "struktur-card",
        children: [
          photoBox,
          el("div", { className: "struktur-card__role", text: member.jabatan }),
          el(member.nama ? "div" : "div", {
            className: member.nama
              ? "struktur-card__name"
              : "struktur-card__name struktur-card__name--empty",
            text: member.nama || "Belum ditambahkan",
          }),
        ],
      })
    );
  });
}

function makePhoto(url, alt) {
  const img = el("img", { attrs: { alt: alt || "Foto", loading: "lazy" } });
  if (url) {
    img.src = url;
  } else {
    img.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23dceefb'/%3E%3Ccircle cx='100' cy='78' r='34' fill='%23a9cfe8'/%3E%3Cpath d='M40 165c8-42 40-62 60-62s52 20 60 62' fill='%23a9cfe8'/%3E%3C/svg%3E";
  }
  attachImageFallback(img);
  return img;
}

onValue(
  ref(db, "struktur"),
  (snap) => {
    const val = snap.val();
    const list = val
      ? objToSortedArray(val)
      : STRUKTUR_DEFAULT.map((m) => ({ ...m }));
    renderStruktur(list);
  },
  () => {
    strukturGridEl.appendChild(
      errorState("Struktur kelas gagal dimuat. Coba muat ulang halaman.")
    );
  }
);

/* ==========================================================================
   Jadwal Kelas
   ========================================================================== */

const jadwalTabsEl = document.getElementById("jadwalTabs");
const jadwalTableBody = document.getElementById("jadwalTableBody");
const jadwalListEl = document.getElementById("jadwalList");

let jadwalData = JADWAL_DEFAULT;
let activeHari = defaultHariIni();

function defaultHariIni() {
  const idx = new Date().getDay(); // 0=Minggu..6=Sabtu
  const map = { 1: "senin", 2: "selasa", 3: "rabu", 4: "kamis", 5: "jumat" };
  return map[idx] || "senin";
}

function buildJadwalTabs() {
  clearNode(jadwalTabsEl);
  HARI_LIST.forEach((hari) => {
    const btn = el("button", {
      className: "jadwal__tab" + (hari === activeHari ? " is-active" : ""),
      text: HARI_LABEL[hari],
      attrs: { type: "button", role: "tab", "aria-selected": hari === activeHari },
    });
    btn.addEventListener("click", () => {
      activeHari = hari;
      buildJadwalTabs();
      renderJadwalHari();
    });
    jadwalTabsEl.appendChild(btn);
  });
}

function renderJadwalHari() {
  clearNode(jadwalTableBody);
  clearNode(jadwalListEl);

  const items = (jadwalData[activeHari] || [])
    .slice()
    .sort((a, b) => a.jam - b.jam);

  if (!items.length) {
    jadwalTableBody.appendChild(
      el("tr", { children: [emptyStateCell("Jadwal untuk hari ini belum ditambahkan.")] })
    );
    jadwalListEl.appendChild(emptyState("Jadwal untuk hari ini belum ditambahkan."));
    return;
  }

  items.forEach((item) => {
    const isPulang = /pulang/i.test(item.pelajaran || "");
    jadwalTableBody.appendChild(
      el("tr", {
        className: isPulang ? "is-pulang" : "",
        children: [
          el("td", { text: String(item.jam) }),
          el("td", { text: item.pelajaran }),
        ],
      })
    );
    jadwalListEl.appendChild(
      el("div", {
        className: "jadwal__row" + (isPulang ? " is-pulang" : ""),
        children: [
          el("span", { className: "jadwal__row-jam", text: String(item.jam) }),
          el("span", { className: "jadwal__row-mapel", text: item.pelajaran }),
        ],
      })
    );
  });
}

function emptyStateCell(msg) {
  const td = el("td", { attrs: { colspan: "2" } });
  td.appendChild(emptyState(msg));
  return td;
}

buildJadwalTabs();
renderJadwalHari();

onValue(
  ref(db, "jadwal"),
  (snap) => {
    const val = snap.val();
    jadwalData = val && Object.keys(val).length ? val : JADWAL_DEFAULT;
    renderJadwalHari();
  },
  () => showToast("Jadwal gagal dimuat dari server.", "error")
);

/* ==========================================================================
   Seragam
   ========================================================================== */

const seragamGridEl = document.getElementById("seragamGrid");

const SERAGAM_ICONS = {
  sun: '<circle cx="12" cy="12" r="4.4"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke-linecap="round"/>',
  batik: '<path d="M12 3l2.5 4.5L19 9l-3 3.5.7 5-4.7-2.4L7.3 17.5l.7-5-3-3.5 4.5-1.5z"/>',
  scout: '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5z"/>',
};

function iconSvg(name) {
  const paths = SERAGAM_ICONS[name] || SERAGAM_ICONS.sun;
  const wrap = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  wrap.setAttribute("viewBox", "0 0 24 24");
  wrap.setAttribute("fill", "none");
  wrap.setAttribute("stroke", "currentColor");
  wrap.setAttribute("stroke-width", "1.6");
  wrap.innerHTML = paths; // aman: string tetap (bukan dari input pengguna)
  return wrap;
}

function renderSeragam(data) {
  clearNode(seragamGridEl);
  HARI_LIST.forEach((hari) => {
    const info = data[hari];
    if (!info || !info.utama) {
      seragamGridEl.appendChild(
        el("div", {
          className: "seragam-card",
          children: [
            el("div", { className: "seragam-card__hari", text: HARI_LABEL[hari] }),
            el("p", { className: "struktur-card__name--empty", text: "Belum ditentukan." }),
          ],
        })
      );
      return;
    }
    const stamp = el("div", { className: "seragam-card__stamp" });
    stamp.appendChild(iconSvg(info.icon));

    seragamGridEl.appendChild(
      el("div", {
        className: "seragam-card",
        children: [
          stamp,
          el("div", { className: "seragam-card__hari", text: HARI_LABEL[hari] }),
          el("div", { className: "seragam-card__utama", text: info.utama }),
          info.alternatif
            ? el("div", { className: "seragam-card__alt", text: info.alternatif })
            : null,
        ],
      })
    );
  });
}

renderSeragam(SERAGAM_DEFAULT);

onValue(
  ref(db, "seragam"),
  (snap) => {
    const val = snap.val();
    renderSeragam(val && Object.keys(val).length ? val : SERAGAM_DEFAULT);
  },
  () => showToast("Data seragam gagal dimuat.", "error")
);

/* ==========================================================================
   Kami Semua (siswa)
   ========================================================================== */

const siswaGridEl = document.getElementById("siswaGrid");

onValue(
  ref(db, "siswa"),
  (snap) => {
    clearNode(siswaGridEl);
    const val = snap.val();
    if (!val) {
      siswaGridEl.appendChild(emptyState("Belum ada anggota kelas ditambahkan."));
      return;
    }
    const list = Object.entries(val).map(([id, v]) => ({ id, ...v }));
    list.forEach((siswa) => {
      const photoBox = el("div", { className: "siswa-card__photo" });
      photoBox.appendChild(makePhoto(siswa.foto, siswa.nama));
      siswaGridEl.appendChild(
        el("div", {
          className: "siswa-card",
          children: [
            photoBox,
            el("div", {
              className: "siswa-card__body",
              children: [
                el("div", { className: "siswa-card__name", text: siswa.nama || "Tanpa nama" }),
                siswa.keterangan
                  ? el("div", { className: "siswa-card__ket", text: siswa.keterangan })
                  : null,
              ],
            }),
          ],
        })
      );
    });
  },
  () => {
    clearNode(siswaGridEl);
    siswaGridEl.appendChild(errorState("Daftar anggota kelas gagal dimuat."));
  }
);

/* ==========================================================================
   Catatan Kelas
   ========================================================================== */

const catatanForm = document.getElementById("catatanForm");
const inputNama = document.getElementById("inputNama");
const inputPesan = document.getElementById("inputPesan");
const pesanCount = document.getElementById("pesanCount");
const catatanSubmit = document.getElementById("catatanSubmit");
const catatanBoard = document.getElementById("catatanBoard");

inputPesan.addEventListener("input", () => {
  pesanCount.textContent = String(inputPesan.value.length);
});

catatanForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();

  const nama = cleanInput(inputNama.value, 40);
  const pesan = cleanInput(inputPesan.value, KAS_PANJANG_PESAN_MAKS);

  let valid = true;
  toggleFieldError("fieldNama", !nama);
  toggleFieldError("fieldPesan", !pesan);
  if (!nama || !pesan) valid = false;
  if (!valid) return;

  catatanSubmit.disabled = true;
  catatanSubmit.textContent = "Mengirim...";

  try {
    await push(ref(db, "catatan"), {
      nama,
      pesan,
      waktu: Date.now(),
    });
    catatanForm.reset();
    pesanCount.textContent = "0";
    showToast("Catatan berhasil dikirim.");
  } catch (err) {
    console.error(err);
    showToast("Gagal mengirim catatan. Coba lagi.", "error");
  } finally {
    catatanSubmit.disabled = false;
    catatanSubmit.textContent = "Kirim Catatan";
  }
});

function toggleFieldError(fieldId, hasError) {
  document.getElementById(fieldId).classList.toggle("has-error", hasError);
}

onValue(
  ref(db, "catatan"),
  (snap) => {
    clearNode(catatanBoard);
    const val = snap.val();
    if (!val) {
      catatanBoard.appendChild(emptyState("Belum ada catatan kelas."));
      return;
    }
    const list = Object.entries(val)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => (b.waktu || 0) - (a.waktu || 0));

    list.forEach((n) => {
      catatanBoard.appendChild(
        el("div", {
          className: "note",
          children: [
            el("p", { className: "note__msg", text: n.pesan }),
            el("div", {
              className: "note__meta",
              children: [
                el("span", { className: "note__from", text: n.nama }),
                el("span", { className: "note__time", text: formatWaktu(n.waktu) }),
              ],
            }),
          ],
        })
      );
    });
  },
  () => {
    clearNode(catatanBoard);
    catatanBoard.appendChild(errorState("Catatan gagal dimuat. Periksa koneksi internet."));
  }
);

/* ==========================================================================
   State helpers
   ========================================================================== */

function emptyState(msg) {
  return el("div", {
    className: "state-box",
    children: [
      svgCloud(),
      el("strong", { text: msg }),
    ],
  });
}

function errorState(msg) {
  return el("div", {
    className: "state-box state-box--error",
    children: [
      svgCloud(),
      el("strong", { text: msg }),
    ],
  });
}

function svgCloud() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.innerHTML =
    '<path d="M7 18h10a4 4 0 0 0 .5-7.97A5.5 5.5 0 0 0 7.1 9.5 4 4 0 0 0 7 18z"/>';
  return svg;
}
