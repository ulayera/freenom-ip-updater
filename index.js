const request = require("request-promise");
const cheerio = require("cheerio");
let jar;
let SECTION_SEPARATOR = `===================================================================================`;

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
  let optionsHome = {
    method: 'GET',
    simple: false,
    jar: jar,
    url: 'https://my.freenom.com/clientarea.php',
    headers:
      { 'Cache-Control': 'no-cache' }
  };

  return new Promise((resolve, reject) => {
    request(optionsHome, function (error, response, body) {
      if (error) reject(error);
      let $ = cheerio.load(body);
      let result = $("body > div.wrapper > section.login > div > div > div.col-md-4.max-width.form > form.form-stacked > input[type=\"hidden\"]")[0];
      token = result.attribs.value;
      resolve(token);
    });
  });
}

async function ipify() {
  return new Promise((resolve, reject) => {
    request({ uri: 'https://api.ipify.org?format=json', json: true }, (error, response, body) => {
      if (error) reject(error);
      resolve(body.ip);
    });
  });
}

async function login(token) {
  jar = request.jar();
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
  return new Promise((resolve, reject) => {
    request(options, function (error, response) {
      if (error) {
        reject(error);
      } else if (response.headers.location === '/clientarea.php?incorrect=true') {
        reject("Login fallido");
      } else if (response.statusCode === 302 && response.headers.location.indexOf('clientarea.php') > -1) {
        resolve();
      }
    });
  });
}

async function clientArea(domain) {
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
  return new Promise((resolve, reject) => {
    request(options, function (error, response, body) {
      if (error) reject(error);
      let $ = cheerio.load(body);
      if ($("#recordslistform").length > 0) {
        let rows = $("#recordslistform > table > tbody > tr");
        resolve(parseTableRows(rows));
      } else {
        reject();
      }
    });
  });
}

async function createRecord(ttl, ip, domain) {
  let options = {
    simple: false,
    jar: jar,
    gzip: true,
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
  return new Promise((resolve) => {
    request(options, function (error, response, body) {
      if (error) reject(error);
      if (!body || body.length === 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    })
  });
}

function loginProcess() {
  return new Promise(resolve => {
    console.log(`[OnDemandTask] Logging in.`);
    home().then(token => {
      login(token).then(() => {
        console.log(`[OnDemandTask] Login success.`);
        resolve();
      }).catch(console.error);
    });
  });
}

async function getATypeRegisters(currentDomain) {
  return new Promise(resolve => {
    clientArea(currentDomain).then(aTypeRegisters => {
      resolve(aTypeRegisters);
    }).catch(() => {
      loginProcess().then(() => {
        clientArea(currentDomain).then(aTypeRegisters => {
          resolve(aTypeRegisters);
        });
      });
    });
  });
}

function deleteATypeRegister(reg, currentDomain) {
  return new Promise(resolve => {
    request({ jar: jar, uri: "https://my.freenom.com/" + reg.delete })
      .then(() => {
        console.log(`[Validations] Record ${reg.ip} deleted on ${currentDomain.domain}`);
        resolve();
      });
  });
}

function iterateDomains(ip) {
  return new Promise(resolve => {
    domains.forEach(currentDomain => {
      getATypeRegisters(currentDomain)
        .then(aTypeRegisters => {
          Promise.all(aTypeRegisters.filter(reg => reg.ip !== ip)
            .map(reg => deleteATypeRegister(reg, currentDomain)))
            .then(() => {
              let existing = aTypeRegisters.find(reg => reg.ip === ip);
              if (existing) {
                console.info(`[Validations] Record ${existing.ip} already exists on ${currentDomain.domain}`);
                resolve();
              } else {
                createRecord(300, ip, currentDomain)
                  .then((result) => {
                    if (result) {
                      console.log(`[PostTasks] Non existing record on ${currentDomain.domain}, record was created.`);
                    } else {
                      console.error(`[PostTasks] Non existing record on ${currentDomain.domain}, record WAS NOT created.`);
                    }
                    resolve();
                  })
                  .catch(console.error);
              }
            });
        });
    });
  });
}

let logic = async () => {

  console.log(SECTION_SEPARATOR);
  console.log(`[InfoTask] Running job at ${new Date()}.`);
  ipify().then(ip => {
    console.log(`[Validations] Current IP address ${ip}`);
    iterateDomains(ip).then(() => {
      console.log(SECTION_SEPARATOR);
    });
  });

};

let cron = (cb) => {
  cb();
  setTimeout(() => {
    cron(cb);
  }, frecuency)
};

cron(logic);
