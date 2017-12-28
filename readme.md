# SecureCodeBox Worker

A wrapper to easily integrate new scanner into the secureCodeBox.

This bundles a few basic concernes every worker service should fullfill:

* Fetching and completing Tasks
* Healthcheck endpoints
* Error handeling

## Requirements

This libary is compatible with Node 8 and beyond.

## Instalation

`npm install @securecodebox/securecodebox-worker`

## Example

This example shows how this libary can be used:

```js
const SecureCodeBoxWorker = require('@securecodebox/securecodebox-worker');

const secureCodeBoxWorker = new SecureCodeBoxWorker({
    engineAddress: 'http://secureboxengine/engine-rest',
    // Used to generate the worker id. This Example would look something like this: securebox.portscan.60a6ac0c-4e26-40ea-908e-598e9c807887
    workername: 'portscan',
});

secureCodeBoxWorker.registerScanner(
    // Name of the External Task specified in the Engine
    'portscan',
    // Array of Process Variables which should be fetched
    ['target'],
    // Callback function which will be called when a new scan should be performed
    async ({ target }) => {
        const findings = await performScan(target);

        return {
            findings, // Attributes of this Object will be saved as process variables
        };
    }
);

/**
 * Starts a small server with two endpoints:
 *
 *       "/" basic endpoint for healthchecks returns the worker id as a string
 * "/status" returns a json object containing basic information about this worker
 */
secureCodeBoxWorker.startStatusServer();
```

## Handeling Errors

In case of a scan failure you can throw Errors from the registerScanner Callback function. The Error message will be submitted back to the engine.

```js
secureCodeBoxWorker.registerScanner(
    'nmap_portscan',
    ['nmap_target', 'nmap_parameter'],
    async ({ nmap_target, nmap_parameter }) => {
        // Thrown Errors will be submitted as incidents to theprocess engine.
        throw new Error('Something went wrong...');
    }
);
```

## Special Thanks

Most of this functionality of thos package comes from the awesome `camunda-worker-node` package.
