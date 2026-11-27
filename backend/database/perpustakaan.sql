-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: btbme109w697mgx0v57j-mysql.services.clever-cloud.com:3306
-- Waktu pembuatan: 26 Nov 2026 pada 10.09
-- Versi server: 8.0.22-13
-- Versi PHP: 8.2.36

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `btbme109w697mgx0v57j`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `buku`
--

CREATE TABLE `buku` (
  `id` int UNSIGNED NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `author` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isbn` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stock` int UNSIGNED NOT NULL DEFAULT '0',
  `cover` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data untuk tabel `buku`
--

INSERT INTO `buku` (`id`, `title`, `author`, `category`, `isbn`, `stock`, `cover`, `created_at`) VALUES
(1, 'Braiding Sweetgrass', 'Robin Wall Kimmerer', 'Nature', '9781571313560', 5, 'Book cover.png', '2026-11-19 05:29:20'),
(2, 'The Creative Act', 'Rick Rubin', 'Arts', '9780593652886', 2, NULL, '2026-11-19 05:29:20'),
(3, 'Sapiens', 'Yuval Noah Harari', 'History', NULL, 3, 'Book cover2.png', '2026-11-19 16:29:03'),
(5, 'The Little Prince', 'Antoine de Saint-Exupéry', 'Fiction', NULL, 2, 'Book cover3.png', '2026-11-19 16:30:16'),
(6, 'The Midnight Library', 'Matt Haig', 'Fiction', NULL, 4, NULL, '2026-11-20 01:23:14'),
(7, 'Laskar Pelangi', 'Andrea Hirata', 'Fiction', NULL, 6, NULL, '2026-11-20 08:55:34'),
(8, 'Bumi Manusia', 'Pramoedya Ananta Toer', 'Fiction', NULL, 4, NULL, '2026-11-20 08:55:34'),
(9, 'Pride and Prejudice', 'Jane Austen', 'Fiction', NULL, 5, NULL, '2026-11-20 08:55:34'),
(10, '1984', 'George Orwell', 'Fiction', NULL, 7, NULL, '2026-11-20 08:55:34'),
(11, 'The Alchemist', 'Paulo Coelho', 'Fiction', NULL, 8, NULL, '2026-11-20 08:55:34'),
(12, 'To Kill a Mockingbird', 'Harper Lee', 'Fiction', NULL, 3, NULL, '2026-11-20 08:55:34'),
(13, 'Laut Bercerita', 'Leila S. Chudori', 'Fiction', NULL, 5, NULL, '2026-11-20 08:55:34'),
(14, 'Steal Like an Artist', 'Austin Kleon', 'Arts', NULL, 4, NULL, '2026-11-20 08:55:34'),
(15, 'The Story of Art', 'E. H. Gombrich', 'Arts', NULL, 2, NULL, '2026-11-20 08:55:34'),
(16, 'Ways of Seeing', 'John Berger', 'Arts', NULL, 5, NULL, '2026-11-20 08:55:34'),
(17, 'Big Magic', 'Elizabeth Gilbert', 'Arts', NULL, 5, NULL, '2026-11-20 08:55:34'),
(18, 'Guns, Germs, and Steel', 'Jared Diamond', 'History', NULL, 1, NULL, '2026-11-20 08:55:34'),
(19, 'Homo Deus', 'Yuval Noah Harari', 'History', NULL, 5, NULL, '2026-11-20 08:55:34'),
(20, 'SPQR', 'Mary Beard', 'History', NULL, 4, NULL, '2026-11-20 08:55:34'),
(21, 'The Silk Roads', 'Peter Frankopan', 'History', NULL, 3, NULL, '2026-11-20 08:55:34'),
(22, 'Sejarah Indonesia Modern', 'M. C. Ricklefs', 'History', NULL, 6, NULL, '2026-11-20 08:55:34'),
(23, 'Silent Spring', 'Rachel Carson', 'Nature', NULL, 4, NULL, '2026-11-20 08:55:34'),
(24, 'The Hidden Life of Trees', 'Peter Wohlleben', 'Nature', NULL, 5, NULL, '2026-11-20 08:55:34'),
(25, 'A Short History of Nearly Everything', 'Bill Bryson', 'Nature', NULL, 7, NULL, '2026-11-20 08:55:34'),
(26, 'Cosmos', 'Carl Sagan', 'Nature', NULL, 2, NULL, '2026-11-20 08:55:34'),
(27, 'Entangled Life', 'Merlin Sheldrake', 'Nature', NULL, 3, NULL, '2026-11-20 08:55:34'),
(28, 'Atomic Habits', 'James Clear', 'Self-growth', NULL, 0, NULL, '2026-11-23 08:52:23');

-- --------------------------------------------------------

--
-- Struktur dari tabel `kunjungan`
--

CREATE TABLE `kunjungan` (
  `id` int UNSIGNED NOT NULL,
  `user_id` int UNSIGNED DEFAULT NULL,
  `visitor_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `visit_date` date NOT NULL,
  `time_in` time DEFAULT NULL,
  `time_out` time DEFAULT NULL,
  `purpose` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data untuk tabel `kunjungan`
--

INSERT INTO `kunjungan` (`id`, `user_id`, `visitor_name`, `visit_date`, `time_in`, `time_out`, `purpose`, `created_at`) VALUES
(1, 8, 'ananda', '2026-11-22', '09:15:00', '11:30:00', 'Meminjam buku', '2026-11-22 23:58:11'),
(2, 8, 'ananda', '2026-11-21', '09:15:00', '11:30:00', 'Meminjam buku', '2026-11-22 23:58:11'),
(3, 8, 'ananda', '2026-11-20', '09:15:00', '11:30:00', 'Meminjam buku', '2026-11-22 23:58:11'),
(4, 8, 'ananda', '2026-11-18', '09:15:00', '11:30:00', 'Meminjam buku', '2026-11-22 23:58:11'),
(5, 8, 'ananda', '2026-11-16', '09:15:00', '11:30:00', 'Meminjam buku', '2026-11-22 23:58:11'),
(8, NULL, 'Rina Pratama', '2026-11-22', '10:05:00', NULL, 'Membaca di tempat', '2026-11-22 23:58:11'),
(9, NULL, 'Budi Santoso', '2026-11-22', '10:40:00', '12:10:00', 'Mengerjakan tugas', '2026-11-22 23:58:11'),
(10, NULL, 'Dewi Lestari', '2026-11-21', '13:20:00', '15:00:00', 'Mencari referensi', '2026-11-22 23:58:11'),
(11, NULL, 'Agus Wijaya', '2026-11-21', '14:00:00', '16:30:00', 'Membaca di tempat', '2026-11-22 23:58:11'),
(12, NULL, 'Siti Rahmawati', '2026-11-20', '09:45:00', '11:15:00', 'Mengerjakan tugas', '2026-11-22 23:58:11'),
(13, NULL, 'Fajar Nugroho', '2026-11-19', '10:30:00', '12:00:00', 'Mencari referensi', '2026-11-22 23:58:11'),
(14, NULL, 'Maya Anggraini', '2026-11-17', '11:00:00', '13:00:00', 'Membaca di tempat', '2026-11-22 23:58:11'),
(15, 13, 'pou', '2026-11-25', '23:46:15', NULL, 'Login portal anggota', '2026-11-25 23:46:15'),
(16, 11, 'Zyzho Putra Wiliam', '2026-11-25', '23:50:10', NULL, 'Login portal anggota', '2026-11-25 23:50:10'),
(17, 11, 'Zyzho Putra Wiliam', '2026-11-26', '00:00:37', NULL, 'Login portal anggota', '2026-11-26 00:00:37'),
(18, 13, 'pou', '2026-11-26', '00:08:55', NULL, 'Login portal anggota', '2026-11-26 00:08:55'),
(19, 14, 'Aghnia Dhela', '2026-11-26', '00:30:54', NULL, 'Login portal anggota', '2026-11-26 00:30:54'),
(20, 15, 'Olivia', '2026-11-26', '00:37:30', NULL, 'Login portal anggota', '2026-11-26 00:37:30'),
(21, 16, 'Ahmad', '2026-11-26', '00:51:14', NULL, 'Login portal anggota', '2026-11-26 00:51:14');

-- --------------------------------------------------------

--
-- Struktur dari tabel `peminjaman`
--

CREATE TABLE `peminjaman` (
  `id` int UNSIGNED NOT NULL,
  `user_id` int UNSIGNED NOT NULL,
  `book_id` int UNSIGNED NOT NULL,
  `borrowed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `due_date` date DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `renew_count` tinyint UNSIGNED NOT NULL DEFAULT '0',
  `returned_at` datetime DEFAULT NULL,
  `status` enum('pending','borrowed','returned','cancelled','expired') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data untuk tabel `peminjaman`
--

INSERT INTO `peminjaman` (`id`, `user_id`, `book_id`, `borrowed_at`, `due_date`, `confirmed_at`, `renew_count`, `returned_at`, `status`) VALUES
(3, 8, 5, '2026-11-19 20:09:08', '2026-12-10', '2026-11-19 20:09:08', 1, NULL, 'borrowed'),
(5, 8, 6, '2026-11-20 01:23:49', '2026-12-04', '2026-11-20 01:23:49', 0, NULL, 'borrowed'),
(7, 8, 18, '2026-11-21 11:31:20', NULL, NULL, 0, NULL, 'cancelled'),
(8, 8, 10, '2026-11-21 16:02:29', '2026-12-05', '2026-11-21 16:17:45', 0, '2026-11-23 10:42:41', 'returned'),
(9, 8, 27, '2026-11-22 14:36:04', NULL, NULL, 0, NULL, 'cancelled'),
(10, 8, 17, '2026-11-22 14:36:24', NULL, NULL, 0, NULL, 'cancelled'),
(11, 8, 9, '2026-11-22 14:38:28', NULL, NULL, 0, NULL, 'cancelled'),
(12, 8, 22, '2026-11-22 14:41:50', '2026-12-06', '2026-11-22 14:43:39', 0, '2026-11-23 00:12:33', 'returned'),
(13, 11, 8, '2026-11-23 01:10:11', '2026-12-07', '2026-11-23 01:11:37', 0, '2026-11-23 01:11:47', 'returned'),
(14, 11, 10, '2026-11-23 01:12:08', '2026-12-07', '2026-11-23 01:12:16', 0, '2026-11-23 01:12:47', 'returned'),
(15, 11, 18, '2026-11-23 01:13:03', '2026-11-23', '2026-11-23 01:13:14', 0, NULL, 'borrowed'),
(16, 11, 25, '2026-11-23 01:14:28', '2026-12-07', '2026-11-23 01:14:51', 0, '2026-11-23 01:14:54', 'returned'),
(17, 11, 28, '2026-11-23 10:28:53', '2026-11-23', '2026-11-23 10:31:51', 0, NULL, 'borrowed'),
(18, 11, 10, '2026-11-23 10:32:52', '2026-12-07', '2026-11-23 10:33:23', 0, '2026-11-23 10:42:09', 'returned'),
(19, 14, 14, '2026-11-26 00:32:16', '2026-12-10', '2026-11-26 00:49:48', 0, '2026-11-26 01:06:39', 'returned'),
(20, 15, 28, '2026-11-26 01:11:55', '2026-11-27', '2026-11-26 01:11:55', 0, NULL, 'borrowed'),
(21, 16, 18, '2026-11-26 01:14:01', '2026-11-26', '2026-11-26 01:14:01', 0, NULL, 'borrowed');

-- --------------------------------------------------------

--
-- Struktur dari tabel `user`
--

CREATE TABLE `user` (
  `id` int UNSIGNED NOT NULL,
  `npm` varchar(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(15) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('admin','member') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'member',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data untuk tabel `user`
--

INSERT INTO `user` (`id`, `npm`, `full_name`, `email`, `phone`, `password_hash`, `role`, `status`, `created_at`) VALUES
(8, '202543500196', 'ananda', 'as3914583@gmail.com', '081283989378', 'pbkdf2_sha256$600000$5142a2f1632b211033c0c39ed667887d$79d25435f356c7b6ff1f9778f364e8caae8160277c93119e8dc8bc9cefc89cb2', 'member', 'active', '2026-11-18 18:24:22'),
(10, '202543500195', 'Yashi', 'r@gmail.com', '085692991035', 'pbkdf2_sha256$600000$4e89ecac7720847d762b50a7a0b6e940$ea02bcd4af7ee9ddf0b351422ed22b05bc561dd693018d3d8ce60053b5d29ea7', 'admin', 'active', '2026-11-19 09:12:17'),
(11, '202543500194', 'Zyzho Putra Wiliam', 'jijo@gmail.com', '085770312308', 'pbkdf2_sha256$600000$8ca250c115b9ae189ba2d1fcbffd00b4$f347107d2723b55a2fd6c84a3b9be6241dfd7c24bc7337081eb6f14142df7f3f', 'member', 'active', '2026-11-22 16:07:34'),
(12, '202543509870', 'hanip', 'h@gmail.com', '08123456789', 'pbkdf2_sha256$600000$a186017b1efd7e86e4c2e8c1704887ea$3a1780040db5d4c18f49b50847dbd2735b33bdfe0bfcf31d6932593fcb7228af', 'member', 'active', '2026-11-24 13:01:31'),
(13, '202543500190', 'pou', 'p@gmail.com', '08123456444', 'pbkdf2_sha256$600000$aca4f8fec49fa3a788258c50bc3611c5$e2dc69610c71b1e82cfdffb001c2b437443d4908382986f072ad4bb0d0574b85', 'member', 'active', '2026-11-25 23:46:02'),
(14, '202543500175', 'Aghnia Dhela', 'aghnia@gmail.com', '088709870987', 'pbkdf2_sha256$600000$c43d41afe71bf1b88ab4c9e22b7c008c$a8480c89af5113c97e4ee05de05cc73cf340d27eeb6d850d77f10c159bd3312e', 'member', 'active', '2026-11-26 00:30:27'),
(15, '202543500166', 'Olivia', 'olivia.piaaa1234@gmail.com', '085173480913', 'pbkdf2_sha256$600000$2edf30f38e59853f9bb7eecf275615d1$41524c08147fc233660489cd174ffea666f9cd64dbab9beee7743f403da9006a', 'member', 'active', '2026-11-26 00:35:49'),
(16, '202543500201', 'Ahmad', 'luthfisetyanto14@gmail.com', '081389967304', 'pbkdf2_sha256$600000$acbcf8805f8cf1ef072c1edb78898683$a8be0b4db29835908664673755ffd756ed7d07a381d3c9f8f54e4c7a001c29ae', 'member', 'active', '2026-11-26 00:51:02');

--
-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `buku`
--
ALTER TABLE `buku`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_books_isbn` (`isbn`),
  ADD KEY `idx_books_title` (`title`);

--
-- Indeks untuk tabel `kunjungan`
--
ALTER TABLE `kunjungan`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_visits_date` (`visit_date`),
  ADD KEY `idx_visits_user` (`user_id`);

--
-- Indeks untuk tabel `peminjaman`
--
ALTER TABLE `peminjaman`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_loans_user` (`user_id`),
  ADD KEY `idx_loans_book` (`book_id`);

--
-- Indeks untuk tabel `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_users_email` (`email`),
  ADD UNIQUE KEY `uq_users_npm` (`npm`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `buku`
--
ALTER TABLE `buku`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT untuk tabel `kunjungan`
--
ALTER TABLE `kunjungan`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT untuk tabel `peminjaman`
--
ALTER TABLE `peminjaman`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT untuk tabel `user`
--
ALTER TABLE `user`
  MODIFY `id` int UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- Ketidakleluasaan untuk tabel pelimpahan (Dumped Tables)
--

--
-- Ketidakleluasaan untuk tabel `kunjungan`
--
ALTER TABLE `kunjungan`
  ADD CONSTRAINT `fk_visits_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL;

--
-- Ketidakleluasaan untuk tabel `peminjaman`
--
ALTER TABLE `peminjaman`
  ADD CONSTRAINT `fk_loans_book` FOREIGN KEY (`book_id`) REFERENCES `buku` (`id`),
  ADD CONSTRAINT `fk_loans_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
