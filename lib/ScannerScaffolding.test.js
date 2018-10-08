const ScannerScaffolding = require('./ScannerScaffolding');
const MockTaskApi = require('./MockTaskApi');

let jobApiPort = 3779;

let taskApi, scaffolding;

afterEach(async () => {
  await taskApi.stopServer();
  await scaffolding.stop();
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
