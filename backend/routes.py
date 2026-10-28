from controllers import auth_controller
from core.router import Router

router = Router()

# Auth
router.add("POST", "/api/auth/register", auth_controller.register)
router.add("POST", "/api/auth/login", auth_controller.login)
router.add("POST", "/api/auth/logout", auth_controller.logout, login=True)
router.add("GET", "/api/auth/me", auth_controller.me, login=True)