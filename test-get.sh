#!/bin/bash
export NPM_AUTH_TOKEN=dummy
export NODE_ENV=test
yarn test test/commands/get.test.ts "$@"
