// LAPORAN — halaman admin, tersambung ke database lewat /api/admin/reports
lucide.createIcons();

(function () {
  "use strict";

  const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const BULAN_PENUH = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const NAMA_TAB = {
    all: "Semua kategori",
    loans: "Peminjaman",
    visits: "Kunjungan",
    members: "Anggota",
    books: "Koleksi buku"
  };

  function dua(n) { return String(n).padStart(2, "0"); }
  function angka(n) { return Number(n || 0).toLocaleString("id-ID"); }
  function isi(el, teks) { if (el) el.textContent = teks; }

  function parseTanggal(teks) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(teks || ""));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  function keIso(d) {
    return d.getFullYear() + "-" + dua(d.getMonth() + 1) + "-" + dua(d.getDate());
  }

  function tglPendek(d) {
    return dua(d.getDate()) + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
  }

  function tglSumbu(d) {
    return dua(d.getDate()) + " " + BULAN[d.getMonth()];
  }

  function tglPenuh(d) {
    return d.getDate() + " " + BULAN_PENUH[d.getMonth()] + " " + d.getFullYear();
  }

  function hitungSkalaY(values) {
    const maxVal = Math.max.apply(null, [0].concat(values));
    if (maxVal <= 5) return { max: 6, step: 2 };
    if (maxVal <= 10) return { max: 12, step: 3 };
    if (maxVal <= 20) return { max: 25, step: 5 };
    const step = Math.ceil(maxVal / 4 / 5) * 5;
    return { max: step * 4, step: step };
  }

  function teksPerubahan(sekarang, lalu) {
    if (lalu === 0 && sekarang === 0) return "Sama dengan periode sebelumnya (0)";
    if (lalu === 0) return "+" + angka(sekarang) + " dari periode sebelumnya";
    const selisih = sekarang - lalu;
    const tanda = selisih > 0 ? "+" : "";
    return tanda + angka(selisih) + " dibanding periode sebelumnya (" + angka(lalu) + ")";
  }

  function toast(teks, galat) {
    let kotak = document.getElementById("admin-toast");
    if (!kotak) {
      kotak = document.createElement("div");
      kotak.id = "admin-toast";
      kotak.style.cssText =
        "position:fixed;right:24px;bottom:24px;z-index:9999;padding:12px 18px;" +
        "border-radius:12px;font-size:13px;font-weight:600;color:#fff;max-width:360px;" +
        "box-shadow:0 8px 24px rgba(15,23,42,.25);transition:opacity .25s;opacity:0;";
      document.body.appendChild(kotak);
    }
    kotak.style.background = galat ? "#dc2626" : "#16325c";
    kotak.textContent = teks;
    kotak.style.opacity = "1";
    clearTimeout(kotak._timer);
    kotak._timer = setTimeout(function () { kotak.style.opacity = "0"; }, 3500);
  }

  async function panggil(url) {
    const respons = await fetch(url);
    const data = await respons.json().catch(function () { return {}; });
    if (respons.status === 401) {
      window.location.href = "/index";
      throw new Error("Sesi berakhir, silakan login lagi");
    }
    if (!respons.ok) {
      const galat = new Error(data.message || "Gagal memuat laporan");
      galat.status = respons.status;
      throw galat;
    }
    return data;
  }

  // ---------------- elemen filter & tab ----------------
  const selectPeriode = document.getElementById("periode");
  const inputMulai = document.getElementById("mulai");
  const inputAkhir = document.getElementById("akhir");
  const selectKategori = document.getElementById("kategori");
  const filterNotes = document.querySelectorAll(".filter-note span");
  const tabs = document.querySelectorAll("#reportTabs .tab");
  const judulMeta = document.querySelector(".table-card .meta");

  const state = {
    period: "7",
    start: "",
    end: "",
    tab: "all"
  };

  function aturRentangDariPreset(preset) {
    const hariIni = new Date();
    let mulai = new Date(hariIni);

    if (preset === "30") {
      mulai.setDate(hariIni.getDate() - 29);
    } else if (preset === "month") {
      mulai = new Date(hariIni.getFullYear(), hariIni.getMonth(), 1);
    } else {
      mulai.setDate(hariIni.getDate() - 6);
    }

    state.start = keIso(mulai);
    state.end = keIso(hariIni);
    inputMulai.value = state.start;
    inputAkhir.value = state.end;
  }

  function tampilkanKategori(pilihan) {
    const aktif = NAMA_TAB[pilihan] ? pilihan : "all";
    state.tab = aktif;

    if (selectKategori) selectKategori.value = aktif;
    tabs.forEach(function (t) {
      t.classList.toggle("active", t.dataset.tab === aktif);
    });

    document.querySelectorAll("[data-cat]").forEach(function (el) {
      const cocok = aktif === "all" || el.dataset.cat === aktif;
      el.classList.toggle("is-hidden", !cocok);
    });

    document.querySelectorAll(".stats, .charts").forEach(function (baris) {
      const semuaHilang = Array.from(baris.children).every(function (c) {
        return c.classList.contains('is-hidden');
      });
      baris.classList.toggle("is-hidden", semuaHilang);
    });

    if (judulMeta) {
      judulMeta.innerHTML =
        NAMA_TAB[aktif] + " &bull; aktivitas periode dan posisi akhir &bull; " + new Date().getFullYear();
    }
  }

  function simpanUrl() {
    const p = new URLSearchParams(window.location.search);
    ["periode", "mulai", "akhir", "tab"].forEach(function (k) { p.delete(k); });
    if (state.period !== "7") p.set("periode", state.period);
    if (state.period === "custom") {
      if (state.start) p.set("mulai", state.start);
      if (state.end) p.set("akhir", state.end);
    }
    if (state.tab !== "all") p.set("tab", state.tab);
    const qs = p.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
  }

  function bacaUrl() {
    const p = new URLSearchParams(window.location.search);
    const per = p.get("periode");
    const tab = p.get("tab");

    state.period = ["7", "30", "month", "custom"].includes(per) ? per : "7";
    selectPeriode.value = state.period;

    if (state.period === "custom" && p.get("mulai") && p.get("akhir")) {
      state.start = p.get("mulai");
      state.end = p.get("akhir");
      inputMulai.value = state.start;
      inputAkhir.value = state.end;
    } else {
      aturRentangDariPreset(state.period === "custom" ? "7" : state.period);
    }

    tampilkanKategori(NAMA_TAB[tab] ? tab : "all");
  }

  // ---------------- inisialisasi Chart.js ----------------
  const sumbuX = {
    grid: { display: false },
    border: { display: false },
    ticks: { font: { size: 9 }, color: "#94a3b8", maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
  };

  function buatSumbuY(max, step, tampil) {
    return {
      min: 0,
      max: max,
      display: tampil !== false,
      grid: { color: "#f1f5f9" },
      border: { display: false },
      ticks: { stepSize: step, font: { size: 9 }, color: "#94a3b8" }
    };
  }

  const angkaBatang = {
    id: "angkaBatang",
    afterDatasetsDraw: function (chart) {
      const dataArr = chart.data.datasets[0].data || [];
      if (dataArr.length > 14) return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.font = "9px Arial";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      chart.getDatasetMeta(0).data.forEach(function (bar, i) {
        ctx.fillText(dataArr[i], bar.x, bar.y - 5);
      });
      ctx.restore();
    }
  };

  const opsiDasar = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } }
  };

  const chartPinjam = new Chart(document.getElementById("trenPinjam"), {
    type: "bar",
    data: { labels: [], datasets: [{ data: [], backgroundColor: "#2563eb", borderRadius: 3 }] },
    options: { ...opsiDasar, scales: { x: sumbuX, y: buatSumbuY(10, 2, true) } },
    plugins: [angkaBatang]
  });

  const chartKunjungan = new Chart(document.getElementById("trenKunjungan"), {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: "#2563eb",
        borderWidth: 1.5,
        pointRadius: 3,
        pointBackgroundColor: "#2563eb",
        tension: 0.25
      }]
    },
    options: { ...opsiDasar, scales: { x: sumbuX, y: buatSumbuY(10, 2, true) } }
  });

  const chartKembali = new Chart(document.getElementById("trenKembali"), {
    type: "bar",
    data: { labels: [], datasets: [{ data: [], backgroundColor: "#93c5fd", borderRadius: 3 }] },
    options: { ...opsiDasar, scales: { x: sumbuX, y: buatSumbuY(10, 2, false) } },
    plugins: [angkaBatang]
  });

  const chartDonut = new Chart(document.getElementById("donutKoleksi"), {
    type: "doughnut",
    data: {
      labels: ["Tersedia", "Dipinjam", "Perawatan"],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: ["#dbeafe", "#60a5fa", "#2563eb"],
        borderWidth: 0
      }]
    },
    options: {
      cutout: "80%",
      plugins: { legend: { display: false } }
    }
  });

  // ---------------- render data laporan ----------------
  function renderLaporan(data) {
    const dStart = parseTanggal(data.start_date) || new Date();
    const dEnd = parseTanggal(data.end_date) || new Date();
    const rentangTeks = tglPendek(dStart) + " – " + tglPendek(dEnd);
    const hariCount = Number(data.days_count || 1);

    inputMulai.value = data.start_date;
    inputAkhir.value = data.end_date;

    if (filterNotes[0]) {
      filterNotes[0].textContent = "Periode: " + rentangTeks + " (" + hariCount + " hari)";
    }
    if (filterNotes[1]) {
      const sekarang = new Date();
      filterNotes[1].textContent =
        "Diperbarui: " + tglPendek(sekarang) + ", " + dua(sekarang.getHours()) + ":" + dua(sekarang.getMinutes()) + " WIB";
    }

    const totals = data.totals || {};
    const col = data.collection || {};
    const mem = data.members || {};
    const daily = data.daily || [];

    // 1. Empat kartu statistik atas
    const statCards = document.querySelectorAll(".stats .stat");
    if (statCards[0]) {
      isi(statCards[0].querySelector(".stat-number"), angka(totals.loans));
      isi(statCards[0].querySelector(".stat-note"), teksPerubahan(totals.loans, totals.prev_loans));
    }
    if (statCards[1]) {
      isi(statCards[1].querySelector(".stat-number"), angka(totals.visits));
      isi(statCards[1].querySelector(".stat-note"), teksPerubahan(totals.visits, totals.prev_visits));
    }
    if (statCards[2]) {
      isi(statCards[2].querySelector(".stat-number"), angka(totals.returns));
      isi(statCards[2].querySelector(".stat-note"), teksPerubahan(totals.returns, totals.prev_returns));
    }
    if (statCards[3]) {
      isi(statCards[3].querySelector(".stat-number"), angka(mem.active));
      isi(
        statCards[3].querySelector(".stat-note"),
        "Dari " + angka(mem.total) + " anggota terdaftar (+" + angka(mem.new_in_period) + " baru)"
      );
    }

    // 2. Grafik Tren Peminjaman & Tren Kunjungan
    const labels = daily.map(function (item) {
      const d = parseTanggal(item.date);
      return d ? tglSumbu(d) : item.date;
    });
    const seriesPinjam = daily.map(function (item) { return item.loans; });
    const seriesKunjungan = daily.map(function (item) { return item.visits; });
    const seriesKembali = daily.map(function (item) { return item.returns; });

    const topCharts = document.querySelectorAll("section.charts")[0];
    if (topCharts) {
      const cardPinjam = topCharts.children[0];
      const rataPinjam = (totals.loans / hariCount).toFixed(1).replace(".", ",");
      isi(cardPinjam.querySelector(".meta"), rentangTeks + " (" + hariCount + " hari)");
      isi(cardPinjam.querySelector(".chart-total span b"), angka(totals.loans));
      isi(cardPinjam.querySelector(".chart-total .pill"), "Rata-rata " + rataPinjam + "/hari");
      isi(cardPinjam.querySelector(".chart-foot"), "Total transaksi peminjaman terkonfirmasi pada periode terpilih.");

      const cardKunjungan = topCharts.children[1];
      const rataKunjungan = (totals.visits / hariCount).toFixed(1).replace(".", ",");
      isi(cardKunjungan.querySelector(".meta"), rentangTeks + " (" + hariCount + " hari)");
      isi(cardKunjungan.querySelector(".chart-total span b"), angka(totals.visits));
      isi(cardKunjungan.querySelector(".chart-total .pill"), "Rata-rata " + rataKunjungan + "/hari");
      isi(cardKunjungan.querySelector(".chart-foot"), "Total kunjungan anggota tercatat pada periode terpilih.");
    }

    const skalaPinjam = hitungSkalaY(seriesPinjam);
    chartPinjam.data.labels = labels;
    chartPinjam.data.datasets[0].data = seriesPinjam;
    chartPinjam.options.scales.y = buatSumbuY(skalaPinjam.max, skalaPinjam.step, true);
    chartPinjam.update();

    const skalaKunjungan = hitungSkalaY(seriesKunjungan);
    chartKunjungan.data.labels = labels;
    chartKunjungan.data.datasets[0].data = seriesKunjungan;
    chartKunjungan.options.scales.y = buatSumbuY(skalaKunjungan.max, skalaKunjungan.step, true);
    chartKunjungan.update();

    // 3. Grafik Tren Pengembalian
    const returnCard = document.querySelector(".return-card");
    if (returnCard) {
      const rasioKembali = totals.loans > 0
        ? Math.round((totals.returns / totals.loans) * 100) + "% dari total pinjaman periode ini"
        : "Belum ada transaksi pinjaman pada periode ini";
      isi(returnCard.querySelector(".meta"), rentangTeks + " (" + hariCount + " hari)");
      isi(returnCard.querySelector(".chart-total span b"), angka(totals.returns));
      isi(returnCard.querySelector(".pill"), rasioKembali);
      isi(returnCard.querySelector(".chart-foot"), "Rekap harian buku yang dikembalikan anggota ke perpustakaan.");
    }

    const skalaKembali = hitungSkalaY(seriesKembali);
    chartKembali.data.labels = labels;
    chartKembali.data.datasets[0].data = seriesKembali;
    chartKembali.options.scales.y = buatSumbuY(skalaKembali.max, skalaKembali.step, false);
    chartKembali.update();

    // 4. Status Koleksi Buku & Laporan Keanggotaan
    const bottomCharts = document.querySelectorAll("section.charts")[1];
    if (bottomCharts) {
      const cardBuku = bottomCharts.children[0];
      isi(cardBuku.querySelector(".meta"), "Posisi stok per " + tglPenuh(dEnd) + " (" + angka(col.titles) + " judul)");
      isi(cardBuku.querySelector(".donut-center b"), angka(col.total_copies));

      const legendNums = cardBuku.querySelectorAll(".legend div b");
      isi(legendNums[0], angka(col.available));
      isi(legendNums[1], angka(col.borrowed));
      isi(legendNums[2], angka(col.maintenance));

      const miniNums = cardBuku.querySelectorAll(".mini div b");
      isi(miniNums[0], "+" + angka(col.added_today));
      isi(miniNums[1], angka(col.out_today));
      isi(miniNums[2], (col.net_today >= 0 ? "+" : "") + angka(col.net_today));

      chartDonut.data.datasets[0].data = [col.available, col.borrowed, col.maintenance];
      chartDonut.update();

      const cardAnggota = bottomCharts.children[1];
      isi(cardAnggota.querySelector(".meta"), "Posisi keanggotaan per " + tglPenuh(dEnd));
      const memberRows = cardAnggota.querySelectorAll(".row:not(.prop-row) b");
      isi(memberRows[0], angka(mem.total));
      isi(memberRows[1], angka(mem.active));
      isi(memberRows[2], angka(mem.suspended));

      const proporsi = mem.total > 0 ? Math.round((mem.active / mem.total) * 100) : 0;
      isi(cardAnggota.querySelector(".prop-row b"), proporsi + "%");
      const barFill = cardAnggota.querySelector(".prop-bar span");
      if (barFill) barFill.style.width = proporsi + "%";
      isi(
        cardAnggota.querySelector(".note-box b"),
        angka(mem.active) + " dari " + angka(mem.total) + " anggota berstatus aktif"
      );
    }

    // 5. Tabel Ringkasan Terperinci
    const tbody = document.querySelector(".summary-table tbody");
    if (tbody) {
      const rowLoans = tbody.querySelector('tr[data-cat="loans"]');
      if (rowLoans) {
        isi(rowLoans.children[1], angka(totals.loans) + " peminjaman, " + angka(totals.returns) + " pengembalian");
        isi(rowLoans.children[2], angka(totals.loans) + " transaksi");
        isi(rowLoans.children[3], rentangTeks);
      }

      const rowVisits = tbody.querySelector('tr[data-cat="visits"]');
      if (rowVisits) {
        isi(rowVisits.children[1], "Kunjungan tercatat (" + (totals.visits / hariCount).toFixed(1).replace(".", ",") + "/hari)");
        isi(rowVisits.children[2], angka(totals.visits) + " kunjungan");
        isi(rowVisits.children[3], rentangTeks);
      }

      const rowMembers = tbody.querySelector('tr[data-cat="members"]');
      if (rowMembers) {
        isi(rowMembers.children[1], angka(mem.active) + " aktif, " + angka(mem.suspended) + " ditangguhkan");
        isi(rowMembers.children[2], angka(mem.total) + " anggota");
        isi(rowMembers.children[3], tglPendek(dEnd));
      }

      const rowBooks = tbody.querySelector('tr[data-cat="books"]');
      if (rowBooks) {
        isi(rowBooks.children[1], angka(col.available) + " tersedia, " + angka(col.borrowed) + " dipinjam (" + angka(col.titles) + " judul)");
        isi(rowBooks.children[2], angka(col.total_copies) + " eksemplar");
        isi(rowBooks.children[3], tglPendek(dEnd));
      }
    }
  }

  // ---------------- ambil data dari backend ----------------
  async function muatLaporan() {
    const params = new URLSearchParams({ period: state.period });
    if (state.period === "custom" && state.start && state.end) {
      params.set("start", state.start);
      params.set("end", state.end);
    }

    try {
      const data = await panggil("/api/admin/reports?" + params.toString());
      renderLaporan(data);
    } catch (galat) {
      if (galat.status === 403) {
        window.location.href = "/Pages/dashboard";
        return;
      }
      toast(galat.message || "Gagal memuat data laporan dari server.", true);
    }
  }

  // ---------------- event filter & tab ----------------
  selectPeriode.addEventListener("change", function () {
    state.period = selectPeriode.value;
    if (state.period !== "custom") {
      aturRentangDariPreset(state.period);
    }
    simpanUrl();
    muatLaporan();
  });

  function ubahTanggalManual() {
    if (!inputMulai.value || !inputAkhir.value) return;
    if (inputMulai.value > inputAkhir.value) {
      toast("Tanggal mulai tidak boleh lebih besar dari tanggal akhir.", true);
      return;
    }
    state.period = "custom";
    selectPeriode.value = "custom";
    state.start = inputMulai.value;
    state.end = inputAkhir.value;
    simpanUrl();
    muatLaporan();
  }

  inputMulai.addEventListener("change", ubahTanggalManual);
  inputAkhir.addEventListener("change", ubahTanggalManual);

  if (selectKategori) {
    selectKategori.addEventListener("change", function () {
      tampilkanKategori(selectKategori.value);
      simpanUrl();
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tampilkanKategori(tab.dataset.tab);
      simpanUrl();
    });
  });

  // ---------------- mulai ----------------
  bacaUrl();
  muatLaporan();
})();