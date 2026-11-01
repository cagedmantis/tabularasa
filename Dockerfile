# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e

# Reproducible build of the Tabularasa extension. The host needs only Docker;
# the Makefile wraps these targets:
#
#   docker build --target out --output type=local,dest=out .
#       -> out/tabularasa-<version>.zip, out/extension/, out/SHA256SUMS
#
# Every input is pinned, so the same commit gives the same zip on any
# machine: base images by digest, npm packages by the lockfile's integrity
# hashes, and the native TypeScript compiler by checksum. Dependabot moves
# the image digests and npm packages; the compiler is updated by hand (see
# the tsgo stages).
#
# The shipped JavaScript is compiled by the native (Go) TypeScript 7
# compiler. Node and npm only run the tests and the linter, which still need
# the TypeScript 6 JS API. Nothing from npm ships.

FROM node:26.12.0-bookworm-slim@sha256:742a0fe7320e09e0321222b68165e6ac731d30470e7ea7f98f9bfc3a6e1034fe AS node
FROM golang:1.27.3-bookworm@sha256:d9b6a1beb9474adc2a1ce842573639b44b2a0dd49b6669f51d3821baf9ec37c9 AS go

# --- npm toolchain: tests and lint only ---------------------------------------
FROM node AS deps
ENV npm_config_update_notifier=false
WORKDIR /src
# .npmrc disables dependency install scripts.
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund

# --- native TypeScript 7 compiler ---------------------------------------------
# Microsoft's release archives, checked against the same binaries published to
# npm as @typescript/typescript-linux-<arch>. To update: download both archives
# from https://github.com/microsoft/typescript-go/releases and replace the
# version and checksums (sha256sum typescript-linux-*.tgz).
FROM node AS tsgo-amd64
ADD --checksum=sha256:7ecad6f67377e831856367ab062ef394f21506a611405bf8ac0ff039348637d3 \
    https://github.com/microsoft/typescript-go/releases/download/typescript%2Fv7.0.2/typescript-linux-x64.tgz /tmp/tsgo.tgz

FROM node AS tsgo-arm64
ADD --checksum=sha256:c83d931ac9dd7549cde6e71246aa9d6a9812843023df3e277fe3b5dcf41dd0ea \
    https://github.com/microsoft/typescript-go/releases/download/typescript%2Fv7.0.2/typescript-linux-arm64.tgz /tmp/tsgo.tgz

FROM tsgo-${TARGETARCH} AS tsgo
RUN mkdir /opt/tsgo && tar -xzf /tmp/tsgo.tgz -C /opt/tsgo --strip-components=1

# --- sources (.dockerignore admits only what the build reads) ------------------
FROM deps AS source
COPY --from=tsgo /opt/tsgo /opt/tsgo
ENV PATH=/opt/tsgo/lib:/src/node_modules/.bin:$PATH
COPY . .

# The image the Makefile runs tests, lint and watch in.
FROM source AS dev

# --- compile what ships --------------------------------------------------------
FROM source AS compile
RUN tsc -p tsconfig.json

# --- tests (with the coverage floor) and lint ----------------------------------
FROM source AS check
RUN npm test && npm run lint && touch /checked

# --- packer: validates the manifest and writes a reproducible zip --------------
FROM go AS packer
ENV GOTOOLCHAIN=local CGO_ENABLED=0 GOFLAGS=-buildvcs=false
WORKDIR /tools
COPY tools/ ./
RUN test -z "$(gofmt -l .)" && go vet ./... && go test ./... \
    && go build -trimpath -o /usr/local/bin/pack ./pack

FROM compile AS manifest-check
COPY --from=packer /usr/local/bin/pack /usr/local/bin/pack
RUN pack -root /src -check

FROM compile AS package
# Packaging waits for the tests and the linter.
COPY --from=check /checked /checked
COPY --from=packer /usr/local/bin/pack /usr/local/bin/pack
RUN pack -root /src -out /out

# --- exported results (docker build --output) ----------------------------------
FROM scratch AS out
COPY --from=package /out/ /

FROM scratch AS dist
COPY --from=compile /src/dist/ /

FROM scratch AS coverage
COPY --from=check /src/tests/coverage/ /

# --- asset generators (icons, store screenshots) -------------------------------
# Not part of the extension build. Debian packages come from the snapshot the
# base image was built from, so they are pinned with it.
FROM debian:bookworm-slim@sha256:99c0b25c46d0214d5a2091092e7908907dcaecd6a962cde0ac700acee222b6f3 AS assets
RUN sed -i -n '/^# http:\/\/snapshot/{s/^# /URIs: /;p;n;d};p' /etc/apt/sources.list.d/debian.sources \
    && apt-get -o Acquire::Check-Valid-Until=false update \
    && apt-get install -y --no-install-recommends \
        python3 librsvg2-bin chromium fonts-dejavu-core fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*
ENV CHROME_EXTRA_FLAGS="--no-sandbox --disable-dev-shm-usage"
WORKDIR /work
