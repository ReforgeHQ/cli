#!/bin/bash
export NPM_AUTH_TOKEN=dummy
export NODE_ENV=test
export REFORGE_INTEGRATION_TEST_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
yarn test test/commands/set-default.test.ts "$@"
