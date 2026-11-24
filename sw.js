/* Service Worker — Catatan Pengeluaran

   Halaman utama memakai strategi "jaringan dulu": setiap kali dibuka dalam
   keadaan online, versi terbaru dari server yang dipakai, dan salinannya
   disimpan untuk keadaan offline. Versi sebelumnya memakai "cache dulu", yang
   membuat perangkat tetap menjalankan aplikasi lama meski server sudah
   diperbarui.

   Berkas pendukung (ikon, manifest, huruf, SDK Firebase) tetap "cache dulu"
   karena isinya tidak berubah dan memuatnya dari cache jauh lebih cepat.

   API kurs mata uang sengaja tidak pernah disimpan, supaya tombol
   "Perbarui kurs" selalu mengambil angka terbaru.

   Naikkan nomor versi di bawah setiap kali index.html berubah. */
const CACHE = 'catatan-pengeluaran-v30';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
];

/* Huruf Google Fonts dan SDK Firebase — ikut disimpan agar tampilan tetap utuh
   dan sinkronisasi tetap bisa dinyalakan saat sinyal hilang. */
const LUAR = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

/* Halaman menanyakan versi cache yang sedang melayani, lalu menampilkannya di
   panel Data & Sinkronisasi. Begitu nomornya beda dengan versi aplikasi,
   perangkat itu ketahuan masih memegang berkas lama. */
self.addEventListener('message', (e) => {
  if (e.data === 'versi' && e.ports && e.ports[0]) e.ports[0].postMessage(CACHE);
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Permintaan halaman: navigasi peramban, atau alamat akar / index.html */
function halamanUtama(req, url) {
  if (req.mode === 'navigate') return true;
  if (url.origin !== self.location.origin) return false;
  return url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const milikSendiri = url.origin === self.location.origin;
  const luarDikenal = LUAR.indexOf(url.hostname) !== -1;
  // Sisanya (API kurs) dibiarkan lewat tanpa cache.
  if (!milikSendiri && !luarDikenal) return;

  // Halaman utama: coba jaringan dulu, jatuh ke cache kalau offline.
  if (halamanUtama(e.request, url)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) {
            const salinan = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', salinan)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Sisanya: cache dulu, ambil dari jaringan kalau belum tersimpan.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((tersimpan) => {
      if (tersimpan) return tersimpan;
      return fetch(e.request).then((res) => {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const salinan = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, salinan)).catch(() => {});
        }
        return res;
      }).catch(() => undefined);
    })
  );
});
