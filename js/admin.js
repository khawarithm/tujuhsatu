// js/admin.js
// Logika panel admin: autentikasi Firebase, seeding data awal, dan CRUD.
//
// Catatan keamanan:
// - Login TIDAK membandingkan username/password di JavaScript. Semua
//   autentikasi dilakukan lewat Firebase Authentication (signInWithEmailAndPassword).
// - Username diterjemahkan menjadi email sintetis (lihat usernameToEmail)
//   karena Firebase Auth berbasis email/password.
// - Hak akses admin diperiksa lewat node /admin_uids/{uid} di database,
//   yang hanya bisa ditulis SEKALI (lihat database.rules.json) — ini
//   mencegah orang lain membuat akun admin baru setelah admin pertama ada.

import {
  db,
  auth,
  ref,
  onValue,
  get,
  set,
  push,
  update,
  remove,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "./firebase-config.js";
import {
  HARI_LIST,
  HARI_LABEL,
  STRUKTUR_DEFAULT,
  JADWAL_DEFAULT,
  SERAGAM_DEFAULT,
  KONTEN_DEFAULT,
} from "./data.js";
import {
  el,
  clearNode,
  attachImageFallback,
  showToast,
  formatWaktu,
  cleanInput,
  isLikelyUrl,
  confirmAction,
} from "./utils.js";

const EMAIL_DOMAIN = "admin.kelas-langit.local";
function usernameToEmail(username) {
  return `${username.trim().toLowerCase().replace(/\s+/g, "-")}@${EMAIL_DOMAIN}`;
}

/* ==========================================================================
   Elemen umum
   ========================================================================== */

const loginShell = document.getElementById("loginShell");
const adminShell = document.getElementById("adminShell");
const loginForm = document.getElementById("loginForm");
const loginAlert = document.getElementById("loginAlert");
const loginSetup = document.getElementById("loginSetup");
const btnSetupAdmin = document.getElementById("btnSetupAdmin");
const loginSubmit = document.getElementById("loginSubmit");
const adminUserLabel = document.getElementById("adminUserLabel");

let pendingCredentials = null; // { email, password } menunggu setup akun pertama

function showLoginAlert(msg) {
  loginAlert.textContent = msg;
  loginAlert.classList.add("is-visible");
}
function hideLoginAlert() {
  loginAlert.classList.remove("is-visible");
}
function hideSetupOffer() {
  loginSetup.classList.remove("is-visible");
  pendingCredentials = null;
}

/* ==========================================================================
   Login
   ========================================================================== */

loginForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  hideLoginAlert();
  hideSetupOffer();

  const username = cleanInput(document.getElementById("loginUsername").value, 40);
  const password = document.getElementById("loginPassword").value;

  if (!username || !password) {
    showLoginAlert("Username dan password wajib diisi.");
    return;
  }

  const email = usernameToEmail(username);
  loginSubmit.disabled = true;
  loginSubmit.textContent = "Memeriksa...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged akan menangani tampilan dashboard
  } catch (err) {
    const code = err.code || "";
    if (code === "auth/user-not-found" || code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
      // Mungkin ini adalah setup pertama kali
      try {
        const initSnap = await get(ref(db, "meta/adminInitialized"));
        if (!initSnap.exists() || initSnap.val() !== true) {
          pendingCredentials = { email, password, username };
          loginSetup.classList.add("is-visible");
        } else {
          showLoginAlert("Username atau password salah.");
        }
      } catch {
        showLoginAlert("Username atau password salah.");
      }
    } else if (code === "auth/wrong-password") {
      showLoginAlert("Username atau password salah.");
    } else if (code === "auth/too-many-requests") {
      showLoginAlert("Terlalu banyak percobaan. Coba beberapa saat lagi.");
    } else {
      showLoginAlert("Gagal masuk. Periksa koneksi internet kamu.");
    }
  } finally {
    loginSubmit.disabled = false;
    loginSubmit.textContent = "Masuk";
  }
});

