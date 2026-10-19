# ErytnaBusana POS

Aplikasi Point of Sale (POS) dan manajemen inventaris untuk toko alat jahit dan perlengkapan busana. Aplikasi dirancang untuk mendukung penjualan eceran maupun grosir, pencatatan transaksi, pengelolaan stok, serta laporan penjualan.

## Fitur

- **Autentikasi dan hak akses:** login pengguna dengan peran Admin/Pemilik, Kasir, dan Petugas Stok.
- **Produk dan pencarian:** katalog produk, kategori, SKU, barcode sebagai input scanner, serta variasi satuan.
- **Harga eceran dan grosir:** aturan harga bertingkat berdasarkan kuantitas pembelian.
- **Kasir dan pembayaran:** keranjang belanja, perhitungan total dan kembalian, serta pencatatan metode pembayaran.
- **Struk:** tampilan struk yang dapat dicetak melalui browser dan disesuaikan untuk printer thermal.
- **Persediaan:** mutasi stok, stok opname, batas stok minimum, serta pencegahan stok negatif.
- **Pembelian dan pemasok:** pencatatan pesanan/pembelian dan penerimaan barang.
- **Pembatalan dan retur:** pencatatan alasan, perubahan stok sesuai aturan, dan jejak audit.
- **Dashboard dan laporan:** ringkasan penjualan, estimasi laba kotor, filter tanggal, dan ekspor CSV.

## Teknologi

Berdasarkan konfigurasi proyek yang dijelaskan untuk aplikasi ini:

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite

Periksa `package.json`, konfigurasi Prisma, dan file konfigurasi proyek untuk memastikan versi serta dependensi yang benar sebelum menjalankan aplikasi.

## Persyaratan

Pastikan perangkat pengembangan telah memiliki:

- Node.js yang kompatibel dengan versi Next.js di proyek
- npm
- Git

## Menjalankan aplikasi

1. Clone repository dan masuk ke direktori proyek:

   ```bash
   git clone <URL_REPOSITORY>
   cd <NAMA_DIREKTORI_PROYEK>
   ```

2. Instal dependensi:

   ```bash
   npm install
   ```

3. Siapkan variabel lingkungan jika dibutuhkan. Periksa file `.env.example` atau dokumentasi konfigurasi proyek. Jangan commit file `.env` yang berisi rahasia.

4. Siapkan database sesuai konfigurasi Prisma. Periksa `package.json` dan skema Prisma untuk mengetahui perintah migrasi atau inisialisasi yang benar.

5. Jalankan server pengembangan:

   ```bash
   npm run dev
   ```

6. Buka [http://localhost:3000](http://localhost:3000) di browser.

Untuk menjalankan build produksi, gunakan perintah yang tersedia di `package.json`. Pada umumnya:

```bash
npm run build
npm start
```

Perintah produksi hanya akan berjalan setelah build berhasil dan konfigurasi database serta variabel lingkungan telah disiapkan.

## Pengujian

Jalankan pengujian yang dikonfigurasi di proyek:

```bash
npm test
```

Jika skrip smoke test tersedia, jalankan juga:

```bash
node scripts/e2e-smoke.mjs
```

Pastikan skrip tersebut memang ada di repository. Jumlah dan hasil pengujian harus mengikuti output aktual dari perintah pengujian; jangan menganggap semua pengujian lulus sebelum menjalankannya.

Skenario penting yang perlu diuji meliputi:

1. Penjualan eceran dan perhitungan subtotal.
2. Penerapan harga grosir pada batas kuantitas.
3. Pembayaran tunai dan perhitungan kembalian.
4. Penolakan transaksi ketika stok tidak cukup.
5. Snapshot harga pada transaksi historis.
6. Pembatalan transaksi dan pengembalian stok sesuai aturan.
7. Pembatasan akses berdasarkan peran.
8. Pencegahan transaksi ganda.
9. Ketepatan laporan pada rentang tanggal yang dipilih.

## Contoh aturan harga grosir

Angka berikut adalah **contoh untuk pengujian**, bukan harga yang ditetapkan untuk toko:

| Kuantitas | Contoh harga per pcs |
|---|---:|
| 1–11 | Rp5.000 |
| 12–99 | Rp4.000 |
| 100 atau lebih | Rp3.500 |

Aturan harga sebenarnya dapat disesuaikan melalui konfigurasi produk apabila fitur tersebut tersedia pada versi aplikasi yang digunakan.

## Akun demo dan keamanan

Akun demo, jika disediakan oleh proses seed atau konfigurasi lokal proyek, hanya boleh digunakan untuk pengembangan dan pengujian lokal.

- Periksa dokumentasi atau skrip seed untuk mengetahui akun demo yang benar.
- Jangan menggunakan password demo pada lingkungan produksi.
- Ganti atau nonaktifkan akun demo sebelum deployment.
- Jangan menaruh password, token, API key, atau kredensial database di repository.
- Pastikan hak akses diperiksa di sisi server, bukan hanya dengan menyembunyikan menu di antarmuka.
- Jangan menganggap aplikasi siap produksi sebelum autentikasi, otorisasi, konfigurasi database, backup, dan pengujian keamanan ditinjau.

## Catatan pengembangan

- Gunakan migrasi database untuk perubahan skema.
- Jangan menghapus transaksi historis secara permanen melalui alur aplikasi normal; gunakan mekanisme pembatalan yang dapat diaudit.
- Perubahan stok sebaiknya selalu memiliki catatan pergerakan dan alasan.
- Perhitungan laba kotor harus menggunakan metode harga pokok yang konsisten dan memperhitungkan pembatalan serta retur.
- Pastikan transaksi dan pembaruan stok dilakukan secara konsisten agar kegagalan transaksi tidak meninggalkan data parsial.

## Status fitur dan pengujian

Status implementasi dan pengujian harus diverifikasi terhadap kode pada branch yang sedang digunakan. README ini tidak menyatakan bahwa seluruh fitur atau pengujian telah lulus tanpa hasil pengujian terbaru yang dapat diperiksa.

## Kontribusi

1. Buat branch untuk perubahan.
2. Implementasikan perubahan sekecil dan sejelas mungkin.
3. Jalankan pemeriksaan dan pengujian yang relevan.
4. Perbarui dokumentasi jika perilaku atau konfigurasi aplikasi berubah.
5. Buat pull request dengan ringkasan perubahan dan hasil pengujian.

## Lisensi

Lisensi belum ditentukan. Tambahkan file `LICENSE` dan perbarui bagian ini setelah pemilik proyek menetapkan lisensi.
