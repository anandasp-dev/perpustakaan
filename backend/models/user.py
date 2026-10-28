import mysql.connector

from database.db import cursor


class DuplicateUserError(Exception):
    """Username atau email sudah terdaftar."""


class User:
    @staticmethod
    def create(username, email, password_hash, role="member"):
        try:
            with cursor() as cur:
                cur.execute(
                    "INSERT INTO `user` (username, email, password_hash, role) "
                    "VALUES (%s, %s, %s, %s)",
                    (username, email, password_hash, role),
                )
                return cur.lastrowid
        except mysql.connector.Error as e:
            if e.errno == 1062:
                raise DuplicateUserError("Username atau email sudah terdaftar") from e
            raise

    @staticmethod
    def find_by_id(user_id):
        with cursor() as cur:
            cur.execute(
                "SELECT id, username, email, role, created_at "
                "FROM `user` WHERE id = %s",
                (user_id,),
            )
            return cur.fetchone()

    @staticmethod
    def find_by_identifier(identifier):
        with cursor() as cur:
            cur.execute(
                "SELECT id, username, email, password_hash, role, created_at "
                "FROM `user` WHERE email = %s OR username = %s",
                (identifier, identifier),
            )
            return cur.fetchone()