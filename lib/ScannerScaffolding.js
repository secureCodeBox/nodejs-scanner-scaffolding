const uuid = require('uuid/v4');
const Workers = require('camunda-worker-node');
const Backoff = require('camunda-worker-node/lib/backoff');
const express = require('express');

class ScannerScaffolding {
    constructor({ engineAddress = 'http://securebox/rest', workername } = {}) {
        if (typeof engineAddress !== 'string' && !process.env.ENGINE_ADDRESS) {
            throw new Error(
                'You must specify a proper URL for the Engine Address!'
            );
        }

        if (!(workername && typeof workername === 'string')) {
            throw new Error(
                'You must specify a name for the worker as a constructor argument of SecureCodeBoxWorker Class!'
            );
        }

        const requestOptions = {};

        if (
            process.env.ENGINE_BASIC_AUTH_USER &&
            process.env.ENGINE_BASIC_AUTH_PASSWORD
        ) {
            requestOptions.auth = {
                user: process.env.ENGINE_BASIC_AUTH_USER,
                pass: process.env.ENGINE_BASIC_AUTH_PASSWORD,
            };
        }

        this.startedAt = new Date();
        this.workerId = `securebox.${workername}.${uuid()}`;
        this.workername = workername;

        this.taskStatus = { started: 0, completed: 0, failed: 0 };

        this._engineAddress = process.env.ENGINE_ADDRESS
            ? process.env.ENGINE_ADDRESS
            : engineAddress;

        this._workers = Workers(this._engineAddress, {
            workerId: this.workerId,
            use: [Backoff],
            requestOptions,
        });

        console.log(`Worker "${this.workerId}" started`);
    }

    /**
     * Use this function to register a new Scanner for the secureCodeBox
     *
     * @param {string} topicName Topic Name of the external Task in your BPMN Model.
     * @param {array<string>} variables Array of variables from your Camunda Process which you need to perform the scan. E.g. the address of the scan target.
     * @param {function} callback Function in which you should perform the scan. This should return a Promise with the resuts of the scan
     */
    registerScanner(topicName, variables, callback) {
        this._workers.registerWorker(
            topicName,
            {
                lockDuration: 12 * 60 * 60 * 1000, // 12 h
                variables,
            },
            this._workFunctionWrapper(callback).bind(this)
        );
    }

    /**
     * Starts a small Server for Healtcheck and debugging purposes.
     * This provides to endpoint:
     *       '/' : Returns a small Text Message indicating that the service is running
     * '/status' : Returns a JSON Document containing information about service uptime, number of completet scans and a few other things.
     *
     * @param {number} port Port on which the status server should be run at.
     */
    startStatusServer(port = 3000) {
        const app = express();

        app.get('/', (req, res) => res.send(this.workerId));

        app.get('/status', (req, res) =>
            res.send({
                startedAt: this.startedAt.toISOString(),
                workerId: this.workerId,
                status: this.taskStatus,
            })
        );

        app.listen(port, () =>
            console.log(`Started status server at port ${port}`)
        );
    }

    _workFunctionWrapper(workerFunction) {
        return async function(context) {
            this.taskStatus.started++;
            console.log(`Started working on job "${context.id}"`);

            try {
                const result = await workerFunction(context.variables);

                console.log(`Completed job "${context.id}"`);
                this.taskStatus.completed++;
                return {
                    variables: {
                        PROCESS_SCANNER_ID: this.workername,
                        PROCESS_SCANNER_TYPE: this.workerId,
                        ...result,
                    },
                };
            } catch (error) {
                this.taskStatus.failed++;
                console.log(`Failed job "${context.id}"`);
                throw error;
            }
        };
    }
}

module.exports = ScannerScaffolding;
