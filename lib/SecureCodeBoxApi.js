const isString = require('lodash/isString');
const axios = require('axios');

let lastSuccessfulConnection = null;

function updateEngineConnectionDate(arg) {
    lastSuccessfulConnection = Date.now();
    return arg;
}
function fetchJob(engineAddress, topicName, scannerId) {
    return axios
        .post(`${engineAddress}/box/jobs/lock/${topicName}/${scannerId}`)
        .then(updateEngineConnectionDate)
        .then(({ status, data }) => {
            if (status === 204) return null;
            return data;
        })
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
        .post(`${engineAddress}/box/jobs/${jobId}/result`, {
            findings,
            rawFindings: JSON.stringify(raw),
            scannerId,
            scannerType,
        })
        .then(updateEngineConnectionDate)
        .then(({ data }) => data)
        .catch(() => {
            console.error(
                `Failed to submit result to secureCodeBox API but was unable to reach it. Job with id: "${jobId}" will not be able to be completed.`
            );
        });
}

function submitFailure(engineAddress, scannerId, scannerType, jobId, error) {
    if (isString(error)) {
        error = new Error(error);
    }

    return axios
        .post(`${engineAddress}/box/jobs/${jobId}/failure`, {
            errorDetails: error.message,
            errorMessage: error.name,
            scannerId,
        })
        .then(updateEngineConnectionDate)
        .then(({ data }) => data)
        .catch(() => {
            console.error(
                `Tried submitting an error to secureCodeBox API but was unable to reach it. Job with id: "${jobId}" will not be able to be completed or failed.`
            );
        });
}

module.exports = {
    fetchJob,
    submitResults,
    submitFailure,
    checkLastSuccessfulConnection() {
        return lastSuccessfulConnection;
    },
};
