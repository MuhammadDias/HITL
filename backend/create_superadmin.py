# backend/create_superadmin.py
"""Create (or reset the password of) a superadmin account.

Usage (from the project root):
    venv/bin/python backend/create_superadmin.py --email you@example.com --name "Nama"
The password is asked interactively unless --password is given.
"""
import argparse
import getpass
import sys
from pathlib import Path

# Import db/auth directly so this does not load TensorFlow via backend.app.main.
sys.path.insert(0, str(Path(__file__).resolve().parent / "app"))
from passwords import hash_password  # noqa: E402
from db import DB_PATH, connect, init_db  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--password")
    args = parser.parse_args()

    password = args.password or getpass.getpass("Password superadmin: ")
    if len(password) < 8:
        sys.exit("Password minimal 8 karakter.")

    init_db()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'superadmin')
            ON CONFLICT (email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash,
              role = 'superadmin', school_id = NULL
            """,
            (args.email.strip(), args.name.strip(), hash_password(password)),
        )
    print(f"Superadmin {args.email} siap. Database: {DB_PATH}")


if __name__ == "__main__":
    main()
