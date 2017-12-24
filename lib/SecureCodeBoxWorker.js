const uuid = require('uuid/v4');
const Workers = require('camunda-worker-node');
const Backoff = require('camunda-worker-node/lib/backoff');
const express = require('express');

class SecureCodeBoxWorker {
    constructor({
        engineAddress = 'http://secureboxengine',
        workername = 'unnamed',
    } = {}) {
        this.startedAt = new Date();
        this.workerId = `securebox.${workername}.${uuid()}`;

        console.log(`Worker "${this.workerId}" started`);

        this.taskStatus = { started: 0, completed: 0, failed: 0 };

        if (!engineAddress) {
            throw new Error(
                'You must specify a proper URL for the Engine Address'
            );
        }
        this._engineAddress = engineAddress;
        this._workers = Workers(engineAddress, {
            workerId: this.workerId,
            use: [Backoff],
        });
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
            variables,
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
        return async function({ id, variables }, callback) {
            this.taskStatus.started++;
            console.log(`Started working on job "${id}"`);

            try {
                const result = await workerFunction(variables);
                callback(null, { variables: result });
                console.log(`Completed job "${id}"`);

                this.taskStatus.completed++;
            } catch (error) {
                callback(error);
                this.taskStatus.failed++;
                console.log(`Failed job "${id}"`);
            }
        };
    }
}

module.exports = SecureCodeBoxWorker;
