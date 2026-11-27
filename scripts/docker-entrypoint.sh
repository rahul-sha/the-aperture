#!/bin/sh
# Starts the sync as the limited "node" user instead of root.
# Older versions ran as root, so the saved sync memory in /state may belong to
# root. While still root, hand that folder to "node", then drop to "node" for
# the sync itself. If the container is already started as a limited user,
# nothing changes.
set -e
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${SYNC_STATE_DIR:-/state}"
  chown -R node:node "${SYNC_STATE_DIR:-/state}"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