btnSetupAdmin.addEventListener("click", async () => {
  if (!pendingCredentials) return;
  btnSetupAdmin.disabled = true;
  btnSetupAdmin.textContent = "Membuat akun...";
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      pendingCredentials.email,
      pendingCredentials.password
    );
    // Tulis diri sendiri ke admin_uids — rules hanya mengizinkan ini
    // sekali (lihat database.rules.json), sehingga aman dari penyalahgunaan.
    await set(ref(db, `admin_uids/${cred.user.uid}`), true);
    await set(ref(db, "meta/adminInitialized"), true);
    hideSetupOffer();
    showToast("Akun admin berhasil dibuat.");
  } catch (err) {
    console.error(err);
    showToast("Gagal membuat akun admin: " + (err.message || "coba lagi."), "error");
  } finally {
    btnSetupAdmin.disabled = false;
    btnSetupAdmin.textContent = "Buat Akun Admin";
  }
});

document.getElementById("btnLogout").addEventListener("click", () => {
  signOut(auth);
});

/* ==========================================================================
   Guard: hanya UID yang ada di /admin_uids yang boleh melihat dashboard
   ========================================================================== */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    adminShell.classList.remove("is-active");
    loginShell.style.display = "flex";
    return;
  }

  try {
    const snap = await get(ref(db, `admin_uids/${user.uid}`));
    if (snap.exists() && snap.val() === true) {
      loginShell.style.display = "none";
      adminShell.classList.add("is-active");
      adminUserLabel.textContent = user.email;
      seedDefaultsIfEmpty();
      initAdminSections();
    } else {
      await signOut(auth);
      showLoginAlert("Akun ini tidak memiliki akses admin.");
    }
  } catch (err) {
    console.error(err);
    await signOut(auth);
    showLoginAlert("Gagal memverifikasi akses admin. Coba lagi.");
  }
});

/* ==========================================================================
   Seed data awal — hanya menulis jika path masih kosong
   ========================================================================== */

let seeded = false;
async function seedDefaultsIfEmpty() {
  if (seeded) return;
  seeded = true;
  try {
    const [strukturSnap, jadwalSnap, seragamSnap, kontenSnap] = await Promise.all([
      get(ref(db, "struktur")),
      get(ref(db, "jadwal")),
      get(ref(db, "seragam")),
      get(ref(db, "konten/hero")),
    ]);

    if (!strukturSnap.exists()) {
      const obj = {};
      STRUKTUR_DEFAULT.forEach((m) => {
        const { id, ...rest } = m;
        obj[id] = rest;
      });
      await set(ref(db, "struktur"), obj);
    }
    if (!jadwalSnap.exists()) {
      await set(ref(db, "jadwal"), JADWAL_DEFAULT);
    }
    if (!seragamSnap.exists()) {
      await set(ref(db, "seragam"), SERAGAM_DEFAULT);
    }
    if (!kontenSnap.exists()) {
      await set(ref(db, "konten/hero"), KONTEN_DEFAULT);
    }
  } catch (err) {
    console.error("Seed gagal:", err);
  }
}

/* ==========================================================================
   Navigasi tab & sidebar mobile
   ========================================================================== */

function initTabs() {
  const tabs = document.querySelectorAll(".admin-tab");
  const panels = document.querySelectorAll(".admin-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      panels.forEach((p) => p.classList.remove("is-active"));
      tab.classList.add("is-active");
      document
        .querySelector(`.admin-panel[data-panel="${tab.dataset.tab}"]`)
        .classList.add("is-active");
      closeMobileSide();
    });
  });
}

const adminSide = document.getElementById("adminSide");
const adminOverlay = document.getElementById("adminOverlay");
document.getElementById("btnOpenSide").addEventListener("click", () => {
  adminSide.classList.add("is-open");
  adminOverlay.classList.add("is-visible");
});
adminOverlay.addEventListener("click", closeMobileSide);
function closeMobileSide() {
  adminSide.classList.remove("is-open");
  adminOverlay.classList.remove("is-visible");
}

let sectionsInitialized = false;
function initAdminSections() {
  if (sectionsInitialized) return;
  sectionsInitialized = true;
  initTabs();
  initKontenPanel();
  initStrukturPanel();
  initJadwalPanel();
  initSeragamPanel();
  initSiswaPanel();
  initCatatanPanel();
}

/* ==========================================================================
   Panel: Konten Beranda
   ========================================================================== */

