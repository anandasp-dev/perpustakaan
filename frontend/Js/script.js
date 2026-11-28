/* script.js — grafik Chart.js untuk dashboard admin.
   Dibungkus fungsi supaya aman dimuat ulang tiap pindah menu,
   dan hanya menggambar grafik yang kanvasnya ada di halaman. */
(function () {
  "use strict";

  if (window.lucide) lucide.createIcons();
  if (!window.Chart) return;

  const hari = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const datapengunjung = [130, 128, 143, 135, 160, 188, 156];
  const dataPeminjaman = [64, 72, 68, 80, 96, 102, 84];

  const sumbuX = {
    grid: { display: false },
    border: { display: false },
    ticks: { font: { size: 9 }, color: "#94a3b8" }
  };

  function sumbuY(max, step) {
    return {
      min: 0,
      max: max,
      grid: { color: "#e5e7eb" },
      border: { display: false, dash: [4, 4] },
      ticks: { stepSize: step, font: { size: 9 }, color: "#94a3b8" }
    };
  }

  function gambar(id, konfigurasi) {
    const kanvas = document.getElementById(id);
    if (!kanvas) return;
    const lama = Chart.getChart(kanvas);
    if (lama) lama.destroy();
    new Chart(kanvas, konfigurasi);
  }

  gambar("pengunjungChart", {
    type: "line",
    data: {
      labels: hari,
      datasets: [{
        data: datapengunjung,
        borderColor: "#2563eb",
        borderWidth: 1.5,
        pointRadius: 3,
        pointBackgroundColor: "#2563eb"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: sumbuX, y: sumbuY(200, 50) }
    }
  });

  gambar("peminjamanChart", {
    type: "bar",
    data: {
      labels: hari,
      datasets: [{
        data: dataPeminjaman,
        backgroundColor: "#2563eb",
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: sumbuX, y: sumbuY(120, 30) }
    }
  });

  gambar("donutChart", {
    type: "doughnut",
    data: {
      labels: ["Tersedia", "Dipinjam", "Perawatan/Rusak"],
      datasets: [{
        data: [9340, 2860, 280],
        backgroundColor: ["#dbeafe", "#60a5fa", "#2463eb"],
        borderWidth: 0
      }]
    },
    options: {
      cutout: "80%",
      plugins: { legend: { display: false } }
    }
  });
})();