/* =========================================================
   Keyto LIBRARY — SKRIP HALAMAN LOGIN & REGISTER
   Tampilan (tab, toast, ikon mata) disalin dari app.js temanmu.
   Login/register sekarang memanggil API Python, bukan data palsu.
   ========================================================= */
(function () {
  "use strict";

  // Halaman tujuan setelah login. Role ditentukan oleh server (database).
  // Ganti ADMIN_PAGE menjadi "admin" kalau halaman admin sudah ada.
  const MEMBER_PAGE = "/Pages/dashboard";
  const ADMIN_PAGE = "/Pages/admin";

  // ---------- Toast ----------
  window.showToast = function (message) {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.25s ease";
      setTimeout(() => toast.remove(), 260);
    }, 3000);
  };

  // ---------- Tab Login / Register ----------
  window.switchAuthTab = function (tab) {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const headerLogin = document.getElementById("auth-header-login");
    const headerRegister = document.getElementById("auth-header-register");
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");

    if (!loginForm || !registerForm) return;

    if (tab === "register") {
      loginForm.classList.add("hidden");
      registerForm.classList.remove("hidden");
      headerLogin.classList.add("hidden");
      headerRegister.classList.remove("hidden");
      tabLogin.classList.remove("active");
      tabRegister.classList.add("active", "register-mode");
    } else {
      registerForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
      headerRegister.classList.add("hidden");
      headerLogin.classList.remove("hidden");
      tabRegister.classList.remove("active", "register-mode");
      tabLogin.classList.add("active");
    }
  };

  // ---------- Tampilkan / sembunyikan password ----------
  window.togglePassword = function (inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    btn.style.color = isPassword ? "#16325c" : "";
  };

  // ---------- Bantuan kirim data ke API ----------
  async function postJSON(url, data) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, body: body };
  }

  // ---------- Aturan input (HARUS sama dengan auth_controller.py) ----------
  const NPM_RE = /^[0-9]{12}$/;
  const PHONE_RE = /^08[0-9]{8,11}$/;

  // Buang karakter selain angka saat mengetik atau paste
  function onlyDigits(inputId, maxLength) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("input", function () {
      input.value = input.value.replace(/[^0-9]/g, "").slice(0, maxLength);
    });
  }
  onlyDigits("reg-npm", 12);
  onlyDigits("reg-phone", 13);

  // ---------- Login (Member dan Admin lewat satu formulir) ----------
  window.handleLogin = async function (e) {
    e.preventDefault();
    const button = e.target.querySelector("button[type='submit']");
    const identifier = document.getElementById("login-identifier").value.trim();
    const password = document.getElementById("login-password").value;
    if (!identifier || !password) return;

    button.disabled = true;
    try {
      const { ok, body } = await postJSON("/api/auth/login", { identifier, password });
      if (!ok) {
        showToast(body.message || "Terjadi kesalahan. Coba lagi.");
        return;
      }
      // Role dikirim server, jadi otomatis tahu ini Member atau Admin
      window.location.href = body.user.role === "admin" ? ADMIN_PAGE : MEMBER_PAGE;
    } catch (error) {
      showToast("Tidak bisa terhubung ke server.");
    } finally {
      button.disabled = false;
    }
  };

  // ---------- Register (khusus Member) ----------
  window.handleRegister = async function (e) {
    e.preventDefault();
    const button = e.target.querySelector("button[type='submit']");
    const fullName = document.getElementById("reg-name").value.trim();
    const npm = document.getElementById("reg-npm").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const phone = document.getElementById("reg-phone").value.trim();
    const pass = document.getElementById("reg-password").value;
    const confirm = document.getElementById("reg-confirm").value;

    if (!NPM_RE.test(npm)) {
      showToast("NPM harus 12 digit angka.");
      return;
    }
    if (!PHONE_RE.test(phone)) {
      showToast("Nomor HP harus diawali 08, hanya angka, 10-13 digit.");
      return;
    }
    if (pass !== confirm) {
      showToast("Konfirmasi password tidak cocok.");
      return;
    }

    button.disabled = true;
    try {
      const { ok, body } = await postJSON("/api/auth/register", {
        npm: npm,
        full_name: fullName,
        email: email,
        phone: phone,
        password: pass
      });
      if (!ok) {
        showToast(body.message || "Terjadi kesalahan. Coba lagi.");
        return;
      }
      showToast("Registrasi berhasil. Silakan login.");
      document.getElementById("login-identifier").value = npm;
      document.getElementById("login-password").value = "";
      switchAuthTab("login");
    } catch (error) {
      showToast("Tidak bisa terhubung ke server.");
    } finally {
      button.disabled = false;
    }
  };
})();