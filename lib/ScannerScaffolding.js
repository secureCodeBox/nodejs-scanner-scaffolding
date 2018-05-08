const uuid = require('uuid/v4');
const express = require('express');
const {
    fetchJob,
    submitResults,
    submitFailure,
    checkLastSuccessfulConnection,
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
        {
            engineAddress = 'http://securebox:8080',
            workername,
            topic,
            testScannerFunctionality = () => null,
        } = {}
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
        this._testScanner = testScannerFunctionality;

        this.logConfig();

        this._start();

        console.log(`Worker "${this.workerId}" started`);
    }

    async logConfig() {
        const scannerStatus = await this.testScannerFunctionality();
        console.group('Worker Settings:');
        console.log(`WorkerId: ${this.workerId}`);
        console.log(`TopicName: ${this.topicName}`);
        console.log(`WorkerName: ${this.workername}`);
        console.log(`EngineAddress: ${this.engineAddress}`);
        console.log('Scanner Status:', scannerStatus);
        console.log(`Commit ID: ${process.env['SCB_COMMIT_ID'] || 'unkown'}`);
        console.log(
            `Repository URL: ${process.env['SCB_REPOSITORY_URL'] || 'unkown'}`
        );
        console.log(`Branch: ${process.env['SCB_BRANCH'] || 'unkown'}`);

        console.groupEnd('Worker Settings:');
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

        app.get('/status', async (req, res) => {
            const lastSuccessfulConnection = checkLastSuccessfulConnection();
            const {
                version = 'unkown',
                testRun = 'unkown',
            } = await this.testScannerFunctionality();

            const isUp =
                lastSuccessfulConnection !== null && testRun === 'successful';

            res.status(isUp ? 200 : 503).send({
                started_at: this.startedAt.toISOString(),
                worker_id: this.workerId,
                healthcheck: isUp ? 'UP' : 'DOWN',
                status: this.taskStatus,
                engine: {
                    last_successful_connection: lastSuccessfulConnection,
                },
                scanner: {
                    version,
                    testRun,
                },
                build: {
                    commit_id: process.env['SCB_COMMIT_ID'] || 'unkown',
                    repository_url:
                        process.env['SCB_REPOSITORY_URL'] || 'unkown',
                    branch: process.env['SCB_BRANCH'] || 'unkown',
                },
            });
        });

        return new Promise((resolve, reject) => {
            this._server = app.listen(port, err => {
                if (err) reject(err);
                console.log(`Started status server at port ${port}`);
                resolve();
            });
        });
    }

    stopStatusServer() {
        return new Promise(resolve => this._server.close(resolve));
    }

    async testScannerFunctionality() {
        return await this._testScanner();
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
