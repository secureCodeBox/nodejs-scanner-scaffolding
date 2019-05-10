[![Build Status](https://travis-ci.com/secureCodeBox/nodejs-scanner-scaffolding.svg?branch=develop)](https://travis-ci.com/secureCodeBox/nodejs-scanner-scaffolding)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Known Vulnerabilities](https://snyk.io/test/github/secureCodeBox/nodejs-scanner-scaffolding/badge.svg)](https://snyk.io/test/github/secureCodeBox/nodejs-scanner-scaffolding)

# SecureCodeBox Scanner Scaffolding

A wrapper to easily integrate new scanner into the secureCodeBox.

This bundles a few basic concernes every worker service should fullfill:

*   Fetching and completing Tasks
*   Healthcheck endpoints
*   Error handeling

## Requirements

This libary is compatible with Node 8 and beyond.

## Instalation

`npm install @securecodebox/scanner-scaffolding`

## Example

This example shows how this libary can be used:

```js
const SecureCodeBoxScannerScaffolding = require('@securecodebox/scanner-scaffolding');

const worker = new SecureCodeBoxScannerScaffolding(
    // Callback function which will be called when a new scan should be performed
    async targets => {
        return { raw: [], result: [] };
    },
    {
        engineAddress: 'http://localhost:8080',
        // Name of the External Task specified in the Engine
        topic: 'nmap_portscan',
        // Used to generate the worker id. This Example would look something like this: securebox.portscan.60a6ac0c-4e26-40ea-908e-598e9c807887
        workername: 'portscan',
        // Used in the status page and logged on startup to check if the connection to the scanner is successful
        // Needs to return a object with to attribtues version and testRun
        async testScannerFunctionality() {
            return { version: '1.5.3', testRun: 'successful' };
        },
    }
);
/**
 * Starts a small server with two endpoints:
 *
 *       "/" basic endpoint for healthchecks returns the worker id as a string
 * "/status" returns a json object containing basic information about this worker
 */
worker.startStatusServer();
```

## Handeling Errors

In case of a scan failure you can throw Errors from the Callback function. The Error message will be submitted back to the engine.
