# Fix cycle 21

## Review findings

1. The settings export helper returned silently when Firebase initialization failed, so the settings page could report a successful export even though no request was made.
2. API-key authentication used ordinary string comparison rather than a constant-time comparison.
3. Firebase ID-token verification did not check revocation, so a revoked session could remain accepted until the token expired.
4. Chat feedback controls stayed active while a feedback request was pending, allowing duplicate submissions.
5. Chat auto-scroll always used smooth scrolling, including for users who request reduced motion.

## Action plan

- Make export authentication failures reject so the existing translated error state is shown.
- Compare API keys with a constant-time helper.
- Ask Firebase Admin to reject revoked ID tokens.
- Disable all feedback controls during the active mutation and surface failures through the dashboard alert.
- Choose instant scrolling when `prefers-reduced-motion` is enabled.

## Implementation

- Applied the backend auth hardening in `api/opsmate/auth.py`.
- Updated the browser download helper and chat feedback components.
- Kept the existing API contracts and translated error copy unchanged.

## Validation

- Exercised the live public landing page, locale switcher, SEO path, and sign-in flow in an isolated browser tab after the Firebase domain change.
- Verified the cycle file and reviewed the changed paths without starting servers, builds, tests, or database commands.
