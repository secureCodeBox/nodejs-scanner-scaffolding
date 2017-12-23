const SecureBoxWorker = require('./SecureCodeBoxWorker');

describe('SecureBoxWorker', () => {
    test('registerScanner should call the registerWorker function of the underlying camunda-worker-node module.', () => {
        const workFunction = jest.fn();
        const worker = new SecureBoxWorker(undefined, {
            registerWorker: workFunction,
        });

        worker.registerScanner('foo', ['bar'], () => {});

        expect(workFunction).toHaveBeenCalledTimes(1);

        const [firstCall] = workFunction.mock.calls;

        expect(firstCall).toContain('foo');
        expect(firstCall).toContainEqual(['bar']);

        // This is a workaround assertion as it is hard to assert that the callback workfunction mathes the assertion value
    });
});
