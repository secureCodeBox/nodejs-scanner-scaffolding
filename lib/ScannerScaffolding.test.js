const ScannerScaffolding = require('./ScannerScaffolding');
const MockTaskApi = require('./MockTaskApi');
const axios = require('axios');

let jobApiPort = 3779;
let healthcheckPort = 3244;

let taskApi, scaffolding;

afterEach(async () => {
  if (taskApi != null) {
    await taskApi.stopServer();
  }

  await scaffolding.stop();
  await scaffolding.stopStatusServer();
});

test('gets new jobs from api', async done => {
  expect.assertions(1);
  taskApi = new MockTaskApi();
  taskApi.addJob({ topic: 'foobar', targets: ['foobar'] });
  await taskApi.startServer(jobApiPort++);

  scaffolding = new ScannerScaffolding(
    async targets => {
      expect(targets).toEqual(['foobar']);

      return { result: [], raw: '' };
    },
    {
      engineAddress: taskApi.getConnectionString(),
      workerName: 'testWorker',
      topic: 'foobar',
      pollingInterval: 50,
    }
  );

  taskApi.on(taskApi.eventTypes.completed, done);
});

test('doesnt call worker function when there is no job', async done => {
  expect.assertions(1);
  taskApi = new MockTaskApi();

  await taskApi.startServer(jobApiPort++);

  const workFunction = jest.fn(() => {
    return { result: [], raw: '' };
  });

  scaffolding = new ScannerScaffolding(workFunction, {
    engineAddress: taskApi.getConnectionString(),
    workerName: 'testWorker',
    topic: 'foobar',
    pollingInterval: 50,
  });

  taskApi.on(taskApi.eventTypes.secondFetchAndLockCall, async () => {
    expect(workFunction).not.toBeCalled();
    done();
  });
});

test('calls failure api when a job throws an error', async done => {
  expect.assertions(1);
  taskApi = new MockTaskApi();
  taskApi.addJob({ topic: 'foobar', targets: ['foobar'] });

  await taskApi.startServer(jobApiPort++);

  scaffolding = new ScannerScaffolding(
    async () => {
      throw new Error('Super dooper Error');
    },
    {
      engineAddress: taskApi.getConnectionString(),
      workerName: 'testWorker',
      topic: 'foobar',
      pollingInterval: 50,
    }
  );

  taskApi.on(taskApi.eventTypes.failed, async () => {
    expect(taskApi.failedJobs.length).toBe(1);
    done();
  });
});

const sleep = timeInMs => {
  return new Promise(resolve => {
    setTimeout(resolve, timeInMs);
  });
};

test('healthcheck is positive if the engine is reachable and scanner test is successful', async () => {
  expect.assertions(2);
  taskApi = new MockTaskApi();
  await taskApi.startServer(jobApiPort++);

  scaffolding = new ScannerScaffolding(() => {}, {
    engineAddress: taskApi.getConnectionString(),
    workerName: 'testWorker',
    topic: 'foobar',
    pollingInterval: 50,
    async testScannerFunctionality() {
      return { testRun: 'successful' };
    },
  });

  await scaffolding.startStatusServer(healthcheckPort);

  // Await at least one fetch job iteration
  await sleep(100);

  const { data, status } = await axios.get(
    `http://localhost:${healthcheckPort++}/status`
  );

  expect(status).toBe(200);
  expect(data.healthcheck).toBe('UP');
});

test('healthcheck is positive if the engine is unreachable, but last connection is null', async () => {
  expect.assertions(3);

  scaffolding = new ScannerScaffolding(() => {}, {
    engineAddress: 'http://localhost:12344',
    workerName: 'testWorker',
    topic: 'foobar',
    pollingInterval: 50,
    async testScannerFunctionality() {
      return {
        testRun: 'successful',
      };
    },
  });

  await scaffolding.startStatusServer(healthcheckPort);

  // Await at least one fetch job iteration
  await sleep(100);

  const { data, status } = await axios.get(
    `http://localhost:${healthcheckPort++}/status`
  );
  expect(status).toBe(200);
  expect(data.engine.last_successful_connection).toBe(null);
  expect(data.healthcheck).toBe('UP');
});

