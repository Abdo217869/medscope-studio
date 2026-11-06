# Medscope Studio

> **Free, client-side medical school timetable generator & publisher.**  
> Transform complex medical rotations and university schedules into elegant, high-resolution A4 PDFs per section in seconds — right inside your browser.

**Medscope Studio • © Medscope Team • made by Fishez**

---

## 🌟 Highlights & Features

- **100% Client-Side & Private**: No servers, no tracking, no paid APIs. All data stays in your browser (`localStorage`).
- **Precision 1414×2000 A4 Engine**: Pixel-perfect rendering calibrated to university print specifications (zero clipping, custom font metrics, automatic shrink-to-fit).
- **Global Continuous Section Model (1..N)**:
  - Sections are numbered continuously across lettered groups (e.g., Group A: 1–3, Group B: 4–6, Group C: 7–9, Group D: 10–12).
  - Clean scope references (`letter`, `practicalGroups`, `sections: ["8"]`).
  - Standardized filename pattern: `{module}_Group_{group}_Section_{section}_Week_{week}`.
- **In-App Preflight Audit (Non-Blocking)**:
  - Validates time overlaps, room assignments, weekday date correctness, and missing fields.
  - Displays `"Everything looks fine"` or plain-language issue warnings with `"Go to session"` jump buttons.
  - Export is never blocked.
- **Full Theme & Typography Engine**:
  - Dark developer-tool UI with warm living aurora chrome (crimson, coral, amber).
  - Typography roles with Inter and Geist Mono, custom font sizes, colors, and shadows.
  - 50-step Undo / Redo history stack.
- **Flexible Export & Batch Packaging**:
  - Single A4 PDFs, multi-page consolidated PDFs, or lossless ZIP archives.
  - Resolution presets: 1.0x (Standard Web), 1.5x (High Resolution, 250+ DPI), 2.0x (Ultra Print Quality, 300+ DPI).
- **Projects Library**:
  - Create, switch, duplicate, rename, and delete multiple timetable projects locally.
  - Preloaded with the complete 12-section GIT (Gastrointestinal Tract) academic schedule.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/medscope/timetable-studio.git
cd timetable-studio

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Production Build & Preview
```bash
# Build production bundle to /dist
npm run build

# Preview production build locally on port 4173
npm run preview
```

---

## 🤖 3-Step Team AI Workflow

Medscope Studio uses a rigorous two-prompt AI workflow to convert university schedule PDFs into clean timetable JSON with 100% accuracy:

```
┌─────────────────────────────────┐
│  Faculty Timetable PDF / Image  │
└────────────────┬────────────────┘
                 │
                 ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Step 1: Prompt 1 (Format Normalization)                     │
 │ • Copy Prompt 1 from Medscope Studio.                       │
 │ • Paste into ChatGPT or Claude with your timetable PDF.     │
 │ • Fill in the module box at the top (Title, Term, Year).    │
 │ • AI outputs plain, structured text.                        │
 └───────────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Verification Check                                          │
 │ • Compare the formatted text against the PDF.               │
 │ • Ensure no sessions were missed or misattributed.          │
 └───────────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Step 2: Prompt 2 (JSON Generation)                          │
 │ • Copy Prompt 2 from Medscope Studio.                       │
 │ • Paste the verified plain text into the AI chat.           │
 │ • AI returns ONE strictly valid JSON block.                 │
 └───────────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Step 3: Import & Export                                     │
 │ • Click "Import JSON" in Medscope Studio and paste code.    │
 │ • Preflight audit validates room and time consistency.      │
 │ • Click "Start Export" to generate publication-ready PDFs!  │
 └─────────────────────────────────────────────────────────────┘
```

Both Prompt 1 and Prompt 2 copy buttons are accessible directly from the **Empty State**, **Help Drawer**, and **Import Modal** in the app.

---

## 📦 Deployment to GitHub Pages

The application is preconfigured with relative asset resolution (`base: './'`) in `vite.config.js` to run out of any GitHub Pages subpath.

### Option A: Automated GitHub Actions (Recommended)
1. Push your repository to GitHub.
2. In your repository on GitHub, open **Settings** → **Pages**.
3. Under **Build and deployment** → **Source**, select **GitHub Actions**.
4. The included workflow (`.github/workflows/deploy.yml`) will automatically build and publish every commit to `main`.

### Option B: Manual GitHub Pages Deployment
```bash
# Build the production bundle
npm run build

# Deploy the /dist folder using gh-pages
npx gh-pages -d dist
```

---

## 🛠️ Testing & Verification

A comprehensive automated test suite covers rendering fidelity, projects library, safe merge, and acceptance criteria:

```bash
# Run acceptance test suite
node scripts/test-phase6b-phase8.js

# UI restyle and visual checks
node scripts/test-phase7.js

# GIT real data and date formatting tests
node scripts/test-phase6.js

# Projects library & safe merge tests
node scripts/test-phase5.js

# Visual identity & theme tests
node scripts/test-phase4.js

# Validator engine unit tests
node scripts/test-validator-engine.js

# Render fidelity tests
node scripts/test-render.js
```

---

## 📄 License & Credits

- **Site Name**: Medscope Studio
- **Copyright**: © Medscope Team
- **Created by**: Fishez
- Distributed under the MIT License for medical faculties and student communities.
