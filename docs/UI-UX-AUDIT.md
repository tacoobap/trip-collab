# Trup — Full UI/UX Audit

**Audit lens:** Clarity, consistency, polish, simplicity (Apple/Airbnb-level bar).  
**Scope:** All surfaces — auth, landing, trip planning, itinerary, collection, modals, drawers, toasts, forms, empty/loading/error states.

---

## Executive summary

Trup has a solid base: semantic tokens, good typography (Playfair + DM Sans), touch-friendly targets, and clear trip flows. To reach top-tier polish, focus on: **one source of truth for layout/chrome**, **unified feedback patterns**, **accessibility (focus, ARIA, reduced motion)**, **copy and navigation consistency**, and **fixing a few bugs and visual inconsistencies**.

---

## 1. Brand & product naming

| Issue | Location | Recommendation |
|-------|----------|----------------|
| **Inconsistent product name** | Sign-in says **"Trip Collab"**; header and meta say **"Trup"**. | Pick one product name everywhere (suggest **Trup** for brevity and domain). Update SignInPage title and any marketing copy to "Trup". |
| **HTML title** | `index.html`: "Trup" | Keep; add suffix for context if desired, e.g. "Trup — Trip planning". |

---

## 2. Design system & tokens

### 2.1 What’s working

- **CSS variables** for background, foreground, primary, secondary, muted, destructive, border, ring; brand colors (golden, sage, navy, sand, coral).
- **Single radius variable** (`--radius: 0.5rem`) driving `rounded-md/lg`.
- **Typography:** Playfair Display (headings), DM Sans (body), `.hero-byline` for itinerary.
- **Tailwind theme** correctly extends with these tokens; `tailwindcss-animate` and keyframes (fade-up, fade-in, shimmer) are defined.

### 2.2 Gaps

- **No spacing scale** beyond default Tailwind. Consider 4/8/12/16/24/32/48 (or similar) and use consistently for section padding and gaps.
- **Dark mode** is defined in CSS (`.dark`) but **no theme toggle** in the app; either ship a toggle or remove dark tokens to avoid confusion.
- **Success feedback** uses raw `emerald-*` in ToastProvider instead of a semantic token (e.g. `--success`), so success and error aren’t aligned with the rest of the system.
- **Locked slot** uses raw `blue-500/*` in SlotCard/ProposalCard; consider `--accent` or a dedicated `--locked` token for consistency.

**Recommendations:**

- Add `--success` (and optionally `--success-foreground`) and use it for success toasts.
- Use semantic tokens for “locked” state (e.g. accent or a new token) instead of hard-coded blue.
- Document spacing (e.g. section padding `py-8`/`py-10`, card padding `p-4`/`p-5`) in a short design note or Storybook.

---

## 3. Layout & navigation

### 3.1 Structure

- **No shared layout component.** Trip area (TripPage, ItineraryPage, CollectionPage) each render **PageHeader** + main; Landing has its own header. Result: duplicated chrome and risk of drift (e.g. logo link, nav items).
- **PageHeader** “Trup” link goes to **`/`** (sign-in). For signed-in users, “home” is `/home`; going to `/` can feel wrong. Consider:
  - Logo → `/home` when authenticated, or
  - Keep `/` but ensure redirect when already signed in (you already redirect on SignInPage).
- **Trip sub-nav** (Planning | Collection | Itinerary) is clear and has active state (border + weight). Centered nav is good; on small screens consider a single row with scroll or a more compact treatment.

### 3.2 Recommendations

- Introduce a **trip layout** (e.g. `<TripLayout trip={trip}>`) that renders PageHeader + optional trip sub-nav and `children`, so all three trip pages use the same chrome.
- Unify **landing header** and **PageHeader**: same logo, same “Trup” name, same primary CTA style (e.g. “New trip” vs trip-level actions).
- Resolve logo link: either **Trup → `/home`** for signed-in users (with a small redirect at `/`) or document that “Trup” = sign-in and “My trips” lives under a different entry point.

---

## 4. Pages & flows

### 4.1 Sign-in

- **Pros:** Centered card, clear hierarchy (icon, title, description), Google + email, error banner, divider “or continue with email”, footer links.
- **Cons:**
  - Product name “Trip Collab” vs “Trup” elsewhere.
  - Toggle “Already have an account? / Don’t have an account?” is a plain `<button>`; consider `variant="link"` from your Button for consistency.
  - No “Forgot password?”; acceptable if you rely on Google, but worth a one-line note in docs.

