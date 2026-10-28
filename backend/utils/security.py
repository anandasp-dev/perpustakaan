"""Hash dan verifikasi password memakai PBKDF2-HMAC-SHA256 (library bawaan Python)."""
import hashlib
import hmac
import secrets

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 600_000
SALT_BYTES = 16


def _derive(password, salt, iterations):
    dk = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations
    )
    return dk.hex()


def hash_password(password):
    """Hasilkan 'pbkdf2_sha256$iterasi$salt$hash' untuk disimpan di DB."""
    salt = secrets.token_hex(SALT_BYTES)
    return f"{ALGORITHM}${ITERATIONS}${salt}${_derive(password, salt, ITERATIONS)}"


def verify_password(password, stored_hash):
    """Cocokkan password dengan hash tersimpan. Format rusak -> False."""
    try:
        algorithm, iterations, salt, expected = stored_hash.split("$")
        iterations = int(iterations)
    except (ValueError, AttributeError):
        return False
    if algorithm != ALGORITHM:
        return False
    return hmac.compare_digest(_derive(password, salt, iterations), expected)


# Hash palsu untuk login dengan user yang tidak ada (waktu respons tetap sama)
_DUMMY_HASH = hash_password(secrets.token_hex(8))


def fake_verify(password):
    verify_password(password, _DUMMY_HASH)
    return False