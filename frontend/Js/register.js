const form = document.getElementById("formRegister");
const message = document.getElementById("errorMessage");
const button = form.querySelector("button[type='submit']");

function showMessage(text, success = false) {
    message.textContent = text;
    message.classList.toggle("sukses", success);
    message.hidden = false;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;
    button.disabled = true;

    try {
        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: form.elements.username.value,
                email: form.elements.email.value,
                password: form.elements.password.value,
            }),
        });
        const data = await response.json().catch(() => ({}));

        if (response.ok) {
            showMessage("Registrasi berhasil. Mengalihkan ke halaman login...", true);
            setTimeout(() => {
                window.location.href = "login.html";
            }, 1200);
        } else {
            showMessage(data.message || "Terjadi kesalahan. Coba lagi.");
            button.disabled = false;
        }
    } catch (error) {
        showMessage("Tidak bisa terhubung ke server.");
        button.disabled = false;
    }
});