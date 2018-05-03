const isString = require('lodash/isString');
const axios = require('axios');

function fetchJob(engineAddress, topicName, scannerId) {
    return axios
        .post(`${engineAddress}/box/jobs/lock/${topicName}/${scannerId}`)
        .then(({ data }) => data)
        .catch(() => null);
}

function submitResults(
    engineAddress,
    scannerId,
    scannerType,
    jobId,
    findings,
    raw
) {
    return axios
        .post(`/box/jobs/${jobId}/result`, {
            findings,
            rawFindings: JSON.stringify(raw),
            scannerId,
            scannerType,
        })
        .then(({ data }) => data)
        .catch(() => null);
}

function submitFailure(engineAddress, scannerId, scannerType, jobId, error) {
    if (isString(error)) {
        error = new Error(error);
    }

    return axios
        .post(`/box/jobs/${jobId}/failure`, {
            errorDetails: error.message,
            errorMessage: error.name,
            scannerId,
        })
        .then(({ data }) => data)
        .catch(() => null);
}

module.exports = {
    fetchJob,
    submitResults,
    submitFailure,
};
