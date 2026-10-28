// Interaksi tampilan umum, dipakai semua halaman.
// Logika bisnis (login, register, dst.) ada di Python, bukan di sini.
(function () {
    const toggle = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");
    if (!toggle || !passwordInput) return;

    // Biar ikon bisa diakses keyboard dan pembaca layar
    toggle.setAttribute("role", "button");
    toggle.setAttribute("tabindex", "0");
    toggle.setAttribute("aria-label", "Tampilkan password");

    const toggleVisibility = () => {
        const sedangTersembunyi = passwordInput.type === "password";
        passwordInput.type = sedangTersembunyi ? "text" : "password";
        toggle.classList.toggle("fa-eye", sedangTersembunyi);
        toggle.classList.toggle("fa-eye-slash", !sedangTersembunyi);
        toggle.setAttribute(
            "aria-label",
            sedangTersembunyi ? "Sembunyikan password" : "Tampilkan password"
        );
    };

    toggle.addEventListener("click", toggleVisibility);
    toggle.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleVisibility();
        }
    });
})();