### 4.2 Landing (My trips)

- **Pros:** Empty state (“Plan your first trip”) with primary CTA; trip cards with name, destinations, dates; “Plan a new trip” card in grid; motion (framer-motion) is subtle.
- **Cons:**
  - Firebase warning banner uses raw `amber-*`; align with design tokens (e.g. muted + destructive or a dedicated “warning” token) for consistency.
  - Heading “My trips” vs empty state “Plan your first trip” — both are clear; consider same font size/weight pattern as other main headings.

### 4.3 Trip (Planning board)

- **Pros:** Trip name + dates bar, Stays + Invite actions, guest banner with “Join this trip”, setup panel when no days, day pills on mobile, horizontal scroll with “more days” hint.
- **Cons:**
  - **Error/not-found** block shows **Signed-in UID** and **Firebase project**; great for dev, noisy for users. Move debug info behind a flag or dev-only view.
  - Guest banner uses raw `amber-*` again; same token recommendation as landing.
  - “Invite link” → “Link copied” is good; consider a short toast as well for consistency with other success feedback.

### 4.4 Itinerary

- **Pros:** Full-view hero, gradient overlay, scroll-based header, customize panel (upload hero, generate narrative), days list with city dividers.
- **Cons:**
  - Hero image has a slow zoom animation (scale 1 → 1.08, 20s); some users may find it distracting; consider `prefers-reduced-motion` or a shorter/different effect.
  - Narrative generation has multiple steps (“Writing…”, “Saving…”); ensure one clear success message and error path (toast + inline if needed).

### 4.5 Collection

- **Pros:** Hero section with title and CTAs (“Suggest something for me”, “Add an idea”), grouped list by destination, suggestions dialog with vibe input.
- **Cons:**
  - **Bug:** `CollectionPage` uses `hasAny` and `sections` and references `Sparkles`, `Plus`, `Textarea`, `CollectionItemCard` but does not define `hasAny`/`sections` and does not import Sparkles, Plus, Textarea, CollectionItemCard — **this will throw at runtime.** Use `CollectionList` for the main list (or define `hasAny`/`sections` and add all missing imports).
  - Non-member message uses same amber pattern; same token recommendation.

---

## 5. Components

### 5.1 Primitives (Button, Input, Textarea, Card, Badge)

- **Button:** CVA variants and sizes, touch min-heights (44/48px), `focus-visible:ring-1`. Good.
- **Input:** Same ring and min-height; `md:text-sm` vs `text-base` on small screens is intentional but worth documenting so forms don’t mix different sizes.
- **Textarea:** Min-heights and focus styles consistent with Input.
- **Card:** `rounded-xl`, border, shadow; CardHeader/Title/Description/Content/Footer are present. Some pages use raw `rounded-2xl` (e.g. TripCard, SlotCard); decide whether “card” is always `rounded-xl` or if “large card” is `rounded-2xl` and document.

### 5.2 Dialog

- **Custom implementation** (no Radix): overlay + Escape + click-outside to close.
- **Missing:** Focus trap (tab stays inside dialog), `aria-modal="true"`, `role="dialog"`, and moving focus to first focusable element on open and back to trigger on close. Without these, keyboard and screen-reader users can tab into the page behind.
- **DialogClose** is a custom button with `aria-label="Close"`; good. Ensure it’s the last focusable element or that focus order is logical.

**Recommendation:** Add focus trap and ARIA (or adopt a headless dialog that provides them) so modals are accessible and match expected behavior.

### 5.3 Drawers (ProposalDrawer, StaysDrawer)

- **ProposalDrawer:** Bottom sheet, drag handle on mobile, AnimatePresence, overlay. Good.
- **StaysDrawer:** Similar pattern.
- **Inconsistency:** No shared `Drawer`/`Sheet` primitive; two custom implementations. Consider one reusable bottom sheet (overlay + panel + focus trap + Escape) and reuse it for both.
- **ProposalDrawer** has many actions (icon picker, time chips, add idea, pick from collection, unlock, delete slot); hierarchy is acceptable but “Add an idea” vs “Write a new idea” / “Pick from Collection” could be slightly clearer (e.g. one primary, one secondary).

### 5.4 Toasts

- **Position:** Bottom-right, `aria-live="polite"`, `role="region"`, `aria-label="Notifications"`. Good.
- **Variants:** default (secondary), success (emerald), error (destructive). Success should use a semantic token when you add it.
- **Animation:** Framer-motion enter/exit is smooth; consider `prefers-reduced-motion: reduce` to shorten or disable motion.

