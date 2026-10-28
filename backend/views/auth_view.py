def user_data(user):
    """Hanya field aman. password_hash tidak boleh ikut."""
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "created_at": str(user["created_at"]),
    }


def register_ok(user):
    return {"message": "Registrasi berhasil", "user": user_data(user)}


def login_ok(user):
    return {"message": "Login berhasil", "user": user_data(user)}


def me(user):
    return {"user": user_data(user)}


def logout_ok():
    return {"message": "Logout berhasil"}