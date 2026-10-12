// Users: one or more fictitious people per PRD role (GUARDRAILS 7: never real personal data).
// The "Acting as" switcher selects a role; `defaultUserFor(role)` gives the person shown for it.

import { ALL_ROLES, type Role, type User } from "@/data/domain"

const u = (n: number, name: string, roles: Role[], extra: Partial<User> = {}): User => ({
  id: `USR-TBD-${String(n).padStart(3, "0")}`, name, roles, badge: `BDG-${7000 + n}`, ...extra,
})

export const USERS: User[] = [
  u(1, "Dana Whitfield", ["Sales rep"]),
  u(2, "Marco Reyes", ["Sales admin"]),
  u(3, "Priya Natarajan", ["Customer service"]),
  u(4, "Hélène Gagnon", ["Customer Service Manager"]),
  u(5, "Tom Okafor", ["Estimator"]),
  u(6, "Lena Fischer", ["Pricing Manager"]),
  u(7, "Graham Stout", ["Sales Director"]),
  u(8, "Aisha Rahman", ["Finance (credit)"]),
  u(9, "Victor Lindqvist", ["Controller"]),
  u(10, "Margaret Osei", ["CFO"]),
  u(11, "Ben Kowalczyk", ["Cost accountant"]),
  u(12, "Sofia Marchetti", ["Controlling analyst"]),
  u(13, "Ray Dumont", ["AP clerk"]),
  u(14, "Kim Yoder", ["Shipping office"]),
  u(15, "Luis Ortega", ["Packer"]),
  u(16, "Janet Brandt", ["Shipping Manager"]),
  u(17, "Owen Pelletier", ["Receiving clerk"]),
  u(18, "Ngozi Eze", ["Warehouse operator"]),
  u(19, "Carl Halvorsen", ["Warehouse supervisor"]),
  u(20, "Mei Lin", ["Material steward"]),
  u(21, "Patrick Doyle", ["Materials Manager"]),
  u(22, "Ravi Shankar", ["Engineer"]),
  u(23, "Elena Petrova", ["Engineer"]),
  u(24, "Hiro Tanaka", ["Engineering Manager"]),
  u(25, "Grace Mwangi", ["Manufacturing engineer"]),
  u(26, "Paul Leblanc", ["Document control"]),
  u(27, "Ivan Novak", ["Engineering IT"]),
  u(28, "Sarah Bjornson", ["Planner"]),
  u(29, "Derek Achterberg", ["Planning Manager"]),
  u(30, "Fatima Haddad", ["Production Scheduler"]),
  u(31, "Joe Running Bear", ["Production supervisor"], { workCenterIds: ["WC-300", "WC-310", "WC-320", "WC-400"] }),
  u(32, "Anna Kowal", ["Operator"], { workCenterIds: ["WC-400"] }),
  u(33, "Miguel Santos", ["Operator"], { workCenterIds: ["WC-210", "WC-220"] }),
  u(34, "Chloe Martin", ["Inspector"]),
  u(35, "Samuel Adeyemi", ["Test technician"], { workCenterIds: ["WC-500"] }),
  u(36, "Laura Engstrom", ["Quality engineer"]),
  u(37, "Nathan Brooks", ["Quality Manager"]),
  u(38, "Yuki Sato", ["Quality IT"]),
  u(39, "Olivia Grant", ["Buyer"]),
  u(40, "Ahmed Karimi", ["Buyer"]),
  u(41, "Rebecca Thorne", ["Purchasing Manager"]),
  u(42, "Diego Alvarez", ["Process owner"]),
  u(43, "Kevin Walsh", ["Plant IT"]),
  u(44, "Catherine Moreau", ["Executive"]),
]

export const userById = (id: string) => USERS.find((x) => x.id === id)
export const defaultUserFor = (role: Role): User => USERS.find((x) => x.roles.includes(role)) ?? USERS[0]

// Every PRD role has at least one user (checked at module load in development).
if (import.meta.env.DEV) {
  const missing = ALL_ROLES.filter((r) => !USERS.some((x) => x.roles.includes(r)))
  if (missing.length) console.warn("Roles without a seeded user:", missing)
}