---

## 6. Forms

- **Labels:** Most forms use `label` + `block text-sm font-medium`; required often marked with `*` and `text-destructive`. Good.
- **Errors:** Inline below field or in a block (e.g. `text-destructive`). Consistent.
- **NewTripDialog:** Trip name, destinations (add/remove chips), start/end date with smart focus and min; good. “Create trip →” is clear.
- **AddDayDialog / EditDayModal:** Date + city; consistent with rest.
- **CollectionItemForm:** Add/edit with destinations; consider grouping optional vs required fields (e.g. “Required” / “Optional” subheadings) for clarity.
- **StaysDrawer AddStayForm:** Validation messages are clear; same token recommendation for any error/warning boxes.

---

## 7. Empty, loading & error states

### 7.1 Patterns

- **Loading:** Usually a centered `Loader2` (spinner); sometimes “Loading…”, “Creating…”, “Unlocking…”. Good.
- **Empty:** Landing (“Plan your first trip”), Collection (“No ideas in the collection yet”), ProposalDrawer (“No ideas for this slot yet”). Copy is clear and actionable.
- **Error:** Mix of inline text, bordered alert (SignIn), and toasts. Generally good; reduce raw colors (amber, emerald) in favor of tokens.

### 7.2 Inconsistencies

- **Full-screen loading:** TripPage, ItineraryPage, CollectionPage, LandingPage each use a centered spinner with slightly different wrappers (e.g. `py-24` vs `py-12`). Consider a shared `<PageLoader />` (e.g. full viewport, centered, optional message).
- **Error pages:** Trip not found / Sign in to view: multiple pages duplicate the same structure (title, message, “Sign in”, “Back to home”). Extract a shared `<AuthRequiredMessage />` or `<TripNotFound />` for consistency and one place to tweak copy/links.
- **Debug info:** Trip/Itinerary not-found shows UID and project id; hide behind `import.meta.env.DEV` or a debug query param.

---

## 8. Microcopy & clarity

- **“Ideas” vs “proposals”:** Planning uses “ideas” in the drawer and “proposals” in types; UI copy uses “ideas” — good. Keep “ideas” in UI.
- **“Lock in” / “Locked”:** Clear. “Unlock — reopen for planning” is good.
- **“Suggest something for me”:** Clear. Optional “Vibe” with placeholder “e.g. chill coffee spot…” is helpful.
- **“At a glance” / “Vibe tags”:** Section names are clear for itinerary narrative.
- **“Continue to planning” / “Set up your days”:** Clear. “Create X days →” is good.

---

## 9. Accessibility

- **Focus:** Buttons and inputs use `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`. Good. Dialogs need focus trap and return focus.
- **Touch targets:** Buttons and key controls use `min-h-[44px]` / `min-w-[44px]` on mobile. Good.
- **ARIA:** UserMenu has `aria-expanded`, `aria-haspopup`, `role="menu"` / `role="menuitem"`. Dialog needs `role="dialog"`, `aria-modal="true"`, and optional `aria-labelledby` / `aria-describedby`.
- **Color:** Primary/secondary/muted/destructive have enough contrast in theme; no reliance on color alone for critical info.
- **Motion:** Framer-motion is used in several places; add `prefers-reduced-motion: reduce` (e.g. in tailwind or a global wrapper) to respect system preference.

---

## 10. Responsive & touch

- **Breakpoints:** `max-sm`, `sm`, `md`, `lg` used consistently; main content is responsive.
- **Planning board:** Horizontal scroll with snap on mobile, day pills for navigation; “more days” gradient hint is helpful.
- **Modals/drawers:** `max-h-[90vh]` / `85dvh`, padding and safe-area considered; good.
- **Headers:** Logo and nav collapse appropriately; Stays and Invite remain usable on small screens.

---

## 11. Priority fix list

