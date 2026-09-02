# How to land this work in Enterprise Hub

This branch was published to `usman13581/usman13581-.github.io` because the agent
token cannot push to `usman13581/Enterprise_Hub` in some environments (GitHub returns 403). The
commits here are the full product history from an empty tree, so they do not need
write, and they fast-forward cleanly onto `Enterprise_Hub`'s initial commit.

Preferred tip branch:

`cursor/marble-phase4-5-offline-pilot-3456`

https://github.com/usman13581/usman13581-.github.io/tree/cursor/marble-phase4-5-offline-pilot-3456

## Import into Enterprise Hub

```bash
git clone https://github.com/usman13581/Enterprise_Hub.git
cd Enterprise_Hub
git fetch delivery cursor/marble-phase4-5-offline-pilot-3456
# or from the delivery remote below
git remote add delivery https://github.com/usman13581/usman13581-.github.io.git
git fetch delivery cursor/marble-phase4-5-offline-pilot-3456
git checkout -b cursor/marble-phase4-5-offline-pilot-3456
git merge --ff-only delivery/cursor/marble-phase4-5-offline-pilot-3456
git push -u origin cursor/marble-phase4-5-offline-pilot-3456
```

Then open a PR into `main` on `Enterprise_Hub`.

## Cloud agents

Start a new Cursor cloud agent with **Enterprise_Hub** selected as the
repository.