function initKontenPanel() {
  const form = document.getElementById("formKonten");
  const judulEl = document.getElementById("kontenJudul");
  const deskripsiEl = document.getElementById("kontenDeskripsi");

  onValue(ref(db, "konten/hero"), (snap) => {
    const val = snap.val() || KONTEN_DEFAULT;
    judulEl.value = val.judul || "";
    deskripsiEl.value = val.deskripsi || "";
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const judul = cleanInput(judulEl.value, 80);
    const deskripsi = cleanInput(deskripsiEl.value, 200);
    if (!judul || !deskripsi) {
      showToast("Judul dan deskripsi tidak boleh kosong.", "error");
      return;
    }
    try {
      await set(ref(db, "konten/hero"), { judul, deskripsi });
      showToast("Konten beranda tersimpan.");
    } catch (err) {
      showToast("Gagal menyimpan konten.", "error");
    }
  });
}

/* ==========================================================================
   Panel: Struktur Kelas
   ========================================================================== */

function initStrukturPanel() {
  const listEl = document.getElementById("strukturList");
  const form = document.getElementById("formStruktur");
  const idEl = document.getElementById("strukturId");
  const jabatanEl = document.getElementById("strukturJabatan");
  const namaEl = document.getElementById("strukturNama");
  const fotoEl = document.getElementById("strukturFoto");
  const deskripsiEl = document.getElementById("strukturDeskripsi");
  const orderEl = document.getElementById("strukturOrder");
  const formTitle = document.getElementById("strukturFormTitle");
  const cancelBtn = document.getElementById("strukturCancel");

  function resetForm() {
    form.reset();
    idEl.value = "";
    formTitle.textContent = "Tambah Anggota";
  }
  cancelBtn.addEventListener("click", resetForm);

  onValue(ref(db, "struktur"), (snap) => {
    clearNode(listEl);
    const val = snap.val();
    if (!val) {
      listEl.appendChild(adminEmpty("Belum ada anggota struktur."));
      return;
    }
    const list = Object.entries(val)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    list.forEach((item) => {
      const thumb = el("div", { className: "admin-row__thumb" });
      thumb.appendChild(adminThumb(item.foto, item.nama || item.jabatan));

      const editBtn = el("button", { className: "btn btn--ghost btn--sm", text: "Edit", attrs: { type: "button" } });
      editBtn.addEventListener("click", () => {
        idEl.value = item.id;
        jabatanEl.value = item.jabatan || "";
        namaEl.value = item.nama || "";
        fotoEl.value = item.foto || "";
        deskripsiEl.value = item.deskripsi || "";
        orderEl.value = item.order || "";
        formTitle.textContent = "Edit Anggota";
        form.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });

      const delBtn = el("button", { className: "btn btn--danger btn--sm", text: "Hapus", attrs: { type: "button" } });
      delBtn.addEventListener("click", async () => {
        if (!confirmAction(`Hapus data "${item.jabatan}"?`)) return;
        try {
          await remove(ref(db, `struktur/${item.id}`));
          showToast("Anggota dihapus.");
        } catch {
          showToast("Gagal menghapus.", "error");
        }
      });

      listEl.appendChild(
        el("div", {
          className: "admin-row",
          children: [
            thumb,
            el("div", {
              className: "admin-row__body",
              children: [
                el("div", { className: "admin-row__title", text: item.jabatan }),
                el("div", { className: "admin-row__sub", text: item.nama || "Belum diisi" }),
              ],
            }),
            el("div", { className: "admin-row__actions", children: [editBtn, delBtn] }),
          ],
        })
      );
    });
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const jabatan = cleanInput(jabatanEl.value, 40);
    const nama = cleanInput(namaEl.value, 60);
    const foto = cleanInput(fotoEl.value, 400);
    const deskripsi = cleanInput(deskripsiEl.value, 150);
    const order = Number(orderEl.value) || 999;

    if (!jabatan) {
      showToast("Jabatan wajib diisi.", "error");
      return;
    }
    if (foto && !isLikelyUrl(foto)) {
      showToast("URL foto tidak valid.", "error");
      return;
    }

    const payload = { jabatan, nama, foto, deskripsi, order };

    try {
      if (idEl.value) {
        await update(ref(db, `struktur/${idEl.value}`), payload);
      } else {
        await push(ref(db, "struktur"), payload);
      }
      showToast("Data struktur tersimpan.");
      resetForm();
    } catch {
      showToast("Gagal menyimpan data.", "error");
    }
  });
}

