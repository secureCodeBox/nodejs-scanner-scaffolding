const SecureBoxWorker = require('./ScannerScaffolding');
const {
    fetchJob,
    submitResults,
    submitFailure,
} = require('./SecureCodeBoxApi');
const axios = require('axios');

jest.useFakeTimers();

jest.mock('./SecureCodeBoxApi');

beforeEach(() => {
    jest.clearAllTimers();

    fetchJob.mockReset();
    submitResults.mockReset();
    submitFailure.mockReset();

    fetchJob.mockImplementation(() =>
        Promise.resolve({
            jobId: 'foo-bar-uuid',
            targets: [
                {
                    attributes: {
                        NMAP_PARAMETER: '-O',
                    },
                    location: 'localhost',
                    name: 'Test Target',
                },
            ],
        })
    );
    submitResults.mockImplementation(() => Promise.resolve());
    submitFailure.mockImplementation(() => Promise.resolve());
});

it('doesnt call worker function when no task gets returned', async () => {
    const workerFn = jest.fn();

    fetchJob.mockImplementationOnce(() => Promise.resolve(null));

    new SecureBoxWorker(workerFn, {
        workername: 'nmap',
        topic: 'nmap_portscan',
    });

    jest.advanceTimersByTime(1000);

    expect(workerFn).not.toBeCalled();
});

it('calls worker function when api returns task', async () => {
    const workerFn = jest.fn(() => Promise.resolve({ result: [], raw: [] }));

    new SecureBoxWorker(workerFn, {
        workername: 'nmap',
        topic: 'nmap_portscan',
    });

    await jest.advanceTimersByTime(1500);
    await jest.runAllImmediates();
    await jest.runAllTicks();

    expect(workerFn).toBeCalledWith([
        {
            attributes: {
                NMAP_PARAMETER: '-O',
            },
            location: 'localhost',
            name: 'Test Target',
        },
    ]);
});

it('should return result back to the secureCodeBoxApi', async () => {
    const workerFn = jest.fn(() => ({ result: [], raw: [] }));

    new SecureBoxWorker(workerFn, {
        workername: 'nmap',
        topic: 'nmap_portscan',
    });

    await jest.advanceTimersByTime(1000);
    await jest.runAllImmediates();
    await jest.runAllTicks();
    await jest.runAllImmediates();
    await jest.runAllTicks();

    expect(submitResults).toBeCalled();
    expect(submitFailure).not.toBeCalled();
});

it('should submit an error if the work function throws', async () => {
    const workerFn = jest.fn(() => Promise.reject('Any Error Message'));

    new SecureBoxWorker(workerFn, {
        workername: 'nmap',
        topic: 'nmap_portscan',
    });

    await jest.advanceTimersByTime(1000);
    await jest.runAllImmediates();
    await jest.runAllTicks();
    await jest.runAllImmediates();
    await jest.runAllTicks();

    expect(submitFailure).toBeCalled();
    expect(submitResults).not.toBeCalled();
});

it('should submit an error if the result could not be submitted', async () => {
    const workerFn = jest.fn(() => ({ result: [], raw: [] }));

    submitResults.mockImplementationOnce(() =>
        Promise.reject('Could not reach API')
    );

    new SecureBoxWorker(workerFn, {
        workername: 'nmap',
        topic: 'nmap_portscan',
    });

    await jest.advanceTimersByTime(1000);
    await jest.runAllImmediates();
    await jest.runAllTicks();
    await jest.runAllImmediates();
    await jest.runAllTicks();

    expect(submitResults).toBeCalled();
    expect(submitFailure).toBeCalled();
});

it('should not crash if the submitFailure throws', async () => {
    const workerFn = jest.fn(() => ({ result: [], raw: [] }));

    submitResults.mockImplementationOnce(() =>
        Promise.reject('Could not reach API')
    );
    submitFailure.mockImplementationOnce(() =>
        Promise.reject('Could not reach API')
    );

    new SecureBoxWorker(workerFn, {
        workername: 'nmap',
        topic: 'nmap_portscan',
    });

    await jest.advanceTimersByTime(1000);
    await jest.runAllImmediates();
    await jest.runAllTicks();
    await jest.runAllImmediates();
    await jest.runAllTicks();

    expect(submitResults).toBeCalled();
    expect(submitFailure).toBeCalled();
});

describe('api', () => {
    let worker = null;

    beforeEach(async () => {
        worker = new SecureBoxWorker(() => {}, {
            workername: 'nmap',
            topic: 'nmap_portscan',
            testScannerFunctionality() {
                return { status: 'running' };
            },
        });

        await worker.startStatusServer(3005);
    });

    afterEach(async () => {
        await worker.stopStatusServer();
    });

    test('should provide output of test scanner function', async () => {
        console.log(worker.testScannerFunctionality());
        const { data } = await axios.get('http://localhost:3005/status');
        console.log(data);
        expect(data.scanner).toEqual({ status: 'running' });
    });
});
