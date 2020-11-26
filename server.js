const Express = require('express');
const Fs = require('fs');
const BodyParser = require('body-parser');
const Typeset = require('./typeset.js');
const util = require('util');
const config = require('./config.js');

const http = require('http');

const SCHEME = process.env.SCHEME || config.scheme || 'http';
const SERVER = process.env.SERVER || config.server || '127.0.0.1';
const PORT = process.env.PORT || config.port || '8080';
const KEY = process.env.KEY   || config.key;
const CERT = process.env.CERT || config.cert;

const makeLocalUrl = function(scheme, server, port) {
  if ((scheme === 'http' && port == '80') ||
      (scheme === 'https' && port == '443')) {
    return `${scheme}://${server}/`;
  } else {
    return `${scheme}://${server}:${port}/`;
  }
}
const LocalUrl = makeLocalUrl(SCHEME, SERVER, PORT);

const ensureTrailingSlash = function(url) {
  if (!url.endsWith('/')) {
    url += '/';
  }
  return url;
}
const BASE_URL = ensureTrailingSlash(process.env.BASE_URL || config.base_url || LocalUrl);

const MakeResultUrls = function(mathObjects) {
  const urls = mathObjects.map((mathObject) => `${BASE_URL}${mathObject.output}`);
  return urls.join(' ');
}

// Install the routes.
const router = Express.Router();
router.all('/typeset', async function(req, res) {
  console.time('typeset');
  const params = Object.assign(req.query, req.body)
  console.log(`${new Date()}: /typeset params:`, params);
  const requestString = params.text;
  // check auth
  if (!params.token || config.authTokens[params.team_domain] != params.token) {
    console.warn(`${new Date()}: Unauthorized token "${params.token}" ` +
		 `for team domain "${params.team_domain}"`);
    res.status(401).send();
    console.timeEnd('typeset');
    return;
  };

  console.log(`${new Date()}: Processing: ${req.body}`);
  if (requestString === '' || requestString == null) {
    console.log(`${new Date()}: No math to typeset`);
    res.json({'text': 'No math to typeset',
              'username': params.user_name,
              'response_type': 'ephemeral',
	     });
    res.end(); // Empty 200 response -- no text was found to typeset.
    console.timeEnd('typeset');
    return;
  }
  const bpr = params.trigger_word || '';
  try {
    const mathObjects = await Typeset.typeset(requestString, bpr);
    console.log(`${new Date()}: Rendered: ${mathObjects[0].input}`);
    res.json({
      'username': params.user_name,
      'text': MakeResultUrls(mathObjects),
      'response_type': 'in_channel'
      //'attachments': [ {
      //     'fallback': requestString,
      //     'image_url': htmlResult
      //   } ]
    });
  } catch(error) {
    console.log(`${new Date()}: Errors:`, error);
    res.json({'text': `${error}`,
              'username': params.user_name,
              'response_type': 'ephemeral',
	     });
  }
  res.end();
  console.timeEnd('typeset');
});


// Start the server.
const app = Express();
app.use(BodyParser.urlencoded({extended: true}));
app.use(BodyParser.json());
app.use('/static', Express.static('static'));
app.use('/', router);

if (SCHEME == 'http') {
  http.createServer(app).listen(PORT);
} else if (SCHEME == 'https') {
  const sslOpts = {
    key: Fs.readFileSync(KEY),
    cert: Fs.readFileSync(CERT),

  };
  https.createServer(sslOpts, app).listen(PORT);
}

console.log("Mathslax is listening at http://%s:%s/", SERVER, PORT);
console.log("Make a test request with something like:");
console.log("curl -v '" + BASE_URL + "typeset' --data " +
            "'{\"text\": \"f(x) = x^2/sin(x) * E_0\", " +
            "\"team_domain\": \"test\"}' " +
            "\"token\": \"test\"}' " +
            "-H \"Content-Type: application/json\"");
console.log('___________\n');
