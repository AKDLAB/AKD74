#!/bin/bash
# Daily Google Scholar refresh of the website, run on the Mac by launchd
# (~/Library/LaunchAgents/com.akdlab.scholar-update.plist): every day at 9:00,
# and whenever the SSD is plugged in. (The file keeps its old name so the
# launcher script keeps finding it.) At most one update every 12 hours
# unless run with --now. launchd starts it through the small app
# ~/Applications/MMST Scholar Update.app, because macOS lets an app, not a
# bare script, be allowed to read the external SSD. It runs on the Mac, not GitHub Actions, because
# Google Scholar refuses GitHub's servers (HTTP 403).
set -u
cd "$(dirname "$0")/.." || exit 1
STAMP=.git/scholar-last-update
if [ "${1:-}" != "--now" ] && [ -f "$STAMP" ] && [ -z "$(find "$STAMP" -mmin +720 2>/dev/null)" ]; then
  exit 0   # updated within the last 12 hours
fi
echo "=== $(date '+%Y-%m-%d %H:%M')"
git pull --rebase --autostash -q origin main || { echo "git pull failed"; exit 1; }
/usr/bin/python3 tools/update_scholar.py || exit $?
if git diff --quiet -- publications.html people.html; then
  echo "Nothing new on Google Scholar."
else
  git add publications.html people.html
  git -c user.name="Abhijeet" -c user.email="abhijeetvas@gmail.com" \
    commit -q -m "Update citations and publications from Google Scholar" -- publications.html people.html
  git push -q origin main && echo "Published." || { echo "git push failed"; exit 1; }
fi
touch "$STAMP"
