// Condition rules of each W.4 row in the rule grammar (field, operator, value) [DOC:p.216 §7.7] (asserted).
// The register's own words (W4Row.conditions) are kept verbatim for the catalog; these rows are the same
// conditions split into the grammar so the definition editor can version them one rule at a time.

import type { Rule, RuleOp } from "./catalog"

const r = (field: string, op: RuleOp, value: string, then: string): Rule => ({ field, op, value, then })

export const RULES: Record<string, Rule[]> = {
  "WF-01": [
    r("amount", "<=", "25,000", "approver Buyer"),
    r("amount", "<=", "250,000", "approver Purchasing Manager"),
    r("amount", ">", "250,000", "+ Controller"),
    r("amount", ">", "1,000,000", "+ CFO"),
  ],
  "WF-02": [
    r("cost center", "is set", "", "approver = Cost Center Manager (derived)"),
    r("budget check", "=", "failed", "+ Controller"),
  ],
  "WF-03": [
    r("exposure + order value", ">", "credit limit", "route to Finance (credit)"),
    r("manual hold flag", "is true", "", "route to Finance (credit)"),
  ],
  "WF-04": [
    r("margin", "<", "price floor (PC-100 22%, PC-300 18%)", "Pricing Manager, then Sales Director"),
    r("points below floor", ">", "5", "+ CFO"),
  ],
  "WF-05": [r("quoted margin", "<", "target margin", "estimator, then pricing approval")],
  "WF-06": [
    r("order status", "in", "Confirmed or later", "change order required"),
    r("value change", ">", "0", "re-run credit check"),
  ],
  "WF-07": [
    r("value", "<=", "10,000", "approver CS Manager"),
    r("class", "=", "RC3", "+ Quality Manager"),
    r("warranty", "is true", "", "+ Quality Manager"),
    r("value", ">", "50,000", "+ Controller"),
    r("goodwill", "is true", "", "+ Controller"),
  ],
  "WF-08": [r("goodwill (out of warranty)", "is true", "", "+ Controller")],
  "WF-09": [
    r("class", "=", "Emergency", "SLA 24 h"),
    r("cost delta", ">", "10,000", "+ Controller"),
  ],
  "WF-10": [r("open ECO tasks", "=", "0", "release with atomic effectivity")],
  "WF-11": [
    r("document type", "=", "inspection plan", "approver Quality Manager"),
    r("approver", "≠", "author", "required"),
  ],
  "WF-12": [r("material type", "in", "type to department-view table", "required department views")],
  "WF-13": [
    r("field class", "=", "2", "approval required"),
    r("change kind", "=", "mass change", "simulation first"),
  ],
  "WF-14": [r("run-out policy", "is set", "", "approval required")],
  "WF-15": [r("effective date", "=", "period boundary", "required")],
  "WF-16": [r("completeness check", "=", "passed", "release allowed")],
  "WF-17": [
    r("line variance", "<=", "2,000", "supervisor approves alone"),
    r("document variance", "<=", "10,000", "supervisor approves alone"),
    r("above the supervisor band", "is true", "", "+ Finance Manager"),
    r("ABC class of a varying item", "=", "A", "+ Finance Manager"),
    r("document net variance", ">", "25,000", "+ Controller"),
  ],
  "WF-18": [
    r("run state", "=", "marked", "release allowed"),
    r("releaser", "≠", "marker", "required (two distinct users)"),
  ],
  "WF-19": [r("safety stock delta", ">", "25%", "Planning Manager approval")],
  "WF-20": [
    r("period status", "=", "Hard Close", "Controller, then CFO"),
    r("CFO", "≠", "Controller", "required (two distinct users, C-43)"),
  ],
  "WF-21": [r("compliance documents", "is true", "", "review, then Active")],
  "WF-22": [
    r("vendor response due date", "<", "today", "escalate"),
    r("overdue SCARs of the vendor", ">=", "2", "AVL Restricted"),
  ],
  "WF-23": [r("external notification text", "is set", "", "Quality Manager + executive")],
  "WF-24": [r("promise date at risk", "is true", "", "recovery decision, then customer notification")],
  "WF-25": [r("stock pegged to a sales order", "is true", "", "Sales Director approval with reason")],
  "WF-26": [r("toxic role pair requested", "is true", "", "CFO approval with expiry")],
  "WF-27": [
    r("cadence", "=", "quarterly", "attestation per department manager"),
    r("attestation", "=", "failed", "auto-revoke"),
  ],
  "WF-A1": [
    r("origin", "=", "Supplier deviation request", "route to Engineering + Quality"),
    r("validity (expiry or quantity)", "is set", "", "required"),
    r("type", "=", "Waiver on customer serials", "customer evidence attached"),
  ],
}

/** Field names offered by the rule builder (the grammar reads any document field; these are the ones the register uses). */
export const RULE_FIELDS = [...new Set(Object.values(RULES).flat().map((x) => x.field))].sort()