/* ==========================================================================
   Panel: Jadwal Kelas
   ========================================================================== */

let jadwalActiveHari = "senin";

function initJadwalPanel() {
  const tabsEl = document.getElementById("jadwalHariTabs");
  const listEl = document.getElementById("jadwalAdminList");
  const listTitle = document.getElementById("jadwalListTitle");
  const form = document.getElementById("formJadwal");
  const itemIdEl = document.getElementById("jadwalItemId");
  const jamEl = document.getElementById("jadwalJam");
  const mapelEl = document.getElementById("jadwalMapel");
  const formTitle = document.getElementById("jadwalFormTitle");
  const cancelBtn = document.getElementById("jadwalCancel");

  function resetForm() {
    form.reset();
    itemIdEl.value = "";
    formTitle.textContent = "Tambah Jam Pelajaran";
  }
  cancelBtn.addEventListener("click", resetForm);

  function buildTabs() {
    clearNode(tabsEl);
    HARI_LIST.forEach((hari) => {
      const btn = el("button", {
        className: "btn btn--sm " + (hari === jadwalActiveHari ? "btn--primary" : "btn--ghost"),
        text: HARI_LABEL[hari],
        attrs: { type: "button" },
      });
      btn.addEventListener("click", () => {
        jadwalActiveHari = hari;
        resetForm();
        buildTabs();
        renderList();
      });
      tabsEl.appendChild(btn);
    });
    listTitle.textContent = `Jadwal ${HARI_LABEL[jadwalActiveHari]}`;
  }

  let currentJadwal = {};

  function renderList() {
    clearNode(listEl);
    const items = Object.entries(currentJadwal[jadwalActiveHari] || {})
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => a.jam - b.jam);

    if (!items.length) {
      listEl.appendChild(adminEmpty("Belum ada jadwal untuk hari ini."));
      return;
    }

    items.forEach((item) => {
      const editBtn = el("button", { className: "btn btn--ghost btn--sm", text: "Edit", attrs: { type: "button" } });
      editBtn.addEventListener("click", () => {
        itemIdEl.value = item.id;
        jamEl.value = item.jam;
        mapelEl.value = item.pelajaran;
        formTitle.textContent = "Edit Jam Pelajaran";
      });
      const delBtn = el("button", { className: "btn btn--danger btn--sm", text: "Hapus", attrs: { type: "button" } });
      delBtn.addEventListener("click", async () => {
        if (!confirmAction(`Hapus jam ke-${item.jam}?`)) return;
        try {
          await remove(ref(db, `jadwal/${jadwalActiveHari}/${item.id}`));
          showToast("Jadwal dihapus.");
        } catch {
          showToast("Gagal menghapus jadwal.", "error");
        }
      });

      listEl.appendChild(
        el("div", {
          className: "admin-row",
          children: [
            el("div", { className: "admin-jam-badge", text: String(item.jam) }),
            el("div", {
              className: "admin-row__body",
              children: [el("div", { className: "admin-row__title", text: item.pelajaran })],
            }),
            el("div", { className: "admin-row__actions", children: [editBtn, delBtn] }),
          ],
        })
      );
    });
  }

  buildTabs();

  onValue(ref(db, "jadwal"), (snap) => {
    currentJadwal = snap.val() || {};
    renderList();
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const jam = Number(jamEl.value);
    const pelajaran = cleanInput(mapelEl.value, 60);
    if (!jam || jam < 1 || !pelajaran) {
      showToast("Jam dan nama pelajaran wajib diisi dengan benar.", "error");
      return;
    }
    try {
      if (itemIdEl.value) {
        await update(ref(db, `jadwal/${jadwalActiveHari}/${itemIdEl.value}`), { jam, pelajaran });
      } else {
        await push(ref(db, `jadwal/${jadwalActiveHari}`), { jam, pelajaran });
      }
      showToast("Jadwal tersimpan.");
      resetForm();
    } catch {
      showToast("Gagal menyimpan jadwal.", "error");
    }
  });
}

/* ==========================================================================
   Panel: Seragam
   ========================================================================== */

