const uuid = require('uuid/v4');
const express = require('express');
const {
    fetchJob,
    submitResults,
    submitFailure,
} = require('./SecureCodeBoxApi');

const POLLING_INTERVAL = 1000;
/**
 * secureCodeBox Scanner Scaffolding
 */
class ScannerScaffolding {
    /**
     * constructor
     *
     * @param {function} workerFunction Async function which takes in targets and returns an object with two attributes: results and raw
     * @param {object} options
     */
    constructor(
        workerFunction,
        { engineAddress = 'http://securebox:8080', workername, topic } = {}
    ) {
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
        this.workerId = uuid();
        this.engineAddress = process.env.ENGINE_ADDRESS || engineAddress;
        this.topicName = topic;
        this.workername = workername;

        this.taskStatus = { started: 0, completed: 0, failed: 0 };

        this._worker = workerFunction;

        this._start();

        console.log(`Worker "${this.workerId}" started`);
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

    _start() {
        setInterval(this._tick.bind(this), POLLING_INTERVAL);
    }

    async _tick() {
        const job = await fetchJob(
            this.engineAddress,
            this.topicName,
            this.workerId
        ).catch(() =>
            console.warn('Could not reach secureCodeBox Engine API.')
        );

        if (job === null) return;
        try {
            console.info(`Started working on Job "${job.jobId}"`);
            const { result, raw } = await this._worker(job.targets);

            await submitResults(
                this.engineAddress,
                this.workerId,
                this.workername,
                job.jobId,
                result,
                raw
            );
            console.info(`Finished Job "${job.jobId}"`);
        } catch (error) {
            console.error(`Failed to perform Job "${job.jobId}"`, error);

            await submitFailure(
                this.engineAddress,
                this.workerId,
                this.workername,
                job.jobId,
                error
            ).catch(() =>
                console.error(
                    `Tried submitting an error to secureCodeBox API but was unable to reach it. Job with id: "${
                        job.jobId
                    }" will not be able to be completed or failed. `
                )
            );
        }
    }
}

module.exports = ScannerScaffolding;
