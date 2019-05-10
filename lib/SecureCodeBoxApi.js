const isString = require('lodash/isString');
const axios = require('axios');

class SecureCodeBoxApi {
  constructor({
    engineAddress,
    topicName,
    scannerId,
    scannerType,
    requestOptions,
  }) {
    this.lastSuccessfulConnection = null;

    this.engineAddress = engineAddress;
    this.topicName = topicName;
    this.scannerId = scannerId;
    this.scannerType = scannerType;
    this.requestOptions = requestOptions;
  }

  updateEngineConnectionDate(arg) {
    this.lastSuccessfulConnection = Date.now();
    return arg;
  }

  fetchJob() {
    return axios
      .post(
        `${this.engineAddress}/box/jobs/lock/${this.topicName}/${
          this.scannerId
        }`,
        {},
        this.requestOptions
      )
      .then(this.updateEngineConnectionDate.bind(this))
      .then(({ status, data }) => {
        if (status === 204) return null;
        return data;
      })
      .catch(error => {
        console.log('Error while trying to fetch jobs from engine: ' + error);
        return null;
      });
  }

  submitResults(jobId, findings, raw) {
    return axios
      .post(
        `${this.engineAddress}/box/jobs/${jobId}/result`,
        {
          findings,
          rawFindings: JSON.stringify(raw),
          scannerId: this.scannerId,
          scannerType: this.scannerType,
        },
        this.requestOptions
      )
      .then(this.updateEngineConnectionDate.bind(this))
      .then(({ data }) => data)
      .catch(() => {
        console.error(
          `Failed to submit result to secureCodeBox API but was unable to reach it. Job with id: "${jobId}" will not be able to be completed.`
        );
      });
  }

  submitFailure(jobId, error) {
    if (isString(error)) {
      error = new Error(error);
    }

    return axios
      .post(
        `${this.engineAddress}/box/jobs/${jobId}/failure`,
        {
          errorDetails: error.message,
          errorMessage: error.name,
          scannerId: this.scannerId,
        },
        this.requestOptions
      )
      .then(this.updateEngineConnectionDate.bind(this))
      .then(({ data }) => data)
      .catch(() => {
        console.error(
          `Tried submitting an error to secureCodeBox API but was unable to reach it. Job with id: "${jobId}" will not be able to be completed or failed.`
        );
      });
  }

  checkLastSuccessfulConnection() {
    return this.lastSuccessfulConnection;
  }
}

module.exports = SecureCodeBoxApi;
