# Resume Website Builder — Project Status & Pickup Notes

_Last reviewed: 2026-06-16. A snapshot of where the project stands so we can resume cleanly._

## What it is
A web app that turns a person's **resume PDF** into a ready-to-use **resume website**. Flow:
**Sign in / Register → Dashboard → Upload resume PDF → (auto) extract + parse → Generated resume website (view / download / QR to share).**

## Tech stack & architecture
- **Vanilla JS, no framework, no build step.** Static site: `index.html` + `script.js` (~1,550 lines, one `ResumeWebsiteBuilder` class) + `styles.css` (~456 lines). SF Pro Display font.
- **Client-side only — no backend/server.** All state lives in the browser.
- **CDN libraries** (loaded in `index.html`):
  - `pdf.js` (3.11.174) — extracts text from the uploaded PDF.
  - `qrious` (4.0.2) — generates the shareable QR code.
  - Google `reCAPTCHA` — loaded but running in demo mode.
- **Run it:** just open `index.html` (or serve with a static/Live Server). No install.
- **Git:** local repo, branch `main`, 3 commits ("Initial commit", "Create .DS_Store", "update"). (No remote confirmed.)

## What's built and working
- **Full UI flow** across sections (`auth → dashboard → upload → loading → result`), all toggled by showing/hiding `.section` divs.
- **Auth (client-side):** sign-in + register forms; users stored in `localStorage` key `resumeBuilder_users`; register validates password match + min-8-length + unique username/email.
- **Anti-abuse scaffolding:** rate limiting (login/registration attempts), "suspicious activity" check, device fingerprint via `btoa(userAgent+screenRes+timezone)`, max-10-accounts-per-device — **all lenient/demo-mode**.
- **PDF upload:** drag-and-drop or click, 50MB cap, `.pdf` only, file-info display.
- **PDF text extraction:** `pdfjsLib.getDocument(...)` reads all pages → raw text.
- **Resume parsing (heuristic/regex):** splits the text into **skills, education, work experience, projects** (and a "features" pattern pass). Lines ~1150–1484.
- **Website generation:** builds a full HTML document string (template begins ~line 942), wraps it in a `Blob`, **auto-downloads `resume.html`**, and opens it in a new window via `document.write`.
- **QR code:** QRious renders a QR to a (currently demo/localhost) URL for sharing.
- **Dashboard:** lists saved resume "cards" from `currentUser.resumes`, select to view, delete with confirm.

## Known gaps / limitations (the real next-steps list)
1. **No real backend or hosting.** The generated site only **downloads as a file**; the QR points to a **demo/localhost URL**, so resumes can't actually be shared online yet. → _Biggest missing piece: a real "Publish" that hosts the generated site at a shareable URL._
2. **Security is demo-grade (do NOT ship to real users as-is):**
   - **Passwords stored in plaintext** in `localStorage` (`u.password === password`). Needs real hashing + a real backend.
   - **reCAPTCHA is a placeholder** (`recaptchaSiteKey = '6LcDemo_SiteKey_ForTesting'`) and code "always allows for demo."
   - Auth/data are client-side only → no multi-device, wiped if the browser storage clears, trivially editable.
3. **Resume parsing is brittle** (regex/heuristics) — varies a lot by PDF layout. Could improve with smarter parsing or an LLM extraction step.
4. **Single output template.** No template/theme choices for the generated site.
5. **Monolith:** one ~1,550-line `script.js`, no modules, no tests, no build. Refactor opportunity.
6. Stray `.DS_Store` committed; consider a `.gitignore`.

## Suggested roadmap (pick up here)
- **Quick wins:** add `.gitignore` (`.DS_Store`); add a couple of resume templates; let the user edit parsed fields before generating.
- **Make it shareable (high value):** add real hosting/publish for the generated site (e.g., a backend or a static-host integration) + point the QR at the real URL.
- **If it needs real accounts:** move auth + storage to a real backend with hashed passwords (or use a provider like Clerk/Supabase); wire up a real reCAPTCHA key.
- **Robustness:** improve PDF parsing (or add an AI extraction step); split `script.js` into modules.

## Note on the sibling folder
`../ResumeWebsite/` is a **separate, near-empty starter** (a navbar template; `app.js` and `tech.html` are empty) — not this project. This file documents **ResumeWebsiteBuilder**.
