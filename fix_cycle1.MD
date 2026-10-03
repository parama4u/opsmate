# Fix cycle 1

## Findings

1. Sign-in fails on `orgchai.com` with Firebase `auth/unauthorized-domain`. This blocks a fresh user before account selection.
2. Header and footer section links use page-local hashes. On SEO pages, `#features` and `#security` do not exist, so those links appear to do nothing.
3. Japanese SEO pages render several shared section labels in English, including “Why teams use it” and “Common questions”.
4. The landing-page proof marquee renders two copies of the same text, and both copies are exposed to assistive technology.
5. `/api/auth/verify` returned raw exception messages, which could expose implementation details.

## Action plan

1. Improve the Firebase auth error so the missing authorized-domain deployment setting is actionable. Keep the deployment follow-up explicit because Firebase console configuration is outside this repository.
2. Route marketing navigation to the localized home page before applying the section hash.
3. Move shared SEO labels into the existing English and Japanese message catalogs.
4. Mark the decorative marquee copy as hidden from assistive technology while retaining the visual loop.
5. Return a stable auth verification error without forwarding exception text.

## Implementation status

- Completed the code changes above.
- Remaining deployment action: add the production hostname to Firebase Authentication authorized domains, then retry sign-in.

## Validation

- Verified the live auth failure and deep-page anchor behavior in the browser.
- Did not run builds, tests, or development servers, per repository instructions.
