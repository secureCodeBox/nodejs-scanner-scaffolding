const SecureBoxWorker = require('./SecureCodeBoxWorker');

jest.mock('camunda-worker-node');

describe('SecureBoxWorker', () => {
    test('constructor should enforce a string typed engine url', () => {
        expect(() => {
            new SecureBoxWorker({
                engineAddress: 1,
                workername: 'test',
            });
        }).toThrow('You must specify a proper URL for the Engine Address!');
    });

    test('engine address can be specified by env variable', () => {
        process.env.ENGINE_ADDRESS = 'http://something';
        const worker = new SecureBoxWorker({
            workername: 'test',
        });

        expect(worker._engineAddress).toBe('http://something');

        delete process.env.ENGINE_ADDRESS;
    });

    test('engine address can be specified by constructor argument', () => {
        const worker = new SecureBoxWorker({
            engineAddress: 'http://argument-test/',
            workername: 'test',
        });

        expect(worker._engineAddress).toBe('http://argument-test/');
    });

    test('constructor should enforce that a workername is specified', () => {
        expect(() => {
            new SecureBoxWorker({ engineAddress: 'http://something' });
        }).toThrow(
            'You must specify a name for the worker as a constructor argument of SecureCodeBoxWorker Class!'
        );
    });
});
