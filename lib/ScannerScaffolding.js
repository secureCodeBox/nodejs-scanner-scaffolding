const uuid = require('uuid/v4');
const express = require('express');
const defaults = require('lodash/defaults');
const SecureCodeBoxApi = require('./SecureCodeBoxApi');

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
      pollingInterval = POLLING_INTERVAL,
      basicAuthUser = process.env.ENGINE_BASIC_AUTH_USER,
      basicAuthPassword = process.env.ENGINE_BASIC_AUTH_PASSWORD,
    } = {}
  ) {
    this.requestOptions = {};

    if (basicAuthUser && basicAuthPassword) {
      this.requestOptions.auth = {
        username: basicAuthUser,
        password: basicAuthPassword,
      };
    }

    this.startedAt = new Date();
    this.workerId = uuid();
    this.engineAddress = process.env.ENGINE_ADDRESS || engineAddress;

    this.api = new SecureCodeBoxApi({
      engineAddress: this.engineAddress,
      scannerId: this.workerId,
      scannerType: workername,
      topicName: topic,
      requestOptions: this.requestOptions,
    });

    this.taskStatus = { started: 0, completed: 0, failed: 0 };

    this._worker = workerFunction;
    this._testScanner = testScannerFunctionality;
    this._pollingInterval = pollingInterval;

    this.logConfig();

    this._start();

    console.log(`Worker "${this.workerId}" started`);
  }

  async logConfig() {
    const { testRun, version } = await this.testScannerFunctionality();

    console.log();
    console.log('Worker Settings:');

    console.log(`Id: \t\t${this.workerId}`);
    console.log(`TopicName: \t${this.topicName}`);
    console.log(`WorkerName: \t${this.workername}`);
    console.log(`EngineAddress: \t${this.engineAddress}`);

    console.log();
    console.log('Scanner Status:');

    console.log('Test Run: \t', testRun);
    console.log('Version: \t', version);

    console.log();
    console.log('Build:');
    console.log(`Commit: \t${process.env['SCB_COMMIT_ID'] || 'unkown'}`);
    console.log(
      `Repository: \t${process.env['SCB_REPOSITORY_URL'] || 'unkown'}`
    );
    console.log(`Branch: \t${process.env['SCB_BRANCH'] || 'unkown'}`);
  }

  /**
   * Starts a small Server for Healtcheck and debugging purposes.
   * This provides to endpoint:
   *       '/' : Returns a small Text Message indicating that the service is running
   * '/status' : Returns a JSON Document containing information about service uptime, number of completet scans and a few other things.
   *
   * @param {number} port Port on which the status server should be run at.
   */
  startStatusServer(port = 8080) {
    const app = express();

    app.get('/', (req, res) => res.send(this.workerId));

    app.get('/status', async (req, res) => {
      const lastSuccessfulConnection = this.api.checkLastSuccessfulConnection();
      const { version, testRun } = await this.testScannerFunctionality();

      const isUp = testRun === 'successful';

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
          test_run: testRun,
        },
        build: {
          commit_id: process.env['SCB_COMMIT_ID'] || 'unkown',
          repository_url: process.env['SCB_REPOSITORY_URL'] || 'unkown',
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
    if (this._server === undefined) {
      return Promise.resolve();
    }
    return new Promise(resolve => this._server.close(resolve));
  }

  async testScannerFunctionality() {
    return defaults(await this._testScanner(), {
      testRun: 'unkown',
      version: 'unkown',
    });
  }

  _start() {
    this._timer = setInterval(this._tick.bind(this), this._pollingInterval);
  }

  stop() {
    clearInterval(this._timer);
  }

  async _tick() {
    const job = await this.api
      .fetchJob()
      .catch(() => console.warn('Could not reach secureCodeBox Engine API.'));

    if (job === null) return;
    try {
      console.info(`Started working on Job "${job.jobId}"`);
      const { result, raw } = await this._worker(job.targets);

      await this.api.submitResults(job.jobId, result, raw);
      console.info(`Finished Job "${job.jobId}"`);
    } catch (error) {
      console.error(`Failed to perform Job "${job.jobId}"`, error);

      await this.api.submitFailure(job.jobId, error).then(() => {
        console.log('Job Failure submitted succesfully.');
      });
    }
  }
}

module.exports = ScannerScaffolding;
