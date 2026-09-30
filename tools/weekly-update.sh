#!/bin/bash
# Weekly Google Scholar refresh of the website, run on the Mac by launchd
# (~/Library/LaunchAgents/com.akdlab.scholar-update.plist). It runs on the Mac,
# not GitHub Actions, because Google Scholar refuses GitHub's servers (HTTP 403).
# Works in its own copy of the repository, so the external SSD needn't be plugged in.
set -u
cd "$(dirname "$0")/.." || exit 1
echo "=== $(date '+%Y-%m-%d %H:%M')"
git pull --rebase -q origin main || { echo "git pull failed"; exit 1; }
/usr/bin/python3 tools/update_scholar.py || exit $?
if git diff --quiet -- publications.html people.html; then
  echo "Nothing new on Google Scholar."
  exit 0
fi
git add publications.html people.html
git -c user.name="Abhijeet" -c user.email="abhijeetvas@gmail.com" \
  commit -q -m "Update citations and publications from Google Scholar"
git push -q origin main && echo "Published."
