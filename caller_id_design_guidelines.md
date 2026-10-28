{
  "scope": {
    "file": "/app/caller_id_design_guidelines.md",
    "intent": "Narrowly scoped design addendum for the Caller ID Permission Management module only. Preserve existing navy/electric-blue brand, Figtree/Source Code Pro typography, light/dark modes, and current layout shell. No site-wide token resets, no new imagery, no fabricated data states."
  },
  "brand_alignment": {
    "visual_personality": [
      "enterprise telecom",
      "compliance-forward",
      "fail-closed by default",
      "auditability-first",
      "dense but breathable"
    ],
    "do_not_change": [
      "existing navy/electric blue accents",
      "existing typography pairing (Figtree + Source Code Pro)",
      "existing light/dark theme behavior",
      "existing dashboard shell/navigation"
    ]
  },
  "information_architecture": {
    "customer_portal_page": {
      "route": "/dashboard/caller-ids",
      "primary_jobs": [
        "See current Caller ID permissions (read-only unless request flow)",
        "Request enablement of External Caller ID Passthrough",
        "Manage authorized caller IDs inventory (view + submit for review)",
        "Understand carrier gate + compliance disclaimers"
      ],
      "layout": {
        "pattern": "F-pattern, left-aligned, two-column on desktop; single-column on mobile",
        "grid": "container max-w-[1200px] px-4 sm:px-6 lg:px-8; main grid lg:grid lg:grid-cols-12 lg:gap-6",
        "regions": {
          "header": "lg:col-span-12: page title + short compliance subtitle + status badges",
          "left_main": "lg:col-span-8: inventory + request history",
          "right_rail": "lg:col-span-4: permission summary + carrier gate + help"
        }
      }
    },
    "admin_page": {
      "route": "/admin/caller-id-permissions?customer=UUID",
      "primary_jobs": [
        "Edit per-customer permission switches (SUPER_ADMIN, COMPLIANCE_ADMIN only)",
        "Review/approve/reject customer requests",
        "Review authorized number inventory + ownership evidence status",
        "See immutable audit log (who/what/when/notes)",
        "See explicit carrier gate status (read-only)"
      ],
      "layout": {
        "pattern": "Tabbed workspace with persistent right-side details sheet on row click",
        "grid": "max-w-[1400px] px-4 sm:px-6 lg:px-8",
        "tabs": [
          "Permissions",
          "Requests Queue",
          "Authorized Inventory",
          "Audit Log"
        ]
      }
    }
  },
  "component_inventory": {
    "shadcn_primary": {
      "paths_frontend": [
        "/app/frontend/src/components/ui/card.jsx",
        "/app/frontend/src/components/ui/tabs.jsx",
        "/app/frontend/src/components/ui/table.jsx",
        "/app/frontend/src/components/ui/badge.jsx",
        "/app/frontend/src/components/ui/button.jsx",
        "/app/frontend/src/components/ui/switch.jsx",
        "/app/frontend/src/components/ui/textarea.jsx",
        "/app/frontend/src/components/ui/input.jsx",
        "/app/frontend/src/components/ui/alert.jsx",
        "/app/frontend/src/components/ui/alert-dialog.jsx",
        "/app/frontend/src/components/ui/dialog.jsx",
        "/app/frontend/src/components/ui/sheet.jsx",
        "/app/frontend/src/components/ui/separator.jsx",
        "/app/frontend/src/components/ui/skeleton.jsx",
        "/app/frontend/src/components/ui/tooltip.jsx",
        "/app/frontend/src/components/ui/sonner.jsx"
      ],
      "notes": "Use existing shadcn primitives; do not introduce raw HTML dropdowns/calendars/toasts. Use Sonner for toasts."
    },
    "recommended_new_composites": [
      {
        "name": "PermissionSwitchRow",
        "purpose": "Consistent switch + description + default/fail-closed hint + role gating",
        "built_from": ["Card", "Switch", "Label", "Badge", "Tooltip"]
      },
      {
        "name": "RequestQueueTable",
        "purpose": "Admin review queue with inline approve/reject actions and notes",
        "built_from": ["Table", "Badge", "Button", "Dialog", "Textarea"]
      },
      {
        "name": "AuditLogTable",
        "purpose": "Append-only audit events with filters and row detail sheet",
        "built_from": ["Table", "Badge", "Sheet", "Separator"]
      },
      {
        "name": "CarrierGateCallout",
        "purpose": "Hard stop messaging: carrier policy overrides customer toggle",
        "built_from": ["Alert", "Badge", "Button (link)"]
      }
    ]
  },
  "design_tokens_additive": {
    "principle": "Do not replace global tokens. Add module-scoped CSS variables (or Tailwind class recipes) only for Caller ID screens.",
    "css_variables": {
      "callerid": {
        "--callerid-surface": "hsl(var(--card))",
        "--callerid-surface-2": "hsl(var(--secondary))",
        "--callerid-border": "hsl(var(--border))",
        "--callerid-accent": "hsl(var(--ring))",
        "--callerid-info": "#2b6cff",
        "--callerid-info-bg": "rgba(43,108,255,0.10)",
        "--callerid-warning": "#b45309",
        "--callerid-warning-bg": "rgba(180,83,9,0.12)",
        "--callerid-success": "#0f766e",
        "--callerid-success-bg": "rgba(15,118,110,0.12)",
        "--callerid-danger": "hsl(var(--destructive))",
        "--callerid-danger-bg": "rgba(220,38,38,0.10)"
      }
    },
    "shadows": {
      "panel": "shadow-[0_1px_0_rgba(15,23,42,0.06),0_12px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_0_rgba(255,255,255,0.06),0_12px_24px_rgba(0,0,0,0.35)]"
    },
    "radius": {
      "cards": "rounded-xl",
      "controls": "rounded-lg"
    }
  },
  "typography": {
    "preserve": {
      "heading": "Figtree",
      "mono": "Source Code Pro"
    },
    "scale": {
      "page_title": "text-2xl sm:text-3xl font-semibold tracking-[-0.02em]",
      "section_title": "text-base font-semibold",
      "supporting": "text-sm text-muted-foreground",
      "mono_meta": "font-mono text-xs text-muted-foreground"
    },
    "content_rules": [
      "Use plain-language compliance copy; avoid marketing tone.",
      "Use monospace for IDs (customer UUID, request ID, trunk ID) and SIP header examples.",
      "Never rely on color alone for status; always pair with label text."
    ]
  },
  "layout_recipes": {
    "page_header": {
      "structure": [
        "Left: Title + subtitle",
        "Right: compact status badges (Carrier: Unconfigured / Restricted; Effective: Blocked/Pending/Enabled)"
      ],
      "classes": "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
    },
    "dense_table": {
      "classes": "text-sm",
      "row_padding": "py-2.5",
      "cell": "align-middle",
      "sticky_header": "[&>thead]:sticky [&>thead]:top-0 [&>thead]:bg-background/90 [&>thead]:backdrop-blur"
    },
    "right_rail_card": {
      "classes": "rounded-xl border bg-card p-4 "
    }
  },
  "module_components_spec": {
    "permission_summary_card": {
      "where": "Customer portal right rail + Admin Permissions tab top",
      "content": [
        "External Caller ID Passthrough: Enabled/Disabled (effective)",
        "Allow Per-Call Caller ID Selection: Enabled/Disabled",
        "Require Additional Caller ID Review: Required/Not required",
        "Caller ID Permission Status: Pending/Approved/Rejected/Not requested",
        "Approval Notes (read-only for customers)",
        "Last Modified By + Last Modified Date (admin view)"
      ],
      "interaction": {
        "admin": "Switches editable only for SUPER_ADMIN and COMPLIANCE_ADMIN; others see read-only with lock badge",
        "customer": "If passthrough disabled, show Request Enablement CTA"
      },
      "data_testids": {
        "card": "caller-id-permission-summary-card",
        "passthrough": "caller-id-permission-passthrough-status",
        "per_call": "caller-id-permission-per-call-status",
        "additional_review": "caller-id-permission-additional-review-status",
        "status": "caller-id-permission-approval-status",
        "last_modified": "caller-id-permission-last-modified"
      }
    },
    "admin_permission_switches": {
      "where": "Admin → Permissions tab",
      "switch_rows": [
        {
          "key": "external_passthrough",
          "label": "External Caller ID Passthrough",
          "helper": "Allows outbound Caller ID to be set to an authorized external number. Carrier policy may still block.",
          "default": false
        },
        {
          "key": "per_call_selection",
          "label": "Allow Per-Call Caller ID Selection",
          "helper": "Allows per-call selection via SIP signaling where permitted. Requires passthrough enabled.",
          "default": false
        },
        {
          "key": "additional_review",
          "label": "Require Additional Caller ID Review",
          "helper": "When enabled, new external Caller IDs remain pending until reviewed. Fail-closed.",
          "default": true
        }
      ],
      "states": {
        "locked": "Show Badge 'Read-only' + Tooltip with required roles",
        "dependent": "If passthrough OFF, per-call switch disabled with helper text 'Enable passthrough first'",
        "saving": "Inline spinner + disable switches; show Sonner toast on success/failure"
      },
      "data_testids": {
        "passthrough_switch": "admin-caller-id-passthrough-switch",
        "per_call_switch": "admin-caller-id-per-call-switch",
        "additional_review_switch": "admin-caller-id-additional-review-switch",
        "save_button": "admin-caller-id-permissions-save-button"
      }
    },
    "customer_request_enablement": {
      "where": "Customer portal",
      "pattern": "Card with short explanation + request form (Textarea justification) + submit button",
      "copy_requirements": [
        "Explicitly state: approval is not number ownership verification and not carrier permission.",
        "State: outbound calling remains unavailable until carrier integration/compliance checks complete.",
        "State: unauthorized Caller IDs will be rejected."
      ],
      "fields": [
        "Justification (Textarea)",
        "Requested scope (read-only): applies to all SIP trunks"
      ],
      "data_testids": {
        "request_card": "caller-id-enable-request-card",
        "justification": "caller-id-enable-request-justification-textarea",
        "submit": "caller-id-enable-request-submit-button",
        "status": "caller-id-enable-request-status"
      }
    },
    "admin_requests_queue": {
      "where": "Admin → Requests Queue tab (also allow small 'Pending' badge in header)",
      "table_columns": [
        "Requested At",
        "Customer",
        "Requester",
        "Requested Change",
        "Justification",
        "Status",
        "Actions"
      ],
      "row_actions": {
        "approve": "Opens Dialog requiring Approval Notes (Textarea) + confirm",
        "reject": "Opens Dialog requiring Rejection Notes (Textarea) + confirm"
      },
      "badges": {
        "pending": "bg-[var(--callerid-info-bg)] text-[var(--callerid-info)] border-[color:rgba(43,108,255,0.25)]",
        "approved": "bg-[var(--callerid-success-bg)] text-[var(--callerid-success)] border-[color:rgba(15,118,110,0.25)]",
        "rejected": "bg-[var(--callerid-danger-bg)] text-[hsl(var(--destructive))] border-[color:rgba(220,38,38,0.25)]"
      },
      "data_testids": {
        "table": "admin-caller-id-requests-queue-table",
        "approve": "admin-caller-id-request-approve-button",
        "reject": "admin-caller-id-request-reject-button",
        "notes": "admin-caller-id-request-decision-notes-textarea",
        "confirm": "admin-caller-id-request-decision-confirm-button"
      }
    },
    "authorized_number_inventory": {
      "where": "Customer portal main + Admin Authorized Inventory tab",
      "table_columns": [
        "Caller ID",
        "Type (Assigned / External)",
        "Authorization Status (Pending Review / Authorized / Revoked)",
        "Evidence (On file / Missing)",
        "Applies To (All trunks)",
        "Last Updated"
      ],
      "empty_states": {
        "no_numbers": "Show Skeleton then empty card: 'No authorized caller IDs yet' + CTA to add external caller ID for review",
        "db_unavailable": "Show Alert with 'Database unavailable' and disable actions; do not fabricate records"
      },
      "actions": {
        "customer_add_external": "Dialog with Input for number + Textarea for authorization description; submit creates pending review item",
        "admin_revoke": "AlertDialog confirm + requires notes"
      },
      "data_testids": {
        "table": "caller-id-authorized-inventory-table",
        "add_button": "caller-id-inventory-add-external-button",
        "add_number_input": "caller-id-inventory-add-number-input",
        "add_notes": "caller-id-inventory-add-notes-textarea",
        "revoke_button": "admin-caller-id-inventory-revoke-button"
      }
    },
    "audit_log": {
      "where": "Admin → Audit Log tab",
      "table_columns": [
        "Time",
        "Actor",
        "Action",
        "Target",
        "Result",
        "Notes"
      ],
      "row_detail": "Sheet: show before/after JSON (monospace), request correlation IDs, customer UUID, trunk scope",
      "filters": [
        "Actor",
        "Action",
        "Date range (optional; if no calendar component available in platform, use Input type=date)"
      ],
      "data_testids": {
        "table": "admin-caller-id-audit-log-table",
        "row": "admin-caller-id-audit-log-row",
        "detail_sheet": "admin-caller-id-audit-log-detail-sheet"
      }
    },
    "carrier_gate_callout": {
      "where": "Both customer + admin pages (top of page, below header)",
      "severity": "warning",
      "copy": "Carrier integration is not configured. Outbound calling remains unavailable. Customer permissions do not override upstream carrier policy.",
      "visual": "Alert with left border accent; include Badge 'Carrier: Unconfigured'",
      "data_testids": {
        "alert": "caller-id-carrier-gate-alert"
      }
    }
  },
  "motion_microinteractions": {
    "rules": [
      "No transition:all. Use targeted transitions only.",
      "Prefer subtle elevation + border emphasis on hover for cards and rows.",
      "Respect prefers-reduced-motion."
    ],
    "table_row_hover": "hover:bg-muted/40 transition-colors",
    "primary_button": "transition-colors active:translate-y-[1px] (no transform transition applied globally)",
    "switch": "Use default shadcn switch; add Tooltip on disabled state explaining dependency/role lock"
  },
  "states_and_error_handling": {
    "db_unavailable": {
      "principle": "Show genuine database-unavailable state; do not create sample records.",
      "ui": [
        "Alert (destructive or warning depending on context)",
        "Disable submit/approve/revoke buttons",
        "Keep layout visible with Skeleton placeholders"
      ],
      "copy": "Database connection is not configured. This module requires PostgreSQL DATABASE_URL and TEST_DATABASE_URL to load and persist records."
    },
    "fail_closed_defaults": {
      "defaults": {
        "external_passthrough": false,
        "per_call_selection": false,
        "additional_review": true
      },
      "ui": "Show Badge 'Default: Disabled' next to toggles when in default state; include helper text 'Fail-closed by default'."
    }
  },
  "accessibility": {
    "requirements": [
      "All switches and buttons must have visible focus ring (use existing ring token).",
      "Status must be conveyed via text + badge, not color alone.",
      "Tables must be horizontally scrollable on mobile (wrap in ScrollArea or overflow-x-auto).",
      "Dialogs must trap focus (shadcn Dialog/AlertDialog already handles)."
    ]
  },
  "implementation_notes_for_main_agent": {
    "js_only": "Project uses .js components (not .tsx). Keep new UI components in .jsx/.js and follow existing shadcn patterns.",
    "data_testid": "Add data-testid to every interactive element and key informational status field listed above.",
    "role_gating": [
      "Editable: SUPER_ADMIN, COMPLIANCE_ADMIN",
      "Read-only: all other admin roles",
      "Customer portal: request submission allowed; direct toggles not allowed"
    ],
    "copy_guardrails": [
      "Never imply carrier approval exists.",
      "Never imply number ownership is verified unless evidence is explicitly present.",
      "Approval of permission is distinct from ownership verification and carrier permission."
    ]
  },
  "General UI UX Design Guidelines": "\n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n"
}
