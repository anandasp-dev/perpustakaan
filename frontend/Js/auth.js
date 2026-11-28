/* =========================================================
   Keyto LIBRARY — SKRIP HALAMAN LOGIN & REGISTER
   ========================================================= */
(function () {
  "use strict";

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
      if (headerLogin) headerLogin.classList.add("hidden");
      if (headerRegister) headerRegister.classList.remove("hidden");
      if (tabLogin) tabLogin.classList.remove("active");
      if (tabRegister) tabRegister.classList.add("active", "register-mode");
    } else {
      registerForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
      if (headerRegister) headerRegister.classList.add("hidden");
      if (headerLogin) headerLogin.classList.remove("hidden");
      if (tabRegister) tabRegister.classList.remove("active", "register-mode");
      if (tabLogin) tabLogin.classList.add("active");
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
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, body: body };
  }

  // ---------- Aturan input ----------
  const NPM_RE = /^[0-9]{12}$/;
  const PHONE_RE = /^08[0-9]{8,11}$/;

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
    const programStudyEl = document.getElementById("reg-prodi");
    const programStudy = programStudyEl ? programStudyEl.value.trim() : "";
    const email = document.getElementById("reg-email").value.trim();
    const phone = document.getElementById("reg-phone").value.trim();
    const pass = document.getElementById("reg-password").value;
    const confirm = document.getElementById("reg-confirm").value;

    if (fullName.length < 3) {
      showToast("Nama lengkap minimal 3 karakter.");
      return;
    }
    if (!NPM_RE.test(npm)) {
      showToast("NPM harus 12 digit angka.");
      return;
    }
    if (!programStudy) {
      showToast("Pilih program studi terlebih dahulu.");
      return;
    }
    if (!PHONE_RE.test(phone)) {
      showToast("Nomor HP harus diawali 08, hanya angka, 10-13 digit.");
      return;
    }
    if (pass.length < 8) {
      showToast("Password minimal 8 karakter.");
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
        program_study: programStudy,
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