test('healthcheck is negative if the scanner test is negative', async () => {
  expect.assertions(3);
  taskApi = new MockTaskApi();
  await taskApi.startServer(jobApiPort++);

  scaffolding = new ScannerScaffolding(() => {}, {
    engineAddress: taskApi.getConnectionString(),
    workerName: 'testWorker',
    topic: 'foobar',
    pollingInterval: 50,
    async testScannerFunctionality() {
      return { testRun: 'failed' };
    },
  });

  await scaffolding.startStatusServer(healthcheckPort);

  // Await at least one fetch job iteration
  await sleep(100);

  try {
    await axios.get(`http://localhost:${healthcheckPort++}/status`);
  } catch ({ response }) {
    expect(response.status).toBe(503);
    expect(response.data.scanner.test_run).toBe('failed');
    expect(response.data.healthcheck).toBe('DOWN');
  }
});

test('healthcheck is will never get a connection if the scanner is not configured to use basic-auth for a secured engine', async () => {
  expect.assertions(3);
  taskApi = new MockTaskApi();
  await taskApi.startServer(jobApiPort++, { secured: true });

  scaffolding = new ScannerScaffolding(() => {}, {
    engineAddress: taskApi.getConnectionString(),
    workerName: 'testWorker',
    topic: 'foobar',
    pollingInterval: 50,
    async testScannerFunctionality() {
      return { testRun: 'successful' };
    },
  });

  await scaffolding.startStatusServer(healthcheckPort);

  // Await at least one fetch job iteration
  await sleep(100);

  const { data, status } = await axios.get(
    `http://localhost:${healthcheckPort++}/status`
  );
  expect(status).toBe(200);
  expect(data.engine.last_successful_connection).toBe(null);
  expect(data.healthcheck).toBe('UP');
});

test('healthcheck is will be green even if the scanner has the wrong basic-auth creds, but last connection field is not present', async () => {
  expect.assertions(3);
  taskApi = new MockTaskApi();
  await taskApi.startServer(jobApiPort++, { secured: true });

  scaffolding = new ScannerScaffolding(() => {}, {
    engineAddress: taskApi.getConnectionString(),
    workerName: 'testWorker',
    topic: 'foobar',
    pollingInterval: 50,
    async testScannerFunctionality() {
      return { testRun: 'successful' };
    },
    basicAuthUser: 'test-user',
    basicAuthPassword: 'wrong-pass',
  });

  await scaffolding.startStatusServer(healthcheckPort);

  // Await at least one fetch job iteration
  await sleep(100);

  const { data, status } = await axios.get(
    `http://localhost:${healthcheckPort++}/status`
  );
  expect(status).toBe(200);
  expect(data.engine.last_successful_connection).toBe(null);
  expect(data.healthcheck).toBe('UP');
});

test('can connect to basicAuth protected engine api when configured with the right creds', async () => {
  expect.assertions(2);
  taskApi = new MockTaskApi();
  await taskApi.startServer(jobApiPort++, { secured: true });

  scaffolding = new ScannerScaffolding(() => {}, {
    engineAddress: taskApi.getConnectionString(),
    workerName: 'testWorker',
    topic: 'foobar',
    pollingInterval: 50,
    async testScannerFunctionality() {
      return { testRun: 'successful' };
    },
    basicAuthUser: 'test-user',
    basicAuthPassword: 'test-pass',
  });

  await scaffolding.startStatusServer(healthcheckPort);

  // Await at least one fetch job iteration
  await sleep(100);

  const { data, status } = await axios.get(
    `http://localhost:${healthcheckPort++}/status`
  );

  expect(status).toBe(200);
  expect(data.healthcheck).toBe('UP');
});

test('doesnt work on two jobs at the same time', async () => {
  taskApi = new MockTaskApi();
  taskApi.addJob({ topic: 'foobar', targets: ['foobar'] });
  taskApi.addJob({ topic: 'foobar', targets: ['foobar'] });
  await taskApi.startServer(jobApiPort++);

  const workerMock = jest.fn(async () => {
    await sleep(150);
    return { result: [], raw: '' };
  });

  scaffolding = new ScannerScaffolding(workerMock, {
    engineAddress: taskApi.getConnectionString(),
    workerName: 'testWorker',
    topic: 'foobar',
    pollingInterval: 30,
  });

  await sleep(60);

  expect(workerMock).toHaveBeenCalledTimes(1);

  await sleep(500);

  expect(workerMock).toHaveBeenCalledTimes(2);
});
