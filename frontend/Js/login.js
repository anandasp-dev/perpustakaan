const form = document.getElementById("formLogin");
const message = document.getElementById("errorMessage");
const button = form.querySelector("button[type='submit']");

function showError(text) {
    message.textContent = text;
    message.hidden = false;
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.hidden = true;
    button.disabled = true;

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                identifier: form.elements.identifier.value,
                password: form.elements.password.value,
            }),
        });
        const data = await response.json().catch(() => ({}));

        if (response.ok) {
            window.location.href = "dashboard.html";
        } else {
            showError(data.message || "Terjadi kesalahan. Coba lagi.");
            button.disabled = false;
        }
    } catch (error) {
        showError("Tidak bisa terhubung ke server.");
        button.disabled = false;
    }
});