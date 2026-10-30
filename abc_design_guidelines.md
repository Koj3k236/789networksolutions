{
  "original_problem_statement": "I choose Option A — Finish SIP Trunk Management first.\nSIP Trunking is the core service of 789 NETWORK SOLUTIONS, so it must be prioritized.\nPlease complete the SIP Trunk Management module with:\nFull SIP trunk CRUD functionality\nPersistent PostgreSQL storage using Prisma\nSIP username/password authentication configuration\nIP-based authentication\nSecure SIP credential generation and storage\nAuthorized IP address management\nCaller ID permission integration\nPer-customer concurrent call limits\nCalls-per-second (CPS) configuration\nSIP trunk enable/disable controls\nCustomer and administrator management interfaces\nTenant isolation and role-based permissions\nComplete audit logging\nAPI validation and error handling\nUnit and database integration tests\nAll SIP trunk configurations must persist after logout, login, and page refresh.\nDo not enable actual SIP traffic until the SIP infrastructure and approved upstream carrier are connected.\nAfter completing Option A, please continue with:\nPhase B — API Key Management\nImplement secure customer API keys, scoped permissions, key rotation, revocation, and API usage logs.\nPhase C — Support Ticketing\nImplement customer support tickets, administrator replies, ticket statuses, priorities, and notifications.\nDo not stop after completing only the SIP Trunk Management module.\nPreserve all existing working features.\nThe final source code must remain compatible with deployment to my VPS:\nDomain: 789networksolutions.com\nVPS: 201.79.46.149\nStack: Next.js, NestJS, PostgreSQL, Prisma, Redis, BullMQ\nPlease also prepare Docker Compose, environment configuration examples, Prisma migrations, and deployment documentation for an external VPS administrator.\nDo not claim production readiness until real database integration tests have passed.\nProceed with Option A first, followed by B and C.",
  "brand_and_constraints": {
    "app_type": "enterprise telecom SaaS dashboard (incremental modules)",
    "audience": [
      "business voice operators",
      "telecom resellers",
      "operations/support administrators"
    ],
    "must_preserve": [
      "existing professional navy/electric-blue brand",
      "existing light/dark responsive dashboards",
      "existing Caller ID permissions integration",
      "existing AppShell managementMode + PageHeading patterns",
      "existing tokens and shadcn/ui usage"
    ],
    "tech_stack_note": "Guidelines below are for the current frontend codebase using .js (not .tsx).",
    "truthful_preview_rule": "No PostgreSQL credentials supplied; in managed preview, show DB-unavailable states and disable submissions with clear explanation. Do not simulate success or fake persisted records for SIP trunks/API keys/support tickets.",
    "no_real_sip_rule": "Do not enable actual SIP traffic; UI must clearly separate configuration state vs operational status.",
    "testing_rule": "All interactive and key informational elements MUST include data-testid (kebab-case, role-based naming)."
  },
  "visual_personality": {
    "attributes": [
      "trustworthy",
      "operator-grade",
      "precise",
      "audit-friendly",
      "calm under pressure"
    ],
    "layout_principles": [
      "table-first information architecture",
      "progressive disclosure via drawers/dialogs/tabs",
      "dense but breathable spacing (2–3x typical padding)",
      "status-first hierarchy (verdict at top, details below)",
      "role-aware surfaces (customer vs admin)"
    ]
  },
  "typography": {
    "font_pairing": {
      "ui": "Figtree (existing)",
      "mono": "Source Code Pro (existing)"
    },
    "usage_rules": [
      "Use Figtree for headings, labels, helper text, and long-form UI copy.",
      "Use Source Code Pro for: SIP usernames, generated secrets (masked), IP/CIDR, CPS/concurrency numeric fields, audit log payload snippets, API key prefixes.",
      "Avoid all-caps for long labels; reserve for tiny badges only."
    ],
    "tailwind_scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl",
      "h2": "text-base md:text-lg",
      "body": "text-sm md:text-base",
      "small": "text-xs text-muted-foreground"
    }
  },
  "color_system_and_tokens": {
    "directive": "Do not change global colors/styles. Add only additive tokens if needed; keep navy/electric-blue identity and existing light/dark variables.",
    "semantic_tokens_to_add_if_missing": {
      "--info": "(use existing blue accent family)",
      "--success": "(use existing green family if present)",
      "--warning": "(use existing amber/yellow family if present)",
      "--danger": "(use existing destructive)",
      "--surface-1": "card",
      "--surface-2": "secondary",
      "--border-subtle": "border",
      "--focus-ring": "ring"
    },
    "status_color_usage": [
      "Operational status chips must be color + icon + text (never color-only).",
      "Electric blue is for primary actions, links, focus rings, selected states—not large fills.",
      "Use solid colors for reading areas; no gradients on tables/logs."
    ]
  },
  "grid_and_spacing": {
    "page_container": {
      "pattern": "AppShell main content uses a left-aligned container; do not center the entire app.",
      "recommended_classes": "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8"
    },
    "section_spacing": {
      "stack": "space-y-6 md:space-y-8",
      "card_padding": "p-4 sm:p-5",
      "form_grid": "grid grid-cols-1 gap-4 md:grid-cols-2"
    },
    "table_density": {
      "default": "compact",
      "row_height": "h-11",
      "cell_padding": "py-2 px-3",
      "mono_cells": "font-mono text-[12.5px]"
    }
  },
  "component_path": {
    "shadcn_ui_primary": {
      "button": "/app/frontend/src/components/ui/button.jsx",
      "card": "/app/frontend/src/components/ui/card.jsx",
      "table": "/app/frontend/src/components/ui/table.jsx",
      "tabs": "/app/frontend/src/components/ui/tabs.jsx",
      "dialog": "/app/frontend/src/components/ui/dialog.jsx",
      "drawer": "/app/frontend/src/components/ui/drawer.jsx",
      "sheet": "/app/frontend/src/components/ui/sheet.jsx",
      "select": "/app/frontend/src/components/ui/select.jsx",
      "input": "/app/frontend/src/components/ui/input.jsx",
      "textarea": "/app/frontend/src/components/ui/textarea.jsx",
      "switch": "/app/frontend/src/components/ui/switch.jsx",
      "badge": "/app/frontend/src/components/ui/badge.jsx",
      "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
      "popover": "/app/frontend/src/components/ui/popover.jsx",
      "dropdown_menu": "/app/frontend/src/components/ui/dropdown-menu.jsx",
      "alert": "/app/frontend/src/components/ui/alert.jsx",
      "alert_dialog": "/app/frontend/src/components/ui/alert-dialog.jsx",
      "sonner_toasts": "/app/frontend/src/components/ui/sonner.jsx",
      "scroll_area": "/app/frontend/src/components/ui/scroll-area.jsx",
      "separator": "/app/frontend/src/components/ui/separator.jsx",
      "skeleton": "/app/frontend/src/components/ui/skeleton.jsx",
      "calendar": "/app/frontend/src/components/ui/calendar.jsx"
    },
    "icon_library": {
      "preferred": "lucide-react (already installed per guidelines)",
      "rule": "No emoji icons."
    }
  },
  "page_level_layout_specs": {
    "dashboard_trunks_customer": {
      "route": "/dashboard/trunks",
      "primary_goal": "Operators manage SIP trunk configurations (CRUD) and understand config vs operational status.",
      "layout": [
        "PageHeading: title + short subtitle + right-side primary CTA (New trunk) + secondary CTA (Import/Export optional).",
        "Top status strip (Card): 3–4 compact KPIs: Active trunks, Disabled trunks, CPS total, Concurrent call limit total (computed).",
        "Main: Trunks table (Card) with filters row above table.",
        "Row click opens right Drawer/Sheet: Trunk Detail with Tabs: Overview | Authentication | Limits | Caller ID | Audit."
      ],
      "table_columns": [
        "Name",
        "Status (Enabled/Disabled)",
        "Auth mode (Credentials/IP)",
        "Allowed IPs count",
        "Caller ID policy summary",
        "Limits (CPS / Concurrent)",
        "Updated",
        "Actions (kebab menu)"
      ],
      "filters": [
        "Search (name)",
        "Status select",
        "Auth mode select",
        "Updated date range (use Calendar + Popover)"
      ],
      "empty_state": {
        "title": "No SIP trunks yet",
        "body": "Create your first trunk configuration. Operational traffic remains disabled until upstream carrier is connected.",
        "cta": "New trunk",
        "secondary": "Learn about auth modes (opens Dialog)"
      }
    },
    "admin_trunks": {
      "route": "/admin/trunks",
      "layout": [
        "Org/Tenant picker at top-left of content header (must be obvious).",
        "Admin table includes Customer column + role badges.",
        "Bulk actions bar when rows selected: Enable/Disable, Set limits, Export audit.",
        "Detail drawer includes Admin-only tab: Permissions & Tenant Isolation (read-only summary + links)."
      ]
    },
    "dashboard_api_keys": {
      "route": "/dashboard/api-keys",
      "layout": [
        "PageHeading with primary CTA: Create API key.",
        "API keys table with scopes, created, last used, status.",
        "Create flow uses Dialog with stepper-like sections: Name → Scopes → Confirm.",
        "One-time reveal modal for the full key value (copy + acknowledgement checkbox).",
        "Usage logs tab: filterable table (endpoint, status, timestamp, IP)."
      ],
      "empty_state": {
        "title": "No API keys",
        "body": "Create a scoped key for automation. You will only see the full key once.",
        "cta": "Create API key"
      }
    },
    "support_customer": {
      "route": "/dashboard/support",
      "layout": [
        "Two-pane on desktop: left ticket list (ScrollArea), right thread view; on mobile: Tabs (Tickets | Thread).",
        "Ticket list rows show: subject, status badge, priority badge, last update, unread dot.",
        "Thread view: messages grouped by day; customer vs admin styling; internal notes (admin only) visually distinct.",
        "Composer at bottom with attachments placeholder (disabled if DB unavailable)."
      ]
    },
    "support_admin": {
      "route": "/admin/support",
      "layout": [
        "Queue filters: Status, Priority, Assigned to me.",
        "Bulk actions: Set status, Set priority, Assign.",
        "Thread includes admin reply + internal note toggle."
      ]
    },
    "notifications": {
      "route": "/dashboard/notifications",
      "layout": [
        "Grouped list by Today / This week / Older.",
        "Each item: severity icon, title, short body, timestamp, deep link.",
        "Actions: Mark read/unread, Mark all read."
      ]
    }
  },
  "critical_flows_and_ui_behaviors": {
    "db_unavailable_truthful_states": {
      "rule": "If backend persistence is not connected in preview, disable submit buttons and show an inline Alert explaining why.",
      "pattern": {
        "component": "Alert",
        "placement": "top of form card",
        "copy": "Database connection is not configured in this environment. You can review the form layout, but saving is disabled.",
        "cta": "View setup docs (opens Dialog with env vars)"
      },
      "button_state": "Button disabled + Tooltip explaining disabled reason"
    },
    "sip_trunk_create_edit": {
      "form_structure": [
        "Card: Basic info (Name, Description)",
        "Card: Authentication (Tabs: Credentials | IP-based)",
        "Card: Limits (Concurrent calls, CPS) with helper text and validation",
        "Card: Caller ID permissions (Select/multi-select integrated with existing CallerID permissions module)",
        "Card: Enable/Disable (Switch) + Operational status (read-only)"
      ],
      "validation": [
        "Name required; unique within tenant.",
        "CPS and concurrent calls must be integers >= 0; show inline errors.",
        "IP allowlist entries must validate IPv4/IPv6 and CIDR; show per-row error.",
        "Auth mode selection must clearly explain mutual exclusivity (credentials vs IP-based)."
      ]
    },
    "sip_credentials_generation_and_reveal": {
      "security_rules": [
        "Generate credentials server-side only when DB is available; never generate fake secrets in preview.",
        "Show password only once in a Dialog; after closing, show masked value with 'Regenerate' action.",
        "Copy buttons for username/password; on copy, toast confirmation.",
        "Audit log must record: actor, trunk, action (CREDENTIAL_REVEAL / REGENERATE), source IP, timestamp."
      ],
      "dialog_layout": [
        "Title: One-time SIP credentials",
        "Warning Alert: You will only see the password once.",
        "Two rows: Username (mono + copy) / Password (mono + copy + reveal toggle)",
        "Footer: 'I understand' checkbox + Close"
      ]
    },
    "ip_allowlist_management": {
      "ui_pattern": [
        "Inline editable list inside a Card with Add IP/CIDR button.",
        "Each row: Input + Label (optional) + Remove icon button.",
        "Show summary line: 'X entries • Last updated by Y'."
      ],
      "microcopy": [
        "Explain scope: 'Only requests from these IPs can authenticate this trunk when IP-based auth is enabled.'",
        "If list empty and IP-auth enabled: show Warning badge + inline Alert."
      ]
    },
    "caller_id_permission_integration": {
      "rule": "Do not break existing Caller ID permissions. Use existing selector patterns and show a read-only summary in the trunk list.",
      "ui": [
        "Use Select or Command (searchable) for large lists.",
        "Show selected Caller IDs as Badges with overflow '+N more'."
      ]
    },
    "api_key_one_time_reveal": {
      "rules": [
        "Only show full API key once; store only hashed value server-side.",
        "After reveal, table shows prefix + last 4 only.",
        "Rotation creates a new key and revokes old (confirm via AlertDialog)."
      ],
      "dialog": [
        "Dialog with mono key field + Copy button.",
        "Checkbox acknowledgement required before enabling Close.",
        "Toast on copy using Sonner."
      ]
    },
    "support_ticket_thread": {
      "thread_ui": [
        "Messages as Cards with subtle border; customer messages align left; admin align right (but keep readable, not chat-bubble gimmick).",
        "Internal notes use muted background + 'Internal' Badge.",
        "Composer uses Textarea + Send button; disable with DB-unavailable Alert."
      ]
    }
  },
  "data_table_patterns": {
    "toolbar": {
      "left": [
        "Search input",
        "Filter dropdowns",
        "Saved views (optional)"
      ],
      "right": [
        "Column visibility dropdown",
        "Export",
        "Density toggle (optional)"
      ]
    },
    "row_actions": [
      "Use DropdownMenu for row actions: Edit, Duplicate, Disable/Enable, View audit.",
      "Destructive actions require AlertDialog confirmation."
    ],
    "selection": "When rows selected, show sticky bulk action bar at bottom of table card.",
    "loading": "Use Skeleton rows (same height as table rows) to prevent layout shift.",
    "error": "Inline Alert above table with retry button (data-testid='trunks-table-retry-button')."
  },
  "motion_and_microinteractions": {
    "principles": [
      "No universal transition: never use transition-all.",
      "Use short, purposeful transitions: colors/opacity/shadow only.",
      "Prefer Drawer/Sheet slide-in for record detail; Dialog for secrets/confirmations."
    ],
    "tailwind_motion_tokens": {
      "interactive": "transition-colors duration-150",
      "elevation": "transition-shadow duration-150",
      "drawer": "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "press": "active:scale-[0.99]"
    },
    "hover_states": [
      "Table row hover: bg-muted/40 (light) or bg-muted/20 (dark).",
      "Primary button hover: slightly brighter electric-blue border or subtle shadow, not gradient."
    ],
    "toasts": {
      "library": "sonner",
      "use_cases": [
        "Copied to clipboard",
        "Key rotated",
        "Trunk disabled/enabled",
        "Ticket reply sent"
      ]
    }
  },
  "accessibility_and_a11y": {
    "requirements": [
      "WCAG AA contrast for text on surfaces.",
      "Visible focus ring on all interactive elements (use ring token).",
      "Do not rely on color alone for status; include icon + label.",
      "Dialogs/Drawers must trap focus (shadcn handles) and have descriptive titles.",
      "Provide aria-label for icon-only buttons (copy, remove IP, kebab menu)."
    ]
  },
  "data_testid_conventions": {
    "naming": "kebab-case; describe role not appearance",
    "examples": [
      "data-testid='trunks-new-button'",
      "data-testid='trunks-table'",
      "data-testid='trunk-row-actions-menu-button'",
      "data-testid='trunk-detail-drawer'",
      "data-testid='sip-credentials-reveal-dialog'",
      "data-testid='sip-credentials-copy-password-button'",
      "data-testid='ip-allowlist-add-button'",
      "data-testid='api-keys-create-button'",
      "data-testid='api-key-reveal-dialog'",
      "data-testid='support-ticket-compose-textarea'",
      "data-testid='notifications-mark-all-read-button'"
    ]
  },
  "libraries_and_installation": {
    "recommended": [
      {
        "name": "framer-motion",
        "why": "Optional: subtle entrance animations for drawers/empty states without heavy custom CSS.",
        "install": "npm i framer-motion",
        "usage_note": "Use sparingly; avoid animating large tables."
      }
    ],
    "not_required": [
      "No images needed.",
      "No 3D/three.js for this enterprise dashboard."
    ]
  },
  "image_urls": {
    "note": "No images required per constraints; rely on icons, typography, and spacing."
  },
  "instructions_to_main_agent": [
    "Preserve existing global theme and light/dark behavior; do not redesign the app shell.",
    "Implement SIP Trunk Management first (Option A), then API Keys (B), then Support Ticketing (C) without stopping.",
    "In preview environments without DB credentials, disable create/update actions and show truthful DB-unavailable Alerts; do not fake persisted data.",
    "Use shadcn/ui components from /app/frontend/src/components/ui only (no raw HTML dropdowns/calendars/toasts).",
    "Use Dialog for one-time secret reveal; clear secret values on close; log reveal/regenerate actions in audit log UI.",
    "Separate 'configuration enabled/disabled' from 'operational status' (read-only) everywhere.",
    "Every interactive element and key informational element must include data-testid attributes."
  ],
  "GENERAL_UI_UX_DESIGN_GUIDELINES": "    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals."
}