1. **CollectionPage bug (P0):** Define `hasAny` and `sections` (or switch to `CollectionList`) and add missing imports: `Sparkles`, `Plus`, `Textarea`, `CollectionItemCard`. Otherwise the Collection page will crash.
2. **Dialog a11y (P1):** Add focus trap, `role="dialog"`, `aria-modal="true"`, and focus return.
3. **Product name (P1):** Use “Trup” (or one name) everywhere, including SignInPage.
4. **Error/debug (P1):** Hide UID and Firebase project from non-dev error screens.
5. **Tokens (P2):** Add `--success`, use semantic color for locked state and warning banners (avoid raw amber/emerald/blue where it’s the main UI).
6. **Shared layout (P2):** A single wrapper component (e.g. `<TripLayout trip={trip}>`) that renders the trip chrome once — **PageHeader** (logo, Planning | Collection | Itinerary, UserMenu) plus the strip with trip name and Stays/Invite when relevant. Each of TripPage, ItineraryPage, and CollectionPage would render `<TripLayout><PageContent /></TripLayout>` instead of each page building the header and bars itself. That way the chrome (logo link, nav items, spacing) is defined in one place and can’t drift between pages.
7. **Reduced motion (P2):** Respect `prefers-reduced-motion` for animations and toasts.
8. **Drawer primitive (P3):** Single bottom-sheet component used by ProposalDrawer and StaysDrawer.

---

## 12. Summary

- **Clarity:** Flows and copy are clear; tighten product name and error/debug exposure.
- **Consistency:** Unify layout/chrome, loading/error components, and token usage (success, warning, locked).
- **Polish:** Add dialog a11y, optional reduced-motion, and one shared drawer primitive.
- **Simplicity:** Reuse CollectionList on Collection page, extract shared layout and error/loader components to keep the app simple and maintainable.

Fixing the CollectionPage bug and dialog accessibility will have the highest impact; then naming, tokens, and shared layout will make the product feel cohesive and professional.

---

## 13. Interaction patterns, layouts & visual design

This section focuses on **how it feels to use** the product — flows, hierarchy, clutter, and where a senior designer might change layout or interaction (not just tokens or a11y).

### 13.1 Entry & first-time experience

- **Landing after sign-in:** You land on “My trips” with either an empty state (“Plan your first trip”) or a grid of cards. The empty state is clear and the CTA is obvious. One tweak: consider a single, slightly larger “Plan your first trip” card that looks like a trip card (same style as “Plan a new trip” in the grid) so the empty state and the “add” card in a populated list feel like the same action. Right now empty state is centered hero-style; with one trip you get a grid with one card + the dashed “Plan a new trip” — the mental model could be “your list, always with an add card at the end.”
- **New trip flow:** NewTripDialog is compact (name, destinations, dates). The step from “Create trip” to “Set up your days” (assign cities per day) is a good progression. Consider a one-line hint in the dialog: “You’ll assign cities to each day next” so the transition to TripSetupPanel doesn’t feel like a new app.

### 13.2 Planning board

- **Horizontal scroll + day pills:** On mobile, horizontal scroll with day pills is the right pattern. The “+N more” and the gradient hint on the right are helpful. One refinement: when there are many days, the pill for “today” or “current” could be slightly more prominent (e.g. a dot or “You are here”) so you always know which day you’re looking at.
- **Slot cards:** Open vs proposed vs locked is clear. The helper line “Not locked in yet — tap to decide together” is good. Consider making the **primary action on an open slot** even more obvious: e.g. the whole card could read “Add idea” as the main line, with the time secondary, so it’s unmistakably tappable.
- **ProposalDrawer:** Lots of actions (time chips, icon, add idea, pick from collection, lock, unlock, delete). Hierarchy is okay; “Write a new idea” and “Pick from Collection” could be visually grouped as “Add” with one primary (e.g. “Write idea” filled, “From collection” outline) so the eye goes to one first. The time quick-picks (“9:00 AM”, etc.) are useful; the “or type above” is easy to miss — consider placing it right under the editable time or making it a small placeholder in the time field.

### 13.3 Itinerary

- **Hero:** Full-view hero with trip name and tagline is strong. The slow zoom on the image can feel premium or distracting; offering a “calm” option (no zoom or very subtle) would suit users who prefer less motion.
- **Scroll and header:** Header appearing after scroll is correct. The transition from over-hero (dark/transparent) to solid could be a bit smoother (e.g. blend the background color in over 100–200px of scroll) so it doesn’t feel like a hard cut.
- **Customize panel:** Upload hero + “Generate” / “Update text” is clear. If generation takes a while, a short progress line or “Writing day 2 of 5…” would set expectations and reduce “did it break?” anxiety.

### 13.4 Collection

