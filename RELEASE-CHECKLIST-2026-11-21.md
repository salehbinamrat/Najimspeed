# Najimspeed Hotspot — release checklist (2026-11-21)

## Source and scope
- Target repository: `salehbinamrat/Najimspeed`
- Changes are developed in a pull request; do not merge into `main` before all required checks succeed and the owner approves.
- Do not alter the camera source or UI. Protect `js/cam.najm.js` SHA: `f25686596253f2b693b09c39e814fa767043fa46`.
- Keep User Manager speed ports `62021`, `62022`, `62023`, `62024` unchanged.

## Required checks
1. `node --check js/portal.core.js` and `node --check js/chap.md5.js`.
2. `node --test tests/*.test.cjs` — no failing tests.
3. Verify CHAP octal and URL-escaped challenge decoding, native fallback, PAP, session and RADIUS errors.
4. Verify POST responses that redirect to HTML by querying `/status`, and never trust a different authenticated username.
5. Only after tests pass, create the router-ready ZIP with **exactly** the HTML pages, `css/`, `font/`, `img/`, and `js/`.
6. Generate `SHA256SUMS.txt` and upload GitHub Actions artifact. Do not put `.github/`, `tests/` or docs on the MikroTik.

## Deploy safely
1. Back up the current Hotspot directory on the router.
2. Extract the tested ZIP and upload all included operational files, including the updated `login.html`, `flogin.html`, `index.html`, `js/chap.md5.js` and `js/portal.core.js`.
3. Force refresh the captive portal after upload to avoid a cached JavaScript version.
4. Check `login-by`, User Manager, and RADIUS logs if a valid card is still rejected. Never assume an unspecified RADIUS rejection means expired balance.
5. Test a valid card, an invalid card, an active card on another device, all four speed choices and logout using actual RouterOS v6 hardware.

**Evidence scope:** CI and browser simulations cannot conclusively validate live RADIUS/User Manager behavior on the router.
