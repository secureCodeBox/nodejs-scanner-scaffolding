const Worker = require('./');

const worker = new Worker(
    async targets => {
        console.log('Targets', targets);
        return { raw: [], result: [] };
    },
    {
        engineAddress: 'http://localhost:8080',
        topic: 'nmap_portscan',
        workername: 'test',
        async testScannerFunctionality() {
            return { foo: 'bar' };
        },
    }
);

worker.startStatusServer();
