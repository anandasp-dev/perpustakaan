import html
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

import config

def send_admin_activation_email(to_email, full_name, link, hours=24):
    name = full_name or "Admin"
    msg = EmailMessage()
    msg["Subject"] = f"Aktivasi Akun Admin {config.MAIL_FROM_NAME}"
    msg["From"] = formataddr((config.MAIL_FROM_NAME, config.SMTP_USER or "noreply@localhost"))
    msg["To"] = to_email

    msg.set_content(
        f"Halo {name},\n\n"
        f"Anda telah ditambahkan sebagai Administrator di {config.MAIL_FROM_NAME}.\n"
        f"Buka tautan berikut untuk mengaktifkan akun dan membuat kata sandi Anda (berlaku {hours} jam):\n\n"
        f"{link}\n\n"
        "Jika Anda tidak merasa didaftarkan, abaikan email ini.\n"
    )
    msg.add_alternative(
        f"<p>Halo {html.escape(name)},</p>"
        f"<p>Anda telah ditambahkan sebagai <b>Administrator</b> di "
        f"{html.escape(config.MAIL_FROM_NAME)}.</p>"
        f'<p><a href="{html.escape(link)}">Aktifkan Akun &amp; Buat Kata Sandi</a><br>'
        f"<small>Tautan berlaku {hours} jam.</small></p>"
        "<p>Jika Anda tidak merasa didaftarkan, abaikan email ini.</p>",
        subtype="html",
    )
    _send(msg)
    
def _send(msg):
    if not config.SMTP_USER or not config.SMTP_PASSWORD:
        if config.PRODUCTION:
            raise RuntimeError("SMTP_USER / SMTP_PASSWORD belum diatur")
        # Mode uji: cetak isi email di terminal, jangan kirim
        print("\n=== [MODE UJI] SMTP belum diatur, email TIDAK dikirim. Isinya: ===")
        print("Ke     :", msg["To"])
        print("Subjek :", msg["Subject"])
        print(msg.get_body(preferencelist=("plain",)).get_content())
        print("=== akhir email ===\n")
        return

    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as smtp:
        smtp.starttls()
        smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
        smtp.send_message(msg)


def send_reset_email(to_email, full_name, link, minutes=30):
    name = full_name or "Anggota"
    msg = EmailMessage()
    msg["Subject"] = f"Atur ulang password {config.MAIL_FROM_NAME}"
    msg["From"] = formataddr((config.MAIL_FROM_NAME, config.SMTP_USER or "noreply@localhost"))
    msg["To"] = to_email

    msg.set_content(
        f"Halo {name},\n\n"
        f"Kami menerima permintaan untuk mengatur ulang password akun Anda.\n" #{config.MAIL_FROM_NAME}
        f"Buka tautan berikut untuk membuat password baru (berlaku {minutes} menit, sekali pakai):\n\n"
        f"{link}\n\n"
        "Jika Anda tidak merasa memintanya, abaikan email ini. Password Anda tidak berubah.\n"
    )
    msg.add_alternative(
        f"<p>Halo {html.escape(name)},</p>"
        f"<p>Kami menerima permintaan untuk mengatur ulang password akun "
        f"{html.escape(config.MAIL_FROM_NAME)} Anda.</p>"
        f'<p><a href="{html.escape(link)}">Buat password baru</a><br>'
        f"<small>Tautan berlaku {minutes} menit dan hanya bisa dipakai sekali.</small></p>"
        "<p>Jika Anda tidak merasa memintanya, abaikan email ini. Password Anda tidak berubah.</p>",
        subtype="html",
    )
    _send(msg)