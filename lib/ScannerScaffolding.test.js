const ScannerScaffolding = require('./ScannerScaffolding');
const MockTaskApi = require('./MockTaskApi');

let jobApiPort = 3779;

test('gets new jobs from api', async done => {
  expect.assertions(1);
  const taskApi = new MockTaskApi();
  taskApi.addJob({ topic: 'foobar', targets: ['foobar'] });
  await taskApi.startServer(jobApiPort++);

  const scaffolding = new ScannerScaffolding(
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

  taskApi.on(taskApi.eventTypes.completed, async () => {
    await taskApi.stopServer();
    await scaffolding.stop();
    done();
  });
});

test('doesnt call worker function when there is no job', async done => {
  expect.assertions(1);
  const taskApi = new MockTaskApi();

  await taskApi.startServer(jobApiPort++);

  const workFunction = jest.fn(() => {
    return { result: [], raw: '' };
  });

  const scaffolding = new ScannerScaffolding(workFunction, {
    engineAddress: taskApi.getConnectionString(),
    workerName: 'testWorker',
    topic: 'foobar',
    pollingInterval: 50,
  });

  taskApi.on(taskApi.eventTypes.secondFetchAndLockCall, async () => {
    await taskApi.stopServer();
    await scaffolding.stop();

    expect(workFunction).not.toBeCalled();
    done();
  });
});

test('calls failure api when a job throws an error', async done => {
  expect.assertions(1);
  const taskApi = new MockTaskApi();
  taskApi.addJob({ topic: 'foobar', targets: ['foobar'] });

  await taskApi.startServer(jobApiPort++);

  const scaffolding = new ScannerScaffolding(
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
    await taskApi.stopServer();
    await scaffolding.stop();

    expect(taskApi.failedJobs.length).toBe(1);
    done();
  });
});
