const request = require("request-promise");
const cheerio = require("cheerio");
let jar = request.jar();
if (process.argv.length < 6) {
    console.error("Not enough args");
    console.error("Usage: node index.js mydomain.com 123456789 mail@email.com MyPassword123");
    process.exit(1);
}

let domain = (process.argv[2]) ? process.argv[2].split(',') : [];
let domainId = (process.argv[3]) ? process.argv[3].split(',') : [];
let username = process.argv[4];
let password = process.argv[5];
let frecuency = process.argv[6] || 60000;

let domains = domain.map((e, i) => {
    return { domain: domain[i], domainId: domainId[i] }
});

console.log({
    domains: domains,
    username: username,
    password: (password) ? '********' : null
});

let token, lastIp;

function parseTableRows(rows) {
    let objectArray = [];
    for (let k = 0; k < rows.length; k++) {
        let row = rows[k];
        if (row.children["3"].children["0"].children["0"].data === 'A') {
            objectArray.push({
                ip: row.children["7"].children["1"].children["0"].attribs.value,
                delete: row.children["9"].children["1"].attribs.onclick.split('\'')[3]
            });
        }
    }
    return objectArray;
}

async function home() {
    let token;
    let optionsHome = {
        method: 'GET',
        simple: false,
        jar: jar,
        url: 'https://my.freenom.com/clientarea.php',
        headers:
            { 'Cache-Control': 'no-cache' }
    };

    await request(optionsHome, function (error, response, body) {
        if (error) throw new Error(error);
        let $ = cheerio.load(body);
        let result = $("body > div.wrapper > section.login > div > div > div.col-md-4.max-width.form > form.form-stacked > input[type=\"hidden\"]")[0];
        token = result.attribs.value;
    });
    return token;
}

async function ipify() {
    let ip;
    await request({ uri: 'https://api.ipify.org?format=json', json: true }, (error, response, body) => {
        ip = body.ip;
        console.log(`Ip actual ${ip}`);
    });
    return ip;
}

async function login(token) {
    let options = {
        method: 'POST',
        simple: false,
        url: 'https://my.freenom.com/dologin.php',
        jar: jar,
        headers:
            {
                'Accept-Language': 'en',
                'Accept-Encoding': 'gzip, deflate, br',
                Referer: 'https://my.freenom.com/clientarea.php',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Upgrade-Insecure-Requests': '1',
                Origin: 'https://my.freenom.com',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive'
            },
        form:
            {
                token: token,
                username: username,
                password: password,
                rememberme: 'on'
            }
    };

    await request(options, function (error, response) {
        if (error) {
            throw new Error(error);
        } else if (response.headers.location === '/clientarea.php?incorrect=true') {
            throw new Error("Login fallido");
        } else if (response.statusCode === 302 && response.headers.location === '/clientarea.php') {
            console.log("Login exitoso");
        }
    });
}

async function clientArea(domain) {
    let aTypeRows;
    let options = {
        method: 'GET',
        jar: jar,
        gzip: true,
        simple: false,
        url: 'https://my.freenom.com/clientarea.php',
        qs: { managedns: domain.domain, domainid: domain.domainId },
        headers:
            {
                'Accept-Language': 'en',
                'Accept-Encoding': 'gzip, deflate, br',
                Referer: `https://my.freenom.com/clientarea.php?managedns=${domain}&domainid=${domainId}`,
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive'
            }
    };
    await request(options, function (error, response, body) {
        if (error) throw new Error(error);
        let $ = cheerio.load(body);
        //password input means token expired, will relogin at next execution
        if ($("#password").length > 0)
            token = null;
        //let rows = $("body > div.wrapper > section.domainContent > div > div > div > form:nth-child(4) > table > tbody > tr");
        let rows = $("#recordslistform > table > tbody > tr");
        aTypeRows = parseTableRows(rows);
    });
    return aTypeRows;
}

async function createRecord(ttl, ip, domain) {
    let options = {
        simple: false,
        jar: jar,
        method: 'POST',
        url: 'https://my.freenom.com/clientarea.php',
        qs: { managedns: domain.domain, domainid: domain.domainId },
        headers:
            {
                'Accept-Language': 'en',
                'Accept-Encoding': 'gzip, deflate, br',
                Referer: `https://my.freenom.com/clientarea.php?managedns=${domain}&domainid=${domainId}`,
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Upgrade-Insecure-Requests': '1',
                Origin: 'https://my.freenom.com',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive'
            },
        form:
            {
                token: token,
                dnsaction: 'add',
                'addrecord[0][name]': '',
                'addrecord[0][type]': 'A',
                'addrecord[0][ttl]': ttl.toString(),
                'addrecord[0][value]': ip,
                'addrecord[0][priority]': '',
                'addrecord[0][port]': '',
                'addrecord[0][weight]': '',
                'addrecord[0][forward_type]': '1'
            }
    };
    await request(options, function (error, response, body) {
        if (error) throw new Error(error);
        console.log("Location: " + response.headers.location);
        console.log("Status: " + response.statusCode);
        console.log("Body: " + response.body);
    });
}

let logic = async () => {
    let isAlreadyCreated = false;
    if (!token)
        token = await home();
    let ip = await ipify();
    if (!jar._jar.store.idx["my.freenom.com"]["/"].WHMCSUser)
        await login(token);
    domains.forEach(async (domain) => {
        let aTypeRegisters = await clientArea(domain);
        for (let i = 0; i < aTypeRegisters.length; i++) {
            let reg = aTypeRegisters[i];
            if (reg.ip !== ip) {
                await request({ jar: jar, uri: "https://my.freenom.com/" + reg.delete });
                console.log(`Record ${reg.ip} deleted on ${domain.domain}`);
            } else {
                isAlreadyCreated = true;
            }
        }
        if (!isAlreadyCreated) {
          if (lastIp == ip) {
            console.error("Detected failure, trying to login again");
            lastIp = token = null;
          } else {
            await createRecord(300, ip, domain);
          }
        }
        console.log((isAlreadyCreated ? `Existing record on ${domain.domain}` : `Record created on ${domain.domain}`));
        lastIp = ip;
    });
};

let cron = (cb) => {
    cb();
    setTimeout(() => {
        cron(cb);
    }, frecuency)
};

cron(logic);
