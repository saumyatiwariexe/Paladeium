# Paladeium — Marketing Website

The public-facing marketing website for the **Paladeium AR Menu** platform.  
Built with React + Vite + TailwindCSS v4.

---

## Stack

| Tool | Purpose |
|---|---|
| React 19 | UI framework |
| Vite 6 | Build tool & dev server |
| TailwindCSS v4 | Styling (via `@tailwindcss/vite`) |
| Lucide React | Icons |

> **No database or backend logic lives here.**  
> The contact form submits via `mailto:`. When the shared Paladeium Supabase project  
> is ready, wire it in by replacing the `mailto:` block in `Contact.jsx`.

---

## Project Structure

```
website/
├── public/                  # Static assets served at /
│   ├── ar_food_hologram.png
│   ├── ar_hero_phone.png
│   ├── ar_ui_overlay.png
│   ├── restaurant_ar_scene.png
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── Hero.jsx
│   │   ├── HowItWorks.jsx
│   │   ├── Features.jsx
│   │   ├── Benefits.jsx
│   │   ├── Pricing.jsx
│   │   ├── FutureExpansions.jsx
│   │   ├── Contact.jsx      ← form uses mailto: (no DB)
│   │   └── Footer.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css            ← design system + Tailwind v4
├── index.html
├── vite.config.js
├── eslint.config.js
└── package.json
```

---

## Getting Started

```bash
cd website
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Adding the Shared Database Later

When the shared Supabase project is integrated across dashboard, app and website:

1. Create a `.env` file (never commit it):
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
2. Install the client:
   ```bash
   npm install @supabase/supabase-js
   ```
3. Create `src/lib/supabase.js` and update `Contact.jsx` to insert into the `leads` table.

---

## Build

```bash
npm run build    # outputs to dist/
npm run preview  # preview the production build
```
