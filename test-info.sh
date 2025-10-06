#!/bin/bash
export NPM_AUTH_TOKEN=dummy
export NODE_ENV=test
export REFORGE_DOMAIN=goatsofreforge.com
yarn test test/commands/info.test.ts "$@"
