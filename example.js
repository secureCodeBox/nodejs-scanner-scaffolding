const SecureCodeBoxWorker = require('./lib/SecureCodeBoxWorker');

const secureCodeBoxWorker = new SecureCodeBoxWorker({
    engineAddress: 'http://docker/engine-rest',
    workername: 'nmap',
});

secureCodeBoxWorker.registerScanner(
    'nmap_portscan',
    ['nmap_target', 'nmap_parameter'],
    async ({ nmap_target, nmap_parameter }) => {
        // Perform Scan
        return {
            findings: [],
        };
    }
);
