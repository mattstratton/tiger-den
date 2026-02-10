#!/usr/bin/env bash
# Skip SSL cert validation for local dev (Tiger Cloud cert chain issue)
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev
