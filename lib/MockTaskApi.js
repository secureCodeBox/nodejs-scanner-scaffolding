const EventEmitter = require('events');
const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('uuid/v4');
const pullAt = require('lodash/pullAt');

class MockTaskApi extends EventEmitter {
  constructor() {
    super();
    this._server = null;
    this.openJobs = [];
    this.completedJobs = [];
    this.failedJobs = [];

    this.eventTypes = {
      completed: Symbol('completed'),
      failed: Symbol('failed'),
      fetchAndLockCall: Symbol('fetchAndLockCall'),
      secondFetchAndLockCall: Symbol('secondFetchAndLockCall'),
    };
    this.fetchAndLockCallCount = 0;
  }

  /**
   * @param {number} port Port on which the status server should be run at.
   */
  startServer(port = 8080) {
    const app = express();

    app.post(
      '/box/jobs/lock/:topic/:scannerId',
      this.fetchAndLockHandler.bind(this)
    );

    app.post(
      '/box/jobs/:id/failure',
      bodyParser.json(),
      this.failureHandler.bind(this)
    );

    app.post(
      '/box/jobs/:id/result',
      bodyParser.json(),
      this.successHandler.bind(this)
    );

    return new Promise((resolve, reject) => {
      this._server = app.listen(port, err => {
        if (err) reject(err);
        resolve();
      });
    });
  }

  stopServer() {
    return new Promise(resolve => this._server.close(resolve));
  }

  addJob({ topic, targets, jobId = uuid() }) {
    this.openJobs.push({
      jobId,
      topic,
      targets,
    });
  }

  /**
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  fetchAndLockHandler(req, res) {
    this.emit(this.eventTypes.fetchAndLockCall);
    this.fetchAndLockCallCount++;
    if (this.fetchAndLockCallCount === 2) {
      this.emit(this.eventTypes.secondFetchAndLockCall);
    }

    const topic = req.params.topic;

    const jobIndex = this.openJobs.findIndex(job => {
      return job.topic === topic;
    });

    const [job] = pullAt(this.openJobs, [jobIndex]);

    if (job) {
      res.status(200).send(job);
      return;
    }
    res.status(204).send();
  }

  /**
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  failureHandler(req, res) {
    this.failedJobs.push({
      jobId: req.params.id,
      body: req.body,
    });
    this.emit(this.eventTypes.failed);
    res.status(200).send();
  }

  /**
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  successHandler(req, res) {
    this.completedJobs.push({
      jobId: req.params.id,
      body: req.body,
    });
    this.emit(this.eventTypes.completed);
    res.status(200).send();
  }

  getConnectionString() {
    return `http://localhost:${this._server.address().port}`;
  }
}

module.exports = MockTaskApi;
