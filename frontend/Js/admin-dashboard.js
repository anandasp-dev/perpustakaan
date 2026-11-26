/* =========================================================
   admin-dashboard.js — mengisi dashboard admin dengan data dari database.
   Dipasang SETELAH script.js (grafik) dan kalender.js di home.html.
   ========================================================= */
(function () {
  "use strict";

  const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const STATUS_TEKS = {
    pending: "Tunggu konfirmasi",
    borrowed: "Dipinjam",
    returned: "Dikembalikan"
  };

  // ---------------- alat bantu kecil ----------------
  function dua(n) { return String(n).padStart(2, "0"); }
  function angka(n) { return Number(n).toLocaleString("en-US"); }      // 12,480
  function angkaId(n) { return Number(n).toLocaleString("id-ID"); }    // 1.248
  function bertanda(n) { return (n > 0 ? "+" : "") + n; }              // +12 / 0 / -3

  // cegah teks dari database "menyusup" sebagai HTML
  function esc(teks) {
    return String(teks).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

// "2026-11-22" atau "2026-11-22 16:02:29" -> objek tanggal
  function parseTanggal(teks) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(teks || ""));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  // Diperkuat agar otomatis membersihkan suffix ekstra (seperti :1) atau format string lain
  function keIso(d) {
    if (!d) return new Date().toISOString().split("T")[0];
    
    // Jika berupa string (misal terkirim "2026-11-26:1"), ambil murni 10 karakter pertama YYYY-MM-DD
    if (typeof d === "string") {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
      if (m) return m[1] + "-" + m[2] + "-" + m[3];
    }
    
    // Jika berupa objek Date yang valid
    if (d instanceof Date && !isNaN(d)) {
      return d.getFullYear() + "-" + dua(d.getMonth() + 1) + "-" + dua(d.getDate());
    }
    
    // Fallback terakhir jika format lain
    const parsed = new Date(d);
    if (!isNaN(parsed)) {
      return parsed.getFullYear() + "-" + dua(parsed.getMonth() + 1) + "-" + dua(parsed.getDate());
    }
    
    return new Date().toISOString().split("T")[0];
  }
  function tglPendek(d) { return dua(d.getDate()) + " " + BULAN[d.getMonth()]; }      // 22 Nov   // 22 Nov
  function tglPanjang(d) { return tglPendek(d) + " " + d.getFullYear(); }             // 22 Nov 2026
  function waktu(teks) {                                                               // 22 Nov, 16:02
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(teks || ""));
    return m ? m[3] + " " + BULAN[Number(m[2]) - 1] + ", " + m[4] + ":" + m[5] : "-";
  }

  // ---------------- mencari elemen (tanpa mengubah HTML) ----------------
  function cariStat(judul) {          // kartu angka di atas, dikenali dari tulisan judulnya
    return Array.from(document.querySelectorAll(".stat")).find(function (kartu) {
      const span = kartu.querySelector(".stat-top span");
      return span && span.textContent.trim() === judul;
    });
  }
  function cariKartu(judul) {         // kartu lain, dikenali dari <h3>-nya
    return Array.from(document.querySelectorAll(".card")).find(function (kartu) {
      const h = kartu.querySelector("h3");
      return h && h.textContent.trim() === judul;
    });
  }
  function isi(el, teks) { if (el) el.textContent = teks; }

  // ganti hanya tulisan di dalam elemen, ikon (svg) di dalamnya dibiarkan
  function isiTeksSaja(el, teks) {
    const simpul = Array.from(el.childNodes).reverse().find(function (n) {
      return n.nodeType === 3 && n.nodeValue.trim() !== "";
    });
    if (simpul) simpul.nodeValue = " " + teks;
    else el.appendChild(document.createTextNode(" " + teks));
  }

  function tampilkanPesan(teks) {
    let el = document.getElementById("dash-error");
    if (!el) {
      el = document.createElement("div");
      el.id = "dash-error";
      el.className = "alert";
      el.style.marginBottom = "16px";
      document.querySelector(".content").prepend(el);
    }
    el.textContent = teks;
  }

  // ---------------- mengisi dashboard ----------------
  function isiDashboard(data) {
    const tgl = parseTanggal(data.date);
    const sekarang = new Date();

    // 1) kartu angka di atas
    const kartuPengunjung = cariStat("Pengunjung hari ini");
    if (kartuPengunjung) {
      const hariIni = Number(data.visitors_today || 0);
      const mingguLalu = Number(data.visitors_last_week || 0);
      isi(kartuPengunjung.querySelector(".stat-number"), angka(hariIni));

      let catatanPengunjung;
      if (mingguLalu > 0) {
        const persen = Math.round(((hariIni - mingguLalu) / mingguLalu) * 100);
        catatanPengunjung = bertanda(persen) + "% dibanding " + NAMA_HARI[tgl.getDay()] + " lalu";
      } else {
        catatanPengunjung = bertanda(hariIni) + " dibanding " + NAMA_HARI[tgl.getDay()] + " lalu";
      }
      isi(kartuPengunjung.querySelector(".stat-note"), catatanPengunjung);
    }

    const kartuDipinjam = cariStat("Buku dipinjam hari ini");
    if (kartuDipinjam) {
      isi(kartuDipinjam.querySelector(".stat-number"), angka(data.borrowed_today));
      const selisih = data.borrowed_today - data.borrowed_last_week;
      isi(kartuDipinjam.querySelector(".stat-note"),
        bertanda(selisih) + " dibanding " + NAMA_HARI[tgl.getDay()] + " lalu");
    }
    const kartuTotal = cariStat("Total buku");
    if (kartuTotal) {
      isi(kartuTotal.querySelector(".stat-number"), angka(data.total_copies));
      isi(kartuTotal.querySelector(".stat-note"), angkaId(data.unique_titles) + " judul unik");
    }
    const kartuAnggota = cariStat("Anggota aktif");
    if (kartuAnggota) {
      isi(kartuAnggota.querySelector(".stat-number"), angka(data.active_members));
      isi(kartuAnggota.querySelector(".stat-note"), "+" + data.new_members_month + " bulan ini");
    }

    // 2) grafik "Buku dipinjam per hari"
    const kartuGrafik = cariKartu("Buku dipinjam per hari");
    const grafik = window.Chart && Chart.getChart("peminjamanChart");
    if (kartuGrafik && grafik) {
      const hari7 = data.borrowed_per_day;
      const nilai = hari7.map(function (h) { return h.total; });
      grafik.data.labels = hari7.map(function (h) { return NAMA_HARI[parseTanggal(h.date).getDay()]; });
      grafik.data.datasets[0].data = nilai;
      // script.js mengunci sumbu Y di 0-120; lepaskan supaya mengikuti data asli
      grafik.options.scales.y.max = undefined;
      grafik.options.scales.y.ticks.stepSize = undefined;
      grafik.options.scales.y.ticks.precision = 0;
      grafik.update();

      const jumlah = nilai.reduce(function (a, b) { return a + b; }, 0);
      isi(kartuGrafik.querySelector(".chart-total b"), angka(jumlah));
      isi(kartuGrafik.querySelector(".pill"), data.borrowed_today + " hari ini");
      isi(kartuGrafik.querySelector(".meta"),
        tglPendek(parseTanggal(hari7[0].date)) + " - " + tglPendek(tgl) + " • 7 Hari terakhir");
    }

    // 3) status koleksi buku (donut)
    const kartuKoleksi = cariKartu("Status koleksi buku");
    if (kartuKoleksi) {
      const k = data.collection;
      const dipinjam = k.borrowed + k.pending;   // yang sedang dipinjam + yang sudah dibooking
      const perawatan = 0;                        // belum ada fitur perawatan di database
      const donat = window.Chart && Chart.getChart("donutChart");
      if (donat) {
        donat.data.datasets[0].data = [k.available, dipinjam, perawatan];
        donat.update();
      }
      isi(kartuKoleksi.querySelector(".donut-center b"), angka(data.total_copies));
      const angkaLegend = kartuKoleksi.querySelectorAll(".legend > div b");
      [k.available, dipinjam, perawatan].forEach(function (n, i) { isi(angkaLegend[i], angka(n)); });
      isi(kartuKoleksi.querySelector(".meta"), "Stok langsung • " + tglPanjang(sekarang));
    }

    // 4) layanan pemakaian, ringkasan anggota, peringatan terlambat
    const kartuLayanan = cariKartu("Layanan pemakaian hari ini");
    if (kartuLayanan) {
      const tile = kartuLayanan.querySelectorAll(".tile b");
      isi(tile[0], angka(data.borrowed_today));
      isi(tile[1], angka(data.returned_today));
      isi(tile[2], bertanda(data.borrowed_today - data.returned_today));

      const baris = kartuLayanan.querySelectorAll(".row b");
      isi(baris[0], angka(data.active_members));   // anggota terdaftar
      isi(baris[1], angka(data.active_members));   // anggota aktif (belum ada kolom status)
      isi(baris[2], "0");                           // ditangguhkan (belum ada fiturnya)

      isi(kartuLayanan.querySelector(".meta"),
        NAMA_HARI[tgl.getDay()] + ", " + tglPendek(tgl) + " • Aktivitas sampai 17:00");

      const peringatan = kartuLayanan.querySelector(".alert");
      if (peringatan) {
        isiTeksSaja(peringatan, data.overdue > 0
          ? data.overdue + " pinjaman terlambat perlu diingatkan!"
          : "Tidak ada pinjaman terlambat.");
      }
    }

    // 5) peminjam paling aktif
    const kartuTop = cariKartu("Peminjam paling aktif");
    if (kartuTop) {
      kartuTop.querySelectorAll(".list-item, .list-kosong").forEach(function (el) { el.remove(); });
      isi(kartuTop.querySelector(".meta"), tglPanjang(tgl) + " • Bulan ini");
      if (data.top_borrowers.length === 0) {
        const kosong = document.createElement("p");
        kosong.className = "meta list-kosong";
        kosong.textContent = "Belum ada peminjaman yang dikonfirmasi bulan ini.";
        kartuTop.appendChild(kosong);
      }
      data.top_borrowers.forEach(function (p, i) {
        const item = document.createElement("div");
        item.className = "list-item";
        item.innerHTML =
          '<span class="no">' + dua(i + 1) + "</span>" +
          '<span class="av">' + esc(p.initials) + "</span>" +
          '<span class="name">' + esc(p.name) + "<small>" + esc(p.member_id) + "</small></span>" +
          '<span class="val">' + p.total + "</span>";
        kartuTop.appendChild(item);
      });
    }

    // 6) tabel peminjaman terbaru
    const kartuTabel = document.querySelector(".table-card");
    if (kartuTabel) {
      const rows = data.recent_loans;
      kartuTabel.querySelector("tbody").innerHTML = rows.length === 0
        ? '<tr><td colspan="5" class="muted">Belum ada peminjaman.</td></tr>'
        : rows.map(function (p) {
            const tempo = p.due_date ? tglPanjang(parseTanggal(p.due_date)) : "—";
            return "<tr>" +
              "<td>" + esc(p.borrower) + "</td>" +
              "<td>" + esc(p.title) + "</td>" +
              '<td class="muted">' + waktu(p.loaned_at) + "</td>" +
              "<td>" + tempo + "</td>" +
              '<td><span class="tag">' + (STATUS_TEKS[p.status] || esc(p.status)) + "</span></td>" +
              "</tr>";
          }).join("");
      isi(kartuTabel.querySelector(".meta"),
        "Peminjaman terbaru • " + rows.length + " dari " + angka(data.recent_total) + " transaksi");
      const tautan = kartuTabel.querySelector("a.link");
      if (tautan) {
        tautan.setAttribute("href", "admin?page=peminjaman");
        tautan.dataset.page = "peminjaman";   // supaya ditangani router (tanpa reload)
      }
    }
  }

  // ---------------- mengambil data dari server ----------------
  async function muat(tanggal) {
    try {
      const respons = await fetch("/api/admin/dashboard?date=" + keIso(tanggal));
      const data = await respons.json().catch(function () { return {}; });

      if (respons.status === 401) {                 // belum login
        window.location.href = "/index";
        return;
      }
      if (respons.status === 403) {                 // login, tapi bukan admin
        window.location.href = "/Pages/dashboard";
        return;
      }
      if (!respons.ok) throw new Error(data.message || "Permintaan gagal");

      const pesan = document.getElementById("dash-error");
      if (pesan) pesan.remove();
      isiDashboard(data);
    } catch (galat) {
      console.warn("Gagal memuat dashboard:", galat);
      tampilkanPesan("Gagal memuat data dashboard dari server.");
    }
  }

  // kalender.js mengirim sinyal "kalender:terapkan" saat tombol Terapkan ditekan.
  // Pendengar lama dibuang dulu supaya tidak menumpuk tiap Dashboard dibuka lagi.
  if (window._dashKalender) {
    document.removeEventListener("kalender:terapkan", window._dashKalender);
  }
  window._dashKalender = function (e) {
    if (!document.getElementById("peminjamanChart")) return;  // Dashboard sedang tidak tampil
    muat(e.detail.tanggal);
  };
  document.addEventListener("kalender:terapkan", window._dashKalender);

  muat(new Date());
})();