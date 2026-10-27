// Mengambil elemen form berdasarkan ID
const form = document.getElementById("formLogin");

// Menambahkan event listener saat form di-submit
form.addEventListener("submit", function(event) {
    // 1. Mencegah sifat bawaan form yang me-refresh halaman
    event.preventDefault();

    // 2. Ambil nilai (value) dari inputan user
    const emailValue = document.getElementById("email").value;
    const passwordValue = document.getElementById("password").value;

    // 3. Lakukan validasi sederhana
    if (emailValue === "" || passwordValue === "") {
        alert("Email dan Password tidak boleh kosong!");
        return; // Hentikan eksekusi kode di sini jika kosong
    }

    // (Di aplikasi nyata, bagian ini dipakai untuk mengecek data ke database server)

    // 4. Jika validasi lolos, pindahkan user ke menu utama
    window.location.href = "main.html"; // Sesuaikan dengan nama file menu utamamu
});