const SERAGAM_ICON_OPTIONS = [
  { value: "sun", label: "Matahari" },
  { value: "batik", label: "Motif Batik" },
  { value: "scout", label: "Pramuka" },
  { value: "moon", label: "Bulan" },
];

function initSeragamPanel() {
  const container = document.getElementById("seragamForms");
  clearNode(container);

  HARI_LIST.forEach((hari) => {
    const utamaId = `seragam-${hari}-utama`;
    const altId = `seragam-${hari}-alt`;
    const iconId = `seragam-${hari}-icon`;

    const iconSelect = el("select", { attrs: { id: iconId } });
    SERAGAM_ICON_OPTIONS.forEach((opt) => {
      iconSelect.appendChild(el("option", { text: opt.label, attrs: { value: opt.value } }));
    });

    const wrap = el("div", {
      className: "admin-card",
      attrs: { style: "margin-bottom:14px;" },
      children: [
        el("h3", { text: HARI_LABEL[hari] }),
        el("div", {
          className: "field-row",
          children: [
            el("div", {
              className: "field",
              children: [
                el("label", { text: "Seragam utama", attrs: { for: utamaId } }),
                el("input", { attrs: { type: "text", id: utamaId, maxlength: "60" } }),
              ],
            }),
            el("div", {
              className: "field",
              children: [
                el("label", { text: "Alternatif (opsional)", attrs: { for: altId } }),
                el("input", { attrs: { type: "text", id: altId, maxlength: "60" } }),
              ],
            }),
          ],
        }),
        el("div", {
          className: "field",
          children: [el("label", { text: "Ikon", attrs: { for: iconId } })],
        }),
      ],
    });
    wrap.querySelector(".field:last-child").appendChild(iconSelect);

    const saveBtn = el("button", { className: "btn btn--primary btn--sm", text: "Simpan", attrs: { type: "button" } });
    saveBtn.addEventListener("click", async () => {
      const utama = cleanInput(document.getElementById(utamaId).value, 60);
      const alternatif = cleanInput(document.getElementById(altId).value, 60);
      const icon = document.getElementById(iconId).value;
      if (!utama) {
        showToast("Seragam utama tidak boleh kosong.", "error");
        return;
      }
      try {
        await set(ref(db, `seragam/${hari}`), { utama, alternatif, icon });
        showToast(`Seragam ${HARI_LABEL[hari]} tersimpan.`);
      } catch {
        showToast("Gagal menyimpan seragam.", "error");
      }
    });
    wrap.appendChild(el("div", { className: "form-actions", children: [saveBtn] }));
    container.appendChild(wrap);
  });

  onValue(ref(db, "seragam"), (snap) => {
    const val = snap.val() || SERAGAM_DEFAULT;
    HARI_LIST.forEach((hari) => {
      const info = val[hari] || {};
      const utamaInput = document.getElementById(`seragam-${hari}-utama`);
      const altInput = document.getElementById(`seragam-${hari}-alt`);
      const iconSelect = document.getElementById(`seragam-${hari}-icon`);
      if (!utamaInput) return;
      utamaInput.value = info.utama || "";
      altInput.value = info.alternatif || "";
      iconSelect.value = info.icon || "sun";
    });
  });
}

/* ==========================================================================
   Panel: Kami Semua (siswa)
   ========================================================================== */

function initSiswaPanel() {
  const listEl = document.getElementById("siswaList");
  const form = document.getElementById("formSiswa");
  const idEl = document.getElementById("siswaId");
  const namaEl = document.getElementById("siswaNama");
  const fotoEl = document.getElementById("siswaFoto");
  const ketEl = document.getElementById("siswaKeterangan");
  const formTitle = document.getElementById("siswaFormTitle");
  const cancelBtn = document.getElementById("siswaCancel");

  function resetForm() {
    form.reset();
    idEl.value = "";
    formTitle.textContent = "Tambah Siswa";
  }
  cancelBtn.addEventListener("click", resetForm);

  onValue(ref(db, "siswa"), (snap) => {
    clearNode(listEl);
    const val = snap.val();
    if (!val) {
      listEl.appendChild(adminEmpty("Belum ada siswa ditambahkan."));
      return;
    }
    const list = Object.entries(val).map(([id, v]) => ({ id, ...v }));

    list.forEach((item) => {
      const thumb = el("div", { className: "admin-row__thumb" });
      thumb.appendChild(adminThumb(item.foto, item.nama));

      const editBtn = el("button", { className: "btn btn--ghost btn--sm", text: "Edit", attrs: { type: "button" } });
      editBtn.addEventListener("click", () => {
        idEl.value = item.id;
        namaEl.value = item.nama || "";
        fotoEl.value = item.foto || "";
        ketEl.value = item.keterangan || "";
        formTitle.textContent = "Edit Siswa";
        form.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      const delBtn = el("button", { className: "btn btn--danger btn--sm", text: "Hapus", attrs: { type: "button" } });
      delBtn.addEventListener("click", async () => {
        if (!confirmAction(`Hapus "${item.nama}" dari daftar?`)) return;
        try {
          await remove(ref(db, `siswa/${item.id}`));
          showToast("Siswa dihapus.");
        } catch {
          showToast("Gagal menghapus.", "error");
        }
      });

      listEl.appendChild(
        el("div", {
          className: "admin-row",
          children: [
            thumb,
            el("div", {
              className: "admin-row__body",
              children: [el("div", { className: "admin-row__title", text: item.nama || "Tanpa nama" })],
            }),
            el("div", { className: "admin-row__actions", children: [editBtn, delBtn] }),
          ],
        })
      );
    });
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const nama = cleanInput(namaEl.value, 60);
    const foto = cleanInput(fotoEl.value, 400);
    const keterangan = cleanInput(ketEl.value, 60);
    if (!nama) {
      showToast("Nama siswa wajib diisi.", "error");
      return;
    }
    if (foto && !isLikelyUrl(foto)) {
      showToast("URL foto tidak valid.", "error");
      return;
    }
    const payload = { nama, foto, keterangan };
    try {
      if (idEl.value) {
        await update(ref(db, `siswa/${idEl.value}`), payload);
      } else {
        await push(ref(db, "siswa"), payload);
      }
      showToast("Data siswa tersimpan.");
      resetForm();
    } catch {
      showToast("Gagal menyimpan data siswa.", "error");
    }
  });
}

/* ==========================================================================
   Panel: Catatan (moderasi)
   ========================================================================== */

function initCatatanPanel() {
  const listEl = document.getElementById("catatanAdminList");

  onValue(ref(db, "catatan"), (snap) => {
    clearNode(listEl);
    const val = snap.val();
    if (!val) {
      listEl.appendChild(adminEmpty("Belum ada catatan kelas."));
      return;
    }
    const list = Object.entries(val)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => (b.waktu || 0) - (a.waktu || 0));

    list.forEach((item) => {
      const delBtn = el("button", { className: "btn btn--danger btn--sm", text: "Hapus", attrs: { type: "button" } });
      delBtn.addEventListener("click", async () => {
        if (!confirmAction(`Hapus catatan dari "${item.nama}"?`)) return;
        try {
          await remove(ref(db, `catatan/${item.id}`));
          showToast("Catatan dihapus.");
        } catch {
          showToast("Gagal menghapus catatan.", "error");
        }
      });

      listEl.appendChild(
        el("div", {
          className: "admin-row",
          children: [
            el("div", {
              className: "admin-row__body",
              children: [
                el("div", { className: "admin-row__title", text: item.nama || "Tanpa nama" }),
                el("div", { className: "admin-row__msg", text: item.pesan || "" }),
                el("div", { className: "admin-row__sub", text: formatWaktu(item.waktu) }),
              ],
            }),
            el("div", { className: "admin-row__actions", children: [delBtn] }),
          ],
        })
      );
    });
  });
}

/* ==========================================================================
   Helper kecil khusus admin
   ========================================================================== */

function adminEmpty(msg) {
  return el("p", { className: "admin-row__sub", text: msg, attrs: { style: "padding:6px 2px;" } });
}

function adminThumb(url, alt) {
  const img = el("img", { attrs: { alt: alt || "Foto", loading: "lazy" } });
  img.src =
    url ||
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23dceefb'/%3E%3Ccircle cx='100' cy='78' r='34' fill='%23a9cfe8'/%3E%3Cpath d='M40 165c8-42 40-62 60-62s52 20 60 62' fill='%23a9cfe8'/%3E%3C/svg%3E";
  attachImageFallback(img);
  return img;
}
