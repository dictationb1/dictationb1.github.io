# Upgrade progress — not a v2 release

## Phase 0: baseline

- Base: `427bedd6cde077007fbc6792863544095bebc2c8`.
- Local safety tag: `v1.4.0-before-upgrade`. No tag has been pushed.
- Work stays on `arena/d0de1e09-dictationb1-github-io` because this Arena session is fixed to that branch.
- The source matches the owner's version: 1.4.0, build 2026-10-13, 361,624 bytes.
- Existing tests were already present. Their older comparison commit became available after fetching the shallow history.
- Test packages are for development only. The app loads none of them.
- The saved-data fixture comes from the unchanged v1.4.0 `defaultData()`. It has a Thursday list, a dark theme and a changed speed. It contains no PIN or real person's data.

Commands run:

```text
npm ci --prefix tests
added 82 packages, and audited 83 packages in 5s
found 0 vulnerabilities

node --check (main and embedded Apps Script), plus acorn ecmaVersion 2017
PASS main: node --check and ES2017 parse
PASS gas: node --check and ES2017 parse

node tests/upgrade.cjs --baseline
FAIL B1: six-line paste reads 28 words without invented fields: 6 == 28
FAIL B2: lecturer tabs and unlocked banner do not stick over each other: admintabs must scroll normally
FAIL B6: default is two readings, no sentence, numbers, rate and pause kept: true == false
FAIL B6: saved v1.4.0 migration keeps settings and Thursday list: true == false
FAIL B7: expired override cannot hide the scheduled list: 'override' == 'list_sample_b1'
FAIL B5: shared admin check counts wrong attempts, not just login: wrong attempts did not start a lockout
Upgrade regression tests: 0 passed, 6 failed.
Exit: 1 (expected before fixes).
```

B5 belongs to phase 3. Keep its failing test available with `node tests/upgrade.cjs --security`; do not treat a phase 1 test run as evidence for server security.
