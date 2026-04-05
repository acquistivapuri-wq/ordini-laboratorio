import type { SessionUser } from "./auth";

export function canManageProducts(user: SessionUser) {
  return user.role === "admin" || user.role === "ufficio";
}

export function canManageUsers(user: SessionUser) {
  return user.role === "admin";
}
