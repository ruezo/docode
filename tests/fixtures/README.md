# Test fixture policy

Fixtures in this directory are test-only inputs. They are not current Linux DO compatibility evidence and must never be presented as proof that the live site still matches them.

Every fixture must:

- use `defineSyntheticFixture` or a future reviewed sanitized-capture helper;
- declare its domain, missing/partial/error state, creation date, and provenance;
- keep `currentSiteContract` false;
- contain no credentials, cookies, authorization data, tokens, session state, private content, personal email addresses, or other sensitive data;
- use synthetic identities and routes unless a minimal public capture has been deliberately sanitized;
- model adapter or deterministic-logic input rather than coupling generic UI tests to current Linux DO CSS selectors.

Before adding a sanitized public capture, record its public route family and observation date without retaining account state or personal content. Re-run live compatibility checks in the task that relies on it.
