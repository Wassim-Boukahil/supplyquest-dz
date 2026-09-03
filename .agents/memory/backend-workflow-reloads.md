---
name: Backend workflow reloads
description: A running tsx development workflow can retain an older backend module after source edits.
---

Restart the configured application workflow after backend source or generated-client changes before validating live API behavior.

**Why:** During intelligence endpoint verification, unit tests loaded the corrected source while the already-running workflow still served an older module until it was restarted.

**How to apply:** After a backend batch, restart once, then check workflow logs and exercise representative authenticated endpoints.