const SNI = process.env.SNI || 'www.apple.com';
const SERVER_PORT = process.env.SERVER_PORT || process.env.PORT || 8080;
const NEZHA_SERVER = process.env.NEZHA_SERVER || 'nz.seav.eu.org';
const NEZHA_PORT = process.env.NEZHA_PORT || '443';
const NEZHA_KEY = process.env.NEZHA_KEY || 'sRPLrnnjzfUavoRpkV';

const http = require('http');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const crypto = require('crypto');
const os = require('os');
const axios = require('axios');
const subtxt = './app/url.txt';
const HTTP_PORT = process.env.HTTP_PORT || 3000;

const fileUrls = {
    arm: [
        { url: "https://github.com/eooce/test/releases/download/arm64/xray", filename: "web" },
        { url: "https://github.com/eooce/test/releases/download/ARM/swith", filename: "npm" }
    ],
    amd64: [
        { url: "https://github.com/eooce/test/releases/download/amd64/xray", filename: "web" },
        { url: "https://github.com/eooce/test/releases/download/bulid/swith", filename: "npm" }
    ]
};

const generateUUID = () => [4, 2, 2, 2, 6].map(n => crypto.randomBytes(n).toString('hex')).join('-');

async function downloadFile(url, dest) {
    const writer = fs.createWriteStream(dest);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', () => {
            fs.chmodSync(dest, 0o755);
            resolve();
        });
        writer.on('error', reject);
    });
}

async function getExternalIP() {
    try {
        const response = await axios.get('https://ipv4.icanhazip.com');
        return response.data.trim();
    } catch (error) {
        console.error('Error fetching IP:', error);
        throw error;
    }
}

async function getISPInfo() {
    try {
        const response = await axios.get('https://speed.cloudflare.com/meta');
        const data = response.data;
        const ispInfo = data.split('"')
            .filter((_, i) => [25, 17].includes(i))
            .join('-')
            .replace(/ /g, '_');
        return ispInfo;
    } catch (error) {
        console.error('Error fetching ISP info:', error);
        throw error;
    }
}

async function runStartup() {
    const UUID = generateUUID();
    const arch = os.arch();
    const fileInfo = fileUrls[arch] || fileUrls.amd64; // default to amd64 if unsupported arch

    for (const { url, filename } of fileInfo) {
        const filePath = `./${filename}`;
        if (!fs.existsSync(filePath)) {
            await downloadFile(url, filePath);
        } else {
            fs.chmodSync(filePath, 0o755);
        }
    }

    const x25519Key = execSync(`./web x25519`).toString();
    const [privateKey, publicKey] = x25519Key.trim().split('\n').map(line => line.split(' ')[2]);
    const shortid = crypto.randomBytes(8).toString('hex');

    const config = {
        inbounds: [
            {
                port: SERVER_PORT,
                protocol: 'vless',
                settings: { clients: [{ id: UUID, flow: 'xtls-rprx-vision' }], decryption: 'none' },
                streamSettings: {
                    network: 'tcp',
                    security: 'reality',
                    realitySettings: {
                        show: false,
                        dest: '1.1.1.1:443',
                        xver: 0,
                        serverNames: [SNI],
                        privateKey,
                        shortIds: [shortid]
                    }
                }
            }
        ],
        outbounds: [{ protocol: 'freedom', tag: 'direct' }, { protocol: 'blackhole', tag: 'blocked' }]
    };

    fs.writeFileSync('config.json', JSON.stringify(config, null, 2));

    const tlsPorts = ["443", "8443", "2096", "2087", "2083", "2053"];
    const NEZHA_TLS = tlsPorts.includes(NEZHA_PORT) ? "--tls" : "";
    if (NEZHA_SERVER && NEZHA_PORT && NEZHA_KEY) {
        exec(`./npm -s ${NEZHA_SERVER}:${NEZHA_PORT} -p ${NEZHA_KEY} ${NEZHA_TLS}`, (err) => {
            if (err) console.error(err);
        });
    }

    exec(`./web -c config.json`, (err) => {
        if (err) console.error(err);
    });

    const IP = await getExternalIP();
    const ISP = await getISPInfo();

    const list = `vless://${UUID}@${IP}:${SERVER_PORT}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=${SNI}&fp=chrome&pbk=${publicKey}&sid=${shortid}&type=tcp&headerType=none#${ISP}`;
    fs.writeFileSync('list.txt', list);

    // Display the result on the console
    console.log(list);
}

// Run the startup script
runStartup().catch(err => console.error(err));

// Create HTTP server
const server = http.createServer((req, res) => {
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Hello world!');
    } else if (req.url === '/sub') {
        fs.readFile(subtxt, 'utf8', (err, data) => {
            if (err) {
                console.error(err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Error reading url.txt' }));
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(data);
            }
        });
    }
});

server.listen(HTTP_PORT, () => {
    console.log(`Server is running on port ${HTTP_PORT}`);
});
