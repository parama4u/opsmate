# Fix cycle 17

## Review findings

1. SEO pages inject JSON-LD directly into a script element. Page content is currently application-owned, but unescaped `<`, `>`, or `&` characters would make the markup fragile if content later comes from an editor or CMS.
2. The language selector used flag emoji as both visual decoration and option text. This is noisy in the UI and can render inconsistently across platforms.
3. Marketing scroll-reveal content stayed hidden when `IntersectionObserver` was unavailable. That turns a browser capability gap into missing page content.
4. `DashboardShell` imported the same auth module twice, which adds avoidable maintenance noise and makes future import changes easier to miss.
5. The chat typing indicator kept running its bounce animation for users who request reduced motion because the global reduced-motion rule did not cover the utility class.

## Action plan

- Escape JSON-LD delimiter characters before placing structured data in the script element.
- Use translated language names without emoji flags and keep the selector spacing correct.
- Make scroll reveal fail open when the browser lacks `IntersectionObserver`.
- Consolidate the duplicate auth import.
- Disable the typing bounce animation under `prefers-reduced-motion`.

## Implementation

- Applied all five changes in the web app.
- No server, build, test, or browser state was changed as part of this cycle.

## Validation

- Reviewed the changed paths and preserved the existing routing, translations, and animation behavior for users without reduced-motion preferences.
- User-side validation should run the normal web checks locally because repository rules prohibit starting builds or tests from the agent terminal.
