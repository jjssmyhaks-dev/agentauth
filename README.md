# AgentAuth

**Identity, permissions, and audit platform purpose-built for AI agents.**

> Auth built for agents, not humans.

AgentAuth gives developers a complete identity layer for AI agents — cryptographic key-based authentication, granular grant/permission scoping, human-in-the-loop approvals, tamper-proof audit trails, and webhook delivery.

---

## Quick Start

### Prerequisites

- Bun (recommended) or Node.js 18+
- npm or bun

### 1. Install

```bash
git clone https://github.com/jjssmyhaks-dev/agentauth.git
cd agentauth
bun install
```

### 2. Development

```bash
bun run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 3. Production Build

```bash
bun run build
bun run preview
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Frontend — Vite 8 + React 19 + Tailwind CSS 4          │
│  / (landing) · /auth (login) · /dashboard/*              │
│  Framer Motion animations · Lazy-loaded routes           │
├──────────────────────────────────────────────────────────┤
│  Dashboard Pages                                         │
│  Overview · Agents · Grants · Approvals · Activity       │
│  Analytics · Webhooks · API Keys · Settings · Docs       │
│  Notifications · Agent Detail · Onboarding Wizard        │
├──────────────────────────────────────────────────────────┤
│  UI Components                                           │
│  shadcn/ui (Radix primitives) · Lucide icons             │
│  Framer Motion · TanStack Table                          │
├──────────────────────────────────────────────────────────┤
│  State Management                                        │
│  AuthContext · DashboardContext · NotificationContext     │
│  Real-time simulation (useNotificationSimulator)         │
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Build | Vite 8 (Rolldown) |
| Framework | React 19 |
| Routing | React Router v7 |
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion |
| Components | shadcn/ui (Radix UI primitives) |
| Tables | TanStack React Table |
| Icons | Lucide React |
| Language | TypeScript 7 |

---

## Features

### Landing Page
- Animated auth flow diagram with traveling dots
- Scroll-triggered section reveals
- FAQ accordion with smooth animations
- Pricing cards with hover effects
- Mobile-responsive navigation

### Dashboard
- **Overview** — Live stats, pending approvals, activity feed
- **Agents** — Registry with create, revoke, trust scores
- **Agent Detail** — Per-agent view with sessions, keys, permissions, activity
- **Grants** — Create and manage scoped permission grants
- **Approvals** — Human-in-the-loop queue (approve/deny)
- **Activity** — Hash-chained audit log with filters and export
- **Analytics** — Token usage, action success rates, performance metrics
- **Webhooks** — Register, test, pause webhook endpoints
- **API Keys** — Generate and manage dashboard API keys
- **Notifications** — Real-time notification center with type filters
- **Settings** — Organization configuration
- **Docs** — SDK documentation and API reference

### Auth Flow
- Email/password sign-in and sign-up
- Session persistence via localStorage
- Protected dashboard routes with redirect
- Animated auth page with loading states

### Real-Time
- Simulated agent activity every 15 seconds
- Toast notifications for urgent events
- Live activity feed with animated entry/exit
- Notification system with priority levels (urgent/high/medium/low)

---

## Project Structure

```
agentauth/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── NotificationPanel.tsx
│   │   └── ToastContainer.tsx
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   ├── DashboardContext.tsx
│   │   └── NotificationContext.tsx
│   ├── data/
│   │   └── mock.ts          # Mock data for all dashboard entities
│   ├── hooks/
│   │   └── useNotificationSimulator.ts
│   ├── lib/
│   │   └── utils.ts         # cn() utility
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── AuthPage.tsx
│   │   └── dashboard/
│   │       ├── Layout.tsx
│   │       ├── OverviewPage.tsx
│   │       ├── AgentsPage.tsx
│   │       ├── AgentDetailPage.tsx
│   │       ├── GrantsPage.tsx
│   │       ├── ApprovalsPage.tsx
│   │       ├── ActivityPage.tsx
│   │       ├── AnalyticsPage.tsx
│   │       ├── WebhooksPage.tsx
│   │       ├── ApiKeysPage.tsx
│   │       ├── SettingsPage.tsx
│   │       ├── DocsPage.tsx
│   │       ├── NotificationsPage.tsx
│   │       └── OnboardingWizard.tsx
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx               # Route definitions with lazy loading
│   ├── main.tsx              # React root with BrowserRouter
│   └── index.css             # Theme tokens, Tailwind config, global styles
├── backend/                  # API documentation (NestJS backend reference)
├── sdk/                      # TypeScript SDK (agentauth-sdk)
├── sdk-python/               # Python SDK (agentauth)
├── public/
│   └── favicon.svg
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Dev server port (default: 5173) |

No external services required for the frontend — all data is mock/simulated for development.

---

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server on 0.0.0.0:5173 |
| `bun run build` | Production build to dist/ |
| `bun run preview` | Preview production build |
| `bun run typecheck` | TypeScript type checking |

---

## Build Optimizations

- **Route-level code splitting** via React.lazy() — each page loads independently
- **Production build** targets ES2020 with no sourcemaps
- **Chunked output** — vendor, motion, UI libraries split into separate chunks
- **Lazy-loaded pages** — Overview, Agents, Grants, etc. each get their own chunk
- **CSS optimization** — Tailwind 4 with automatic purging

---

## License

MIT
