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
  function angka(n) { return Number(n || 0).toLocaleString("id-ID"); }
  function bertanda(n) { return (n > 0 ? "+" : "") + n; }

  // cegah teks dari database "menyusup" sebagai HTML
  function esc(teks) {
    return String(teks ?? "").replace(/[&<>"']/g, function (c) {
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

    if (typeof d === "string") {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
      if (m) return m[1] + "-" + m[2] + "-" + m[3];
    }

    if (d instanceof Date && !isNaN(d)) {
      return d.getFullYear() + "-" + dua(d.getMonth() + 1) + "-" + dua(d.getDate());
    }

    const parsed = new Date(d);
    if (!isNaN(parsed)) {
      return parsed.getFullYear() + "-" + dua(parsed.getMonth() + 1) + "-" + dua(parsed.getDate());
    }

    return new Date().toISOString().split("T")[0];
  }

  function tglPendek(d) { return dua(d.getDate()) + " " + BULAN[d.getMonth()]; }
  function tglPanjang(d) { return tglPendek(d) + " " + d.getFullYear(); }
  function waktu(teks) {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(teks || ""));
    return m ? m[3] + " " + BULAN[Number(m[2]) - 1] + ", " + m[4] + ":" + m[5] : "-";
  }

  // ---------------- mencari elemen (tanpa mengubah HTML) ----------------
  function cariStat(judul) {
    return Array.from(document.querySelectorAll(".stat")).find(function (kartu) {
      const span = kartu.querySelector(".stat-top span");
      return span && span.textContent.trim() === judul;
    });
  }
  function cariKartu(judul) {
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
    const content = document.querySelector(".content");
    if (!content) return;
    let el = document.getElementById("dash-error");
    if (!el) {
      el = document.createElement("div");
      el.id = "dash-error";
      el.className = "alert";
      el.style.marginBottom = "16px";
      content.prepend(el);
    }
    el.textContent = teks;
  }

  // ---------------- mengisi dashboard ----------------
  function isiDashboard(data) {
    const tgl = parseTanggal(data.date) || new Date();
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
      const pinjamHariIni = Number(data.borrowed_today || 0);
      const pinjamMingguLalu = Number(data.borrowed_last_week || 0);
      isi(kartuDipinjam.querySelector(".stat-number"), angka(pinjamHariIni));
      const selisih = pinjamHariIni - pinjamMingguLalu;
      isi(kartuDipinjam.querySelector(".stat-note"),
        bertanda(selisih) + " dibanding " + NAMA_HARI[tgl.getDay()] + " lalu");
    }

    const kartuTotal = cariStat("Total buku");
    if (kartuTotal) {
      isi(kartuTotal.querySelector(".stat-number"), angka(data.total_copies));
      isi(kartuTotal.querySelector(".stat-note"), angka(data.unique_titles) + " judul unik");
    }

    const kartuAnggota = cariStat("Anggota aktif");
    if (kartuAnggota) {
      isi(kartuAnggota.querySelector(".stat-number"), angka(data.active_members));
      isi(kartuAnggota.querySelector(".stat-note"), "+" + angka(data.new_members_month) + " bulan ini");
    }

    // 2) grafik "Buku dipinjam per hari"
    const kartuGrafik = cariKartu("Buku dipinjam per hari");
    const grafik = window.Chart && Chart.getChart("peminjamanChart");
    if (kartuGrafik && grafik) {
      const hari7 = Array.isArray(data.borrowed_per_day) ? data.borrowed_per_day : [];
      const nilai = hari7.map(function (h) { return Number(h.total || 0); });
      grafik.data.labels = hari7.map(function (h) {
        const d = parseTanggal(h.date);
        return d ? NAMA_HARI[d.getDay()] : "";
      });
      grafik.data.datasets[0].data = nilai;
      grafik.options.scales.y.max = undefined;
      grafik.options.scales.y.ticks.stepSize = undefined;
      grafik.options.scales.y.ticks.precision = 0;
      grafik.update();

      const jumlah = nilai.reduce(function (a, b) { return a + b; }, 0);
      const awalTgl = hari7.length > 0 ? parseTanggal(hari7[0].date) : tgl;
      isi(kartuGrafik.querySelector(".chart-total b"), angka(jumlah));
      isi(kartuGrafik.querySelector(".pill"), angka(data.borrowed_today) + " hari ini");
      isi(kartuGrafik.querySelector(".meta"),
        tglPendek(awalTgl || tgl) + " - " + tglPendek(tgl) + " \u2022 7 Hari terakhir");
    }

    // 3) status koleksi buku (donut)
    const kartuKoleksi = cariKartu("Status koleksi buku");
    if (kartuKoleksi) {
      const k = data.collection || {};
      const tersedia = Number(k.available || 0);
      const dipinjam = Number(k.borrowed || 0) + Number(k.pending || 0);
      const perawatan = 0;
      const donat = window.Chart && Chart.getChart("donutChart");
      if (donat) {
        donat.data.datasets[0].data = [tersedia, dipinjam, perawatan];
        donat.update();
      }
      isi(kartuKoleksi.querySelector(".donut-center b"), angka(data.total_copies));
      const angkaLegend = kartuKoleksi.querySelectorAll(".legend > div b");
      [tersedia, dipinjam, perawatan].forEach(function (n, i) { isi(angkaLegend[i], angka(n)); });
      isi(kartuKoleksi.querySelector(".meta"), "Stok langsung \u2022 " + tglPanjang(sekarang));
    }

    // 4) layanan pemakaian, ringkasan anggota, peringatan terlambat
    const kartuLayanan = cariKartu("Layanan pemakaian hari ini");
    if (kartuLayanan) {
      const pinjamHariIni = Number(data.borrowed_today || 0);
      const kembaliHariIni = Number(data.returned_today || 0);
      const tile = kartuLayanan.querySelectorAll(".tile b");
      isi(tile[0], angka(pinjamHariIni));
      isi(tile[1], angka(kembaliHariIni));
      isi(tile[2], bertanda(pinjamHariIni - kembaliHariIni));

      const baris = kartuLayanan.querySelectorAll(".row b");
      isi(baris[0], angka(data.active_members));
      isi(baris[1], angka(data.active_members));
      isi(baris[2], "0");

      isi(kartuLayanan.querySelector(".meta"),
        NAMA_HARI[tgl.getDay()] + ", " + tglPendek(tgl) + " \u2022 Aktivitas sampai 17:00");

      const peringatan = kartuLayanan.querySelector(".alert");
      if (peringatan) {
        const terlambat = Number(data.overdue || 0);
        isiTeksSaja(peringatan, terlambat > 0
          ? terlambat + " pinjaman terlambat perlu diingatkan!"
          : "Tidak ada pinjaman terlambat.");
      }
    }

    // 5) peminjam paling aktif
    const kartuTop = cariKartu("Peminjam paling aktif");
    if (kartuTop) {
      kartuTop.querySelectorAll(".list-item, .list-kosong").forEach(function (el) { el.remove(); });
      isi(kartuTop.querySelector(".meta"), tglPanjang(tgl) + " \u2022 Bulan ini");
      const topList = Array.isArray(data.top_borrowers) ? data.top_borrowers : [];
      if (topList.length === 0) {
        const kosong = document.createElement("p");
        kosong.className = "meta list-kosong";
        kosong.textContent = "Belum ada peminjaman yang dikonfirmasi bulan ini.";
        kartuTop.appendChild(kosong);
      }
      topList.forEach(function (p, i) {
        const item = document.createElement("div");
        item.className = "list-item";
        item.innerHTML =
          '<span class="no">' + dua(i + 1) + "</span>" +
          '<span class="av">' + esc(p.initials) + "</span>" +
          '<span class="name">' + esc(p.name) + "<small>" + esc(p.member_id) + "</small></span>" +
          '<span class="val">' + angka(p.total) + "</span>";
        kartuTop.appendChild(item);
      });
    }

    // 6) tabel peminjaman terbaru
    const kartuTabel = document.querySelector(".table-card");
    if (kartuTabel) {
      const rows = Array.isArray(data.recent_loans) ? data.recent_loans : [];
      kartuTabel.querySelector("tbody").innerHTML = rows.length === 0
        ? '<tr><td colspan="5" class="muted">Belum ada peminjaman.</td></tr>'
        : rows.map(function (p) {
            const dTempo = parseTanggal(p.due_date);
            const tempo = dTempo ? tglPanjang(dTempo) : "\u2014";
            return "<tr>" +
              "<td>" + esc(p.borrower) + "</td>" +
              "<td>" + esc(p.title) + "</td>" +
              '<td class="muted">' + waktu(p.loaned_at) + "</td>" +
              "<td>" + tempo + "</td>" +
              '<td><span class="tag">' + (STATUS_TEKS[p.status] || esc(p.status)) + "</span></td>" +
              "</tr>";
          }).join("");
      isi(kartuTabel.querySelector(".meta"),
        "Peminjaman terbaru \u2022 " + rows.length + " dari " + angka(data.recent_total) + " transaksi");
      const tautan = kartuTabel.querySelector("a.link");
      if (tautan) {
        tautan.setAttribute("href", "?page=peminjaman");
        tautan.dataset.page = "peminjaman";
      }
    }
  }

  // ---------------- mengambil data dari server ----------------
  async function muat(tanggal) {
    try {
      const tanggalBersih = keIso(tanggal).split(":")[0];
      const respons = await fetch("/api/admin/dashboard?date=" + tanggalBersih, {
        credentials: "same-origin"
      });
      const data = await respons.json().catch(function () { return {}; });

      if (respons.status === 401) {
        window.location.href = "/index";
        return;
      }
      if (respons.status === 403) {
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

  if (window._dashKalender) {
    document.removeEventListener("kalender:terapkan", window._dashKalender);
  }
  window._dashKalender = function (e) {
    if (!document.getElementById("peminjamanChart")) return;
    muat(e.detail.tanggal);
  };
  document.addEventListener("kalender:terapkan", window._dashKalender);

  muat(new Date());
})();