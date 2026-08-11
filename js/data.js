// js/data.js
// Konstanta & data awal. Data ini hanya dipakai sebagai "seed" pertama kali
// admin membuka panel dan database masih kosong — setelah itu sumber
// kebenaran ada di Firebase Realtime Database.

export const HARI_LIST = ["senin", "selasa", "rabu", "kamis", "jumat"];

export const HARI_LABEL = {
  senin: "Senin",
  selasa: "Selasa",
  rabu: "Rabu",
  kamis: "Kamis",
  jumat: "Jumat",
};

// Peran inti struktur kelas, urut sesuai hierarki.
// "diisi" menandai apakah data awal tersedia dari pengguna.
export const STRUKTUR_DEFAULT = [
  {
    id: "wali-kelas",
    jabatan: "Wali Kelas",
    nama: "Bu Ika",
    foto: "",
    deskripsi: "",
    order: 1,
    diisi: true,
  },
  {
    id: "ketua-kelas",
    jabatan: "Ketua Kelas",
    nama: "Athalla",
    foto: "",
    deskripsi: "",
    order: 2,
    diisi: true,
  },
  {
    id: "wakil-ketua",
    jabatan: "Wakil Ketua Kelas",
    nama: "Fahrezi / Aes",
    foto: "",
    deskripsi: "",
    order: 3,
    diisi: true,
  },
  {
    id: "bendahara",
    jabatan: "Bendahara",
    nama: "",
    foto: "",
    deskripsi: "",
    order: 4,
    diisi: false,
  },
  {
    id: "sekretaris",
    jabatan: "Sekretaris",
    nama: "",
    foto: "",
    deskripsi: "",
    order: 5,
    diisi: false,
  },
];

export const JADWAL_DEFAULT = {
  senin: [
    { jam: 1, pelajaran: "Upacara" },
    { jam: 2, pelajaran: "Matematika" },
    { jam: 3, pelajaran: "Matematika" },
    { jam: 4, pelajaran: "Bahasa Inggris" },
    { jam: 5, pelajaran: "Bahasa Inggris" },
    { jam: 6, pelajaran: "Bahasa Inggris" },
    { jam: 7, pelajaran: "Bimbingan Konseling" },
    { jam: 8, pelajaran: "Pulang" },
  ],
  selasa: [
    { jam: 1, pelajaran: "PJOK" },
    { jam: 2, pelajaran: "PJOK" },
    { jam: 3, pelajaran: "Prakarya / Seni Budaya" },
    { jam: 4, pelajaran: "Prakarya / Seni Budaya" },
    { jam: 5, pelajaran: "Bahasa Indonesia" },
    { jam: 6, pelajaran: "Bahasa Indonesia" },
    { jam: 7, pelajaran: "IPA" },
    { jam: 8, pelajaran: "Pulang" },
  ],
  rabu: [
    { jam: 1, pelajaran: "IPA" },
    { jam: 2, pelajaran: "IPA" },
    { jam: 3, pelajaran: "IPA" },
    { jam: 4, pelajaran: "PKN" },
    { jam: 5, pelajaran: "PKN" },
    { jam: 6, pelajaran: "IPS" },
    { jam: 7, pelajaran: "IPS" },
    { jam: 8, pelajaran: "Pulang" },
  ],
  kamis: [
    { jam: 1, pelajaran: "Informatika" },
    { jam: 2, pelajaran: "Informatika" },
    { jam: 3, pelajaran: "IPS" },
    { jam: 4, pelajaran: "Bahasa Indonesia" },
    { jam: 5, pelajaran: "Bahasa Indonesia" },
    { jam: 6, pelajaran: "Bahasa Indonesia" },
    { jam: 7, pelajaran: "PAI / BTQ" },
    { jam: 8, pelajaran: "Pulang" },
  ],
  jumat: [
    { jam: 1, pelajaran: "Pembiasaan Jumat Pagi" },
    { jam: 2, pelajaran: "PAI / BTQ" },
    { jam: 3, pelajaran: "PAI / BTQ" },
    { jam: 4, pelajaran: "Matematika" },
    { jam: 5, pelajaran: "Pulang" },
  ],
};

export const SERAGAM_DEFAULT = {
  senin: { utama: "Putih Biru", alternatif: "", icon: "sun" },
  selasa: { utama: "Batik Putih", alternatif: "Batik bebas", icon: "batik" },
  rabu: { utama: "Pramuka", alternatif: "", icon: "scout" },
  kamis: { utama: "Putih Biru", alternatif: "", icon: "sun" },
  jumat: {
    utama: "Muslim",
    alternatif: "Muslim bebas + celana biru",
    icon: "moon",
  },
};

export const KONTEN_DEFAULT = {
  judul: "Selamat Datang di Tujuh Satu",
  deskripsi:
    "Tempat menyimpan jadwal, struktur kelas, seragam, catatan, dan berbagai informasi kelas.",
};

export const KAS_PANJANG_PESAN_MAKS = 500;
