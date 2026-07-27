# How to land this work in Marble_with_Nuage

This agent run was started against `usman13581-.github.io`, so Cursor's write
token cannot push to `usman13581/Marble_with_Nuage` (GitHub returns 403). The
branch below is the full Phase 2–3 delivery, pushed where this agent *can*
write, and it fast-forwards cleanly onto `Marble_with_Nuage`'s initial commit.

## Branch

`cursor/marble-phase2-3-quotations-jobs-invoices-3456`

Source of truth for this delivery:

https://github.com/usman13581/usman13581-.github.io/tree/cursor/marble-phase2-3-quotations-jobs-invoices-3456

## Import into Marble_with_Nuage

```bash
git clone https://github.com/usman13581/Marble_with_Nuage.git
cd Marble_with_Nuage

git remote add delivery https://github.com/usman13581/usman13581-.github.io.git
git fetch delivery cursor/marble-phase2-3-quotations-jobs-invoices-3456

git checkout -b cursor/marble-phase2-3-quotations-jobs-invoices-3456
git merge --ff-only delivery/cursor/marble-phase2-3-quotations-jobs-invoices-3456

git push -u origin cursor/marble-phase2-3-quotations-jobs-invoices-3456
```

Then open a PR into `main` on `Marble_with_Nuage`.

## Better for the next run

Start a new Cursor cloud agent with **Marble_with_Nuage** selected as the
repository so the agent has push permission there directly.
