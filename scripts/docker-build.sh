#!/usr/bin/env sh
# docker-build.sh — run the Node-dependent release steps (install, build, test,
# lint) inside a container, so the release host needs no Node/npm toolchain.
#
# The repository is bind-mounted into the container. The compiled dist/ is
# written back to the host (where it is packaged with `make zip-only`), while
# node_modules lives in a throwaway anonymous volume so it never lands on the
# host. Files written to the mount are owned by the invoking host user.
#
# Override the image with NODE_IMAGE, e.g. NODE_IMAGE=node:20-bookworm-slim.
set -eu

_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
. "$_dir/lib.sh"

require_cmd docker
cd "$(repo_root)"

IMAGE=${NODE_IMAGE:-node:22-bookworm-slim}

info "Running install/build/test/lint in container: $IMAGE"

# Design notes:
#   -v /app/node_modules : anonymous volume shadows the mount so the container's
#                          node_modules never touches the host (removed by --rm).
#   run as root          : lets npm populate the (root-owned) node_modules volume.
#   chown outputs        : dist/ and coverage are written to the bind mount, then
#                          handed back to the host user so the host owns them.
#                          (No-op on Docker Desktop, which virtualises ownership.)
#   the '; rc=$?; ...; exit $rc' pattern chowns on both success and failure while
#   preserving the real build exit status.
docker run --rm \
	-v "$(pwd):/app" \
	-v /app/node_modules \
	-w /app \
	-e HOST_UID="$(id -u)" \
	-e HOST_GID="$(id -g)" \
	"$IMAGE" \
	sh -uc 'npm ci --no-audit --no-fund && npm run build && npm test && npm run lint; rc=$?; chown -R "$HOST_UID:$HOST_GID" dist tests/coverage 2>/dev/null || true; exit $rc'

info "Container build complete — dist/ is ready on the host for packaging."
