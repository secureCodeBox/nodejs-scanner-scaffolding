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

    test('constructor should enforce that a workername is specified', () => {
        expect(() => {
            new SecureBoxWorker({ engineAddress: 'http://something' });
        }).toThrow(
            'You must specify a name for the worker as a constructor argument of SecureCodeBoxWorker Class!'
        );
    });
});