- **Role of Collection:** “Save ideas for later and add them to the plan when you’re ready” is a good one-liner. The split between “Suggest something for me” (AI) and “Add an idea” (manual) is clear; “Suggest” as primary (filled) and “Add” as secondary (outline) matches that.
- **Grouping by destination:** Grouping by destination (and “Other”) works. If a trip has one destination, you still get one section — consider a single-destination trip showing a simple “All ideas” or the destination name as a subtle label so it doesn’t feel like an extra heading for no reason.
- **Suggestions dialog:** “We’ll look at your itinerary and open slots…” sets expectations. The “Vibe (optional)” field could sit under a light “Narrow by vibe” sublabel so it’s clear it’s a filter, not required.

### 13.5 Invite & guest experience

- **Join trip:** The banner “You’re viewing as a guest… Join this trip” is clear. Putting “Join this trip” as a button in the same bar is correct. After a successful join, a short toast (“You’ve joined the trip”) would close the loop; the banner disappearing is good.
- **Invite link:** “Invite link” → “Link copied” is good. Optionally show a toast “Link copied to clipboard” so it’s consistent with other copy actions and works for users who don’t notice the button label change.

### 13.6 Global navigation & chrome

- **Trip sub-nav (Planning | Collection | Itinerary):** Centered, with active state, is clear. On small screens the three tabs can feel tight; ensure the active indicator (e.g. bottom border) is visible and that tap targets stay 44px.
- **Logo “Trup”:** If it goes to `/` (sign-in), signed-in users might expect “home” to be “My trips.” Consider making the logo go to `/home` when the user is authenticated (with `/` redirecting to `/home` when already signed in) so “Trup” = “back to my trips” in-app.
- **User menu:** Avatar + “Sign out” is minimal and correct. If you add “My account” or “Settings” later, keep a single dropdown with one or two items so it doesn’t become a long list.

### 13.7 Visual hierarchy & density

- **Trip name bar:** Trip name + edit icon + dates + Stays + Invite is a lot in one bar. On mobile it already stacks or truncates; on desktop consider a clear order: (1) trip name + edit, (2) dates on the same line or under, (3) Stays and Invite as secondary actions. That keeps “what trip is this” first and “what can I do” second.
- **Cards:** Trip cards (landing), slot cards, collection cards use consistent rounded corners and borders. Using one card style (e.g. `rounded-xl` + border) for all “content cards” and reserving `rounded-2xl` for hero-style blocks (empty state, trip card on landing) would tighten the system.
- **Spacing:** Section padding (e.g. `py-8` / `py-10`) and gaps between cards are consistent. No major density issues; if anything, the Planning board could use a bit more breathing room between day columns on large screens so it doesn’t feel dense when there are many days.

### 13.8 Summary of interaction/layout tweaks

| Area | Change |
|------|--------|
| Empty state vs grid | Align “first trip” with “add trip” card style so the same mental model holds with 0 or 1+ trips. |
| New trip dialog | One-line hint: “You’ll assign cities to each day next.” |
| Planning / day pills | Optional “current day” indicator when many days. |
| Open slot card | Make “Add idea” the dominant line so the card is obviously tappable. |
| ProposalDrawer | One clear “Add” primary (e.g. “Write idea”); “or type above” nearer the time field. |
| Itinerary hero | Option to disable or soften zoom for reduced motion / preference. |
| Header over hero | Smoother transition (color blend) when scrolling. |
| Generation | Progress or “Writing day X of Y” during long runs. |
| Collection single-dest | Avoid redundant “Paris” section label when there’s only one destination. |
| Suggestions dialog | “Narrow by vibe” sublabel for the optional field. |
| Join trip | Toast “You’ve joined the trip” after success. |
| Invite link | Optional toast “Link copied” for consistency. |
| Logo | Consider Trup → `/home` when signed in. |
| Trip name bar | Clear order: name first, then dates, then Stays/Invite. |
| Cards | One standard card style; reserve larger radius for hero-style blocks. |

**What “chrome” and “cards” mean here:**  
- **Chrome** = the persistent UI frame (header, logo, trip nav). The suggestion was to keep a clear order in the trip name bar (name → dates → actions) and to use the logo to go to “My trips” when signed in.  
- **Cards** = the suggestion is only about **corner radius**: use one radius (e.g. `rounded-xl`) for normal content cards (slot cards, collection cards, stay cards) so they feel like one family; use a larger radius (`rounded-2xl`) only for hero-style blocks (empty-state “Plan your first trip” card, trip cards on the landing page). That keeps the system consistent without changing layout.
