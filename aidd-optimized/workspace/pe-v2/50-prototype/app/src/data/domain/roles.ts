// Roles named in the specification, grouped by department. Sources: reference tables A "Users"
// column, F approval limits and G roles per flow [DOC:pp.10-12; pp.176-212; pp.245-276] (asserted).
// The specification has no role-by-action matrix (ASM-PERM-1), so these are names only; which role
// may press which button is decided per screen and recorded in that module's README.
// The FL-09 build uses nine of these names (Sales rep ... Shipping Manager); keep their exact spelling.

export const ROLE_GROUPS = {
  Sales: ["Sales rep", "Sales admin", "Customer service", "Customer Service Manager", "Estimator", "Pricing Manager", "Sales Director"],
  Finance: ["Finance (credit)", "Controller", "CFO", "Cost accountant", "Controlling analyst", "AP clerk"],
  Shipping: ["Shipping office", "Packer", "Shipping Manager", "Receiving clerk", "Warehouse operator", "Warehouse supervisor"],
  Materials: ["Material steward", "Materials Manager"],
  Engineering: ["Engineer", "Engineering Manager", "Manufacturing engineer", "Document control", "Engineering IT"],
  Planning: ["Planner", "Planning Manager", "Production Scheduler"],
  Production: ["Production supervisor", "Operator"],
  Quality: ["Inspector", "Test technician", "Quality engineer", "Quality Manager", "Quality IT"],
  Purchasing: ["Buyer", "Purchasing Manager"],
  Administration: ["Process owner", "Plant IT", "Executive"],
} as const

export type RoleGroup = keyof typeof ROLE_GROUPS
export type Role = (typeof ROLE_GROUPS)[RoleGroup][number]
export const ALL_ROLES: Role[] = Object.values(ROLE_GROUPS).flat() as Role[]
export const roleGroupOf = (r: Role): RoleGroup =>
  (Object.keys(ROLE_GROUPS) as RoleGroup[]).find((g) => (ROLE_GROUPS[g] as readonly string[]).includes(r))!
