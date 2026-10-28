{
  "brand": {
    "name": "789 NETWORK SOLUTIONS",
    "positioning": [
      "B2B wholesale telecommunications + SIP/voice reseller platform",
      "Trust-first, compliance-aware, production-oriented",
      "Explicit DEMO MODE until upstream carrier connected (fail-closed for production calling)"
    ],
    "design_personality": {
      "keywords": [
        "enterprise",
        "precise",
        "dense-but-airy",
        "operational",
        "calm authority",
        "developer-friendly"
      ],
      "do": [
        "Use deep navy surfaces with crisp separators and electric-blue accents",
        "Prefer compact navigation + strong information hierarchy",
        "Use subtle motion and micro-interactions to make dense data feel navigable",
        "Label DEMO MODE clearly in UI chrome (banner + badges + tooltips)"
      ],
      "dont": [
        "Don’t mimic BulkVS branding/layout",
        "Don’t imply real carrier connectivity, pricing, availability, or live network status",
        "Don’t use heavy gradients or neon overload",
        "Don’t use centered, marketing-template layouts"
      ]
    }
  },

  "implementation_scope_notes": {
    "stack_target": {
      "web": "Next.js + TypeScript + Tailwind + shadcn/ui (new app in /app/platform/web)",
      "api": "NestJS + TypeScript + Prisma + PostgreSQL",
      "infra": "Redis + BullMQ; Docker Compose for local/VPS"
    },
    "preview_environment_constraint": {
      "rule": "If managed preview cannot run Docker/Postgres/Redis, the UI must render as a read-only sample workspace.",
      "required_ui_copy": [
        "Banner: ‘DEMO MODE — No upstream carrier connected. Data shown may be sample.’",
        "Disable production actions; show tooltips explaining why.",
        "Any ‘connect’, ‘provision’, ‘route’, ‘activate’ actions must be disabled and fail closed."
      ]
    },
    "js_files_note": {
      "rule": "Guidelines must be implementable in .js/.jsx files (not .tsx).",
      "pattern": "Use JSDoc for prop typing hints where helpful; avoid TS-only patterns in UI examples."
    }
  },

  "design_tokens": {
    "fonts": {
      "google_fonts_import": "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap",
      "font_pairing": {
        "display": "Space Grotesk",
        "body": "Manrope",
        "mono": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
      },
      "tailwind_usage": {
        "headings": "font-[var(--font-display)] tracking-[-0.02em]",
        "body": "font-[var(--font-body)]",
        "mono": "font-[var(--font-mono)]"
      },
      "type_scale": {
        "h1": "text-4xl sm:text-5xl lg:text-6xl",
        "h2": "text-base md:text-lg",
        "body": "text-sm md:text-base",
        "small": "text-xs"
      }
    },

    "color_system": {
      "intent": "Professional dark navy base + electric blue accents + neutral grays; supports light and dark mode.",
      "css_custom_properties": {
        "note": "These override the default shadcn tokens in index.css for the new Next app. Keep HSL format for shadcn compatibility.",
        "light": {
          "--background": "220 33% 98%",
          "--foreground": "222 47% 11%",
          "--card": "0 0% 100%",
          "--card-foreground": "222 47% 11%",
          "--popover": "0 0% 100%",
          "--popover-foreground": "222 47% 11%",
          "--primary": "221 83% 53%",
          "--primary-foreground": "0 0% 100%",
          "--secondary": "220 20% 96%",
          "--secondary-foreground": "222 47% 11%",
          "--muted": "220 18% 94%",
          "--muted-foreground": "215 16% 35%",
          "--accent": "221 83% 53%",
          "--accent-foreground": "0 0% 100%",
          "--destructive": "0 72% 51%",
          "--destructive-foreground": "0 0% 100%",
          "--border": "220 14% 90%",
          "--input": "220 14% 90%",
          "--ring": "221 83% 53%",
          "--radius": "0.75rem",
          "--chart-1": "221 83% 53%",
          "--chart-2": "199 89% 48%",
          "--chart-3": "160 84% 39%",
          "--chart-4": "43 96% 56%",
          "--chart-5": "0 72% 51%"
        },
        "dark": {
          "--background": "222 47% 7%",
          "--foreground": "210 40% 98%",
          "--card": "222 47% 9%",
          "--card-foreground": "210 40% 98%",
          "--popover": "222 47% 9%",
          "--popover-foreground": "210 40% 98%",
          "--primary": "221 83% 60%",
          "--primary-foreground": "222 47% 11%",
          "--secondary": "222 28% 14%",
          "--secondary-foreground": "210 40% 98%",
          "--muted": "222 28% 14%",
          "--muted-foreground": "215 20% 70%",
          "--accent": "199 89% 55%",
          "--accent-foreground": "222 47% 11%",
          "--destructive": "0 62% 40%",
          "--destructive-foreground": "210 40% 98%",
          "--border": "222 22% 18%",
          "--input": "222 22% 18%",
          "--ring": "199 89% 55%",
          "--radius": "0.75rem",
          "--chart-1": "221 83% 60%",
          "--chart-2": "199 89% 55%",
          "--chart-3": "160 84% 45%",
          "--chart-4": "43 96% 60%",
          "--chart-5": "0 72% 55%"
        },
        "extra_semantic_tokens": {
          "--surface-1": "222 47% 9%",
          "--surface-2": "222 28% 14%",
          "--surface-3": "222 22% 18%",
          "--info": "199 89% 55%",
          "--success": "160 84% 45%",
          "--warning": "43 96% 60%",
          "--danger": "0 72% 55%"
        }
      },
      "tailwind_color_usage": {
        "primary_actions": "bg-primary text-primary-foreground hover:bg-primary/90",
        "secondary_actions": "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        "borders": "border-border",
        "muted_text": "text-muted-foreground",
        "focus": "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      }
    },

    "shadows_and_depth": {
      "principle": "Enterprise depth: crisp borders + subtle shadow; avoid heavy blur.",
      "tokens": {
        "--shadow-sm": "0 1px 0 rgba(15, 23, 42, 0.08)",
        "--shadow-md": "0 10px 30px rgba(2, 6, 23, 0.25)",
        "--shadow-inset": "inset 0 1px 0 rgba(255,255,255,0.06)"
      },
      "tailwind_patterns": {
        "card": "shadow-[var(--shadow-sm)]",
        "floating_panel": "shadow-[var(--shadow-md)]"
      }
    },

    "spacing_and_layout": {
      "spacing_rule": "Use 2–3x more spacing than feels comfortable; keep dense content grouped with separators.",
      "container": {
        "marketing": "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8",
        "dashboard": "max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6"
      },
      "grid": {
        "dashboard": {
          "kpi_row": "grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4",
          "main_split": "grid grid-cols-1 xl:grid-cols-12 gap-4",
          "left": "xl:col-span-8",
          "right": "xl:col-span-4"
        },
        "marketing": {
          "bento": "grid grid-cols-1 md:grid-cols-12 gap-4",
          "bento_card": "md:col-span-4 lg:col-span-3"
        }
      }
    },

    "radius": {
      "rule": "Use slightly larger radius for modern enterprise softness.",
      "values": {
        "sm": "rounded-md",
        "md": "rounded-xl",
        "lg": "rounded-2xl"
      }
    }
  },

  "navigation_and_ia": {
    "global": {
      "top_banner": {
        "purpose": "Always-visible DEMO MODE disclosure when no upstream carrier.",
        "style": "Slim, high-contrast, non-dismissable in preview; dismissable locally if desired.",
        "tailwind": "w-full bg-secondary text-secondary-foreground border-b border-border",
        "content": [
          "Left: Badge ‘DEMO MODE’",
          "Text: ‘No upstream carrier connected. Provisioning and calling are disabled.’",
          "Right: Link ‘Learn more’ -> /docs/demo-mode"
        ],
        "data_testid": "demo-mode-banner"
      },
      "primary_nav": {
        "marketing": {
          "pattern": "Sticky top nav with product mega-menu (NavigationMenu) + CTA buttons.",
          "left": ["Wordmark", "Primary links"],
          "right": ["Developers", "Pricing", "Login", "Get started"],
          "mobile": "Sheet-based menu with grouped sections"
        },
        "app": {
          "pattern": "Left sidebar + top command row (search, env badge, user menu).",
          "sidebar_width": "w-[272px] (desktop), collapsible to icon rail w-[72px]",
          "mobile": "Sheet sidebar triggered by icon button"
        }
      }
    },

    "routes": {
      "marketing_pages": [
        "/",
        "/about",
        "/sip-trunking",
        "/wholesale-voice",
        "/outbound-termination",
        "/inbound-origination",
        "/local-did",
        "/toll-free",
        "/voice-api",
        "/pricing",
        "/coverage",
        "/network-infrastructure",
        "/developers",
        "/contact",
        "/terms",
        "/privacy",
        "/aup"
      ],
      "auth_pages": ["/login", "/register"],
      "customer_app": [
        "/dashboard",
        "/dashboard/trunks",
        "/dashboard/calls",
        "/dashboard/numbers",
        "/dashboard/billing",
        "/dashboard/developers",
        "/dashboard/settings"
      ],
      "admin_app": [
        "/admin",
        "/admin/customers",
        "/admin/audit",
        "/admin/carriers"
      ]
    },

    "sidebar_groups": {
      "customer": [
        {
          "label": "Overview",
          "items": ["Dashboard"]
        },
        {
          "label": "Voice",
          "items": ["Trunks", "Calls", "Numbers"]
        },
        {
          "label": "Finance",
          "items": ["Billing"]
        },
        {
          "label": "Developers",
          "items": ["API Keys (DEMO)", "Webhooks (DEMO)", "Docs"]
        },
        {
          "label": "Workspace",
          "items": ["Settings", "Audit (read-only)"]
        }
      ],
      "admin": [
        {
          "label": "Admin",
          "items": ["Admin Overview", "Customers", "Audit Logs", "Carriers (DEMO)"]
        }
      ]
    }
  },

  "page_level_layout_specs": {
    "marketing_home": {
      "hero": {
        "layout": "Two-column: left copy + right ‘Network status’ schematic card (SVG) + KPI chips.",
        "headline": "Space Grotesk, strong promise without claims",
        "cta": ["Get started", "View coverage"],
        "trust_row": "Logos replaced by text-only ‘Trusted by teams building voice products’ (no fake logos).",
        "allowed_gradient": {
          "rule": "Max 20% viewport; background only.",
          "example": "bg-[radial-gradient(60%_60%_at_20%_10%,rgba(56,189,248,0.18)_0%,rgba(2,6,23,0)_60%)]"
        }
      },
      "sections": [
        {
          "name": "Product bento",
          "cards": [
            "SIP Trunking",
            "Wholesale Voice",
            "Voice API",
            "Coverage",
            "Network Infrastructure",
            "Developers"
          ],
          "pattern": "Bento grid with icon + 2-line description + ‘Learn more’"
        },
        {
          "name": "How it works",
          "pattern": "3-step horizontal timeline (Cards + Separator)"
        },
        {
          "name": "Compliance & safety",
          "pattern": "Callouts: fail-closed, audit logs, role-based access"
        },
        {
          "name": "CTA band",
          "pattern": "Solid surface (no gradient), short copy + button"
        }
      ]
    },

    "marketing_service_page_template": {
      "pattern": "Hero + feature grid + technical specs table + FAQ accordion + CTA",
      "feature_grid": "3 columns desktop, 1 column mobile",
      "specs": "Use Table component; keep copy factual and non-claiming",
      "faq": "Accordion",
      "demo_disclosure": "If feature depends on carrier, show Badge ‘DEMO’ + Alert"
    },

    "auth_pages": {
      "layout": "Split-screen on desktop: left brand panel (navy) + right form card; single column on mobile.",
      "components": ["Card", "Form", "Input", "Label", "Button", "Checkbox"],
      "register_fields": [
        "Business name",
        "Legal entity type",
        "Country",
        "Email",
        "Password",
        "Accept Terms/AUP"
      ],
      "security_copy": "Small muted text about audit logging and access control.",
      "data_testids": {
        "login_email": "login-form-email-input",
        "login_password": "login-form-password-input",
        "login_submit": "login-form-submit-button",
        "register_submit": "register-form-submit-button"
      }
    },

    "customer_dashboard_overview": {
      "top_row": {
        "kpis": [
          "Balance",
          "Credit limit",
          "MTD minutes",
          "MTD cost"
        ],
        "kpi_card_pattern": "Icon tile + value + delta chip; keep compact height.",
        "tailwind": "grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      },
      "main": {
        "left": [
          "Traffic chart (LineChart) with tabs: 24h / 7d / 30d",
          "Recent CDR table (last 10)"
        ],
        "right": [
          "Service status list (Trunks, Numbers, API, Billing) with colored dots",
          "Ledger snapshot (last 5 entries)",
          "DEMO MODE carrier panel"
        ]
      },
      "empty_states": {
        "rule": "Never show blank panels; show Skeleton while loading; show ‘No data yet’ with next step CTA.",
        "examples": [
          "No calls yet -> link to /dashboard/trunks",
          "No numbers -> link to /dashboard/numbers"
        ]
      }
    },

    "admin_dashboard": {
      "overview": "Operational tiles: total customers, pending reviews, audit events (24h), carrier adapters (DEMO).",
      "customers": "Table with filters (Command) + Drawer for details.",
      "audit": "Table with severity badges + date range (Calendar) + export disabled in DEMO.",
      "carriers": "Adapter list with status ‘Not connected’ and configuration placeholders; all actions disabled."
    }
  },

  "component_system": {
    "primary_components_shadcn": {
      "component_path": "/app/frontend/src/components/ui/",
      "use": [
        { "name": "button", "file": "button.jsx" },
        { "name": "card", "file": "card.jsx" },
        { "name": "badge", "file": "badge.jsx" },
        { "name": "tabs", "file": "tabs.jsx" },
        { "name": "table", "file": "table.jsx" },
        { "name": "input", "file": "input.jsx" },
        { "name": "form", "file": "form.jsx" },
        { "name": "navigation-menu", "file": "navigation-menu.jsx" },
        { "name": "sheet", "file": "sheet.jsx" },
        { "name": "dropdown-menu", "file": "dropdown-menu.jsx" },
        { "name": "command", "file": "command.jsx" },
        { "name": "separator", "file": "separator.jsx" },
        { "name": "scroll-area", "file": "scroll-area.jsx" },
        { "name": "tooltip", "file": "tooltip.jsx" },
        { "name": "alert", "file": "alert.jsx" },
        { "name": "calendar", "file": "calendar.jsx" },
        { "name": "sonner", "file": "sonner.jsx" }
      ]
    },

    "custom_components_to_build_in_next_app": {
      "note": "Create these in /app/platform/web/components (or similar). Keep .jsx and named exports.",
      "list": [
        {
          "name": "Wordmark",
          "purpose": "Text logo ‘789 NETWORK SOLUTIONS’ with subtle tracking and weight.",
          "tailwind": "font-[var(--font-display)] tracking-[-0.02em] font-semibold",
          "data_testid": "brand-wordmark"
        },
        {
          "name": "DemoModeBanner",
          "purpose": "Global disclosure banner.",
          "data_testid": "demo-mode-banner"
        },
        {
          "name": "AppShell",
          "purpose": "Sidebar + topbar + content container; supports collapsed sidebar.",
          "data_testid": "app-shell"
        },
        {
          "name": "KpiCard",
          "purpose": "Compact KPI tile with icon, value, delta.",
          "data_testid": "kpi-card"
        },
        {
          "name": "StatusPill",
          "purpose": "Service status indicator with dot + label.",
          "data_testid": "status-pill"
        },
        {
          "name": "ReadOnlyCallout",
          "purpose": "Inline callout for read-only pages in preview.",
          "data_testid": "read-only-callout"
        }
      ]
    },

    "buttons": {
      "style": "Professional / Corporate",
      "variants": {
        "primary": {
          "use": "Main CTAs (Get started, Save, Create)",
          "shape": "rounded-xl",
          "motion": "hover shade shift + subtle lift; active press scale",
          "tailwind": "rounded-xl transition-colors hover:bg-primary/90 active:scale-[0.99]"
        },
        "secondary": {
          "use": "Secondary actions",
          "tailwind": "rounded-xl border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        },
        "ghost": {
          "use": "Toolbar icon buttons",
          "tailwind": "rounded-xl hover:bg-accent/10 transition-colors"
        },
        "disabled": {
          "rule": "Carrier-dependent actions disabled in DEMO MODE; show Tooltip explaining.",
          "tailwind": "disabled:opacity-60 disabled:pointer-events-none"
        }
      },
      "data_testid_rule": "Every Button must include data-testid describing role (e.g., ‘dashboard-add-trunk-button’)."
    },

    "forms": {
      "pattern": "Label above input; helper text below; errors in destructive color; no placeholder-only labels.",
      "input_tailwind": "h-10 rounded-xl",
      "validation": "Inline error + aria-describedby; focus ring uses --ring",
      "data_testid_rule": "All inputs/selects/checkboxes must have data-testid."
    },

    "tables": {
      "pattern": "Sticky header, zebra subtle via muted background, row hover highlight.",
      "tailwind": {
        "wrapper": "rounded-2xl border border-border overflow-hidden",
        "row_hover": "hover:bg-muted/50"
      },
      "cdR_table_columns": [
        "Timestamp",
        "From",
        "To",
        "Duration",
        "Cost",
        "Status"
      ]
    },

    "charts": {
      "library": "Recharts",
      "principles": [
        "Use 1–2 series max per chart by default",
        "Prefer muted gridlines and strong tooltip",
        "Use chart tokens --chart-1..5",
        "Always include empty state + skeleton"
      ],
      "recommended_charts": [
        {
          "name": "TrafficLineChart",
          "use": "Calls/minutes over time",
          "colors": ["hsl(var(--chart-1))", "hsl(var(--chart-2))"]
        },
        {
          "name": "CostBarChart",
          "use": "Cost by day",
          "colors": ["hsl(var(--chart-3))"]
        }
      ],
      "micro_interactions": {
        "hover": "Increase stroke width slightly on active line; show dot",
        "tooltip": "Use Card-like tooltip with border-border and bg-popover"
      }
    }
  },

  "motion_and_microinteractions": {
    "library": {
      "recommended": "framer-motion",
      "install": "npm i framer-motion",
      "usage_notes_js": "Use motion.div in .jsx; keep animations subtle and fast."
    },
    "principles": [
      "Motion communicates state changes (open/close, loading, success), not decoration",
      "Use 120–180ms for hover transitions; 180–240ms for panel entrances",
      "Respect prefers-reduced-motion"
    ],
    "patterns": {
      "sidebar_collapse": "Animate width + label opacity (no layout jank)",
      "card_hover": "TranslateY -1px + shadow increase (avoid transition: all)",
      "page_enter": "Fade + slight y (6–10px)"
    }
  },

  "accessibility": {
    "wcag": "Meet WCAG AA contrast for text and interactive elements.",
    "keyboard": [
      "Visible focus ring on all interactive elements",
      "Skip-to-content link on marketing and app shells"
    ],
    "aria": [
      "Use aria-disabled for disabled carrier actions",
      "Tables: proper headers",
      "Forms: aria-describedby for errors"
    ]
  },

  "content_and_copy_rules": {
    "demo_mode_language": {
      "required_phrases": [
        "DEMO MODE",
        "No upstream carrier connected",
        "Provisioning disabled",
        "Calling disabled",
        "Fail-closed"
      ],
      "avoid": [
        "‘Live network’, ‘guaranteed uptime’, ‘best rates’, ‘instant provisioning’"
      ]
    }
  },

  "data_testid_conventions": {
    "rule": "All interactive and key informational elements MUST include data-testid.",
    "format": "kebab-case describing role, not appearance",
    "examples": [
      "marketing-nav-login-link",
      "marketing-hero-primary-cta-button",
      "dashboard-balance-kpi-value",
      "dashboard-traffic-chart",
      "admin-customers-table",
      "admin-audit-date-range-calendar"
    ]
  },

  "image_urls": {
    "note": "No images required. Use Lucide icons + SVG schematics + charts."
  },

  "instructions_to_main_agent": [
    "Create a new Next.js app in /app/platform/web; do not retrofit CRA UI.",
    "Port shadcn/ui components or re-install shadcn in the Next app; keep styling consistent with tokens above.",
    "Implement light/dark mode toggle (Switch) and persist preference.",
    "Add DEMO MODE banner globally when carrier not connected; disable carrier-dependent actions with Tooltip.",
    "Use Recharts for dashboard charts; ensure skeleton + empty states.",
    "Use Space Grotesk + Manrope; set CSS variables --font-display/--font-body.",
    "Avoid gradients except small hero background accent (<20% viewport).",
    "Ensure every button/link/input/table key value has data-testid.",
    "Keep all examples and components in .js/.jsx (no .tsx)."
  ],

  "appendix_general_ui_ux_design_guidelines": "<General UI UX Design Guidelines>\n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
