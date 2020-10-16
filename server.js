require('es6-object-assign').polyfill();

var Express = require('express');
var Fs = require('fs');
var BodyParser = require('body-parser');
var Jade = require('jade');
var Typeset = require('./typeset.js');
var util = require('util');
var config = require('./config.js');

var http = require('http');

var SCHEME = process.env.SCHEME || config.scheme || 'http';
var SERVER = process.env.SERVER || config.server || '127.0.0.1';
var PORT = process.env.PORT || config.port || '8080';
var KEY = process.env.KEY   || config.key;
var CERT = process.env.CERT || config.cert;
var LocalUrl;
if ((SCHEME === 'http' && PORT == '80') ||
    (SCHEME === 'https' && PORT == '443')) {
  LocalUrl = util.format('%s://%s/', SCHEME, SERVER);
} else {
  LocalUrl = util.format('%s://%s:%s/', SCHEME, SERVER, PORT);
}
var BASE_URL = process.env.BASE_URL || config.base_url || LocalUrl;
if (!BASE_URL.endsWith('/')) {
  BASE_URL += '/';
}

// Install the routes.
var router = Express.Router();
router.all('/typeset', function(req, res) {
  var params = Object.assign(req.query, req.body)
console.log(params);
  // check auth
  console.log(cd + ": " + requestString);
  if (!params.token || config.authTokens[params.team_domain] != params.token) {
    console.log("Unauthorized token", params.token, "for team domain", params.team_domain);
    res.status(401).send();
    return;
  };

  var cd = new Date();
  console.log(req.body);
  var requestString = params.text;
  if (requestString === "" || requestString == null) {
    console.log('No math to typeset');
    res.json({'text': "No math to typeset",
              'username': params.user_name,
              'response_type': 'ephemeral',
    });
    res.end(); // Empty 200 response -- no text was found to typeset.
    return;
  }
  var bpr = params.trigger_word || "";
  var typesetPromise = Typeset.typeset(requestString,bpr);
  if (typesetPromise === null) {
    console.log('No math to typeset');
    res.json({'text': "No math to typeset",
              'username': params.user_name,
              'response_type': 'ephemeral',
    });
    res.end(); // Empty 200 response -- no text was found to typeset.
    return;
  }
  var promiseSuccess = function(mathObjects) {
    console.log('rendered: ', mathObjects[0].input);
    var locals = {'mathObjects': mathObjects,
                  'serverAddress': BASE_URL};
    var htmlResult = Jade.renderFile('./views/slack-response.jade', locals);
    res.json({
              'username': params.user_name,
              'text': htmlResult,
	      'response_type': 'in_channel'
              //'attachments': [ {
              //     'fallback': requestString,
              //     'image_url': htmlResult
              //   } ]
    });
    res.end();
  };
  var promiseError = function(error) {
    var errs=(error.output.errors || error.error).join("\n");
    console.log("Errors:", errs);
    res.json({'text': errs,
              'username': params.user_name,
              'response_type': 'ephemeral',
    });
    res.end();
  };
  typesetPromise.then(promiseSuccess, promiseError);
});


// Start the server.
var app = Express();
app.use(BodyParser.urlencoded({extended: true}));
app.use(BodyParser.json());
app.use('/static', Express.static('static'));
app.use('/', router);

if (SCHEME == 'http') {
  http.createServer(app).listen(PORT);
} else if (SCHEME == 'https') {
  var sslOpts = {
    key: Fs.readFileSync(KEY),
    cert: Fs.readFileSync(CERT),

  };
  https.createServer(sslOpts, app).listen(PORT);
}

console.log("Mathslax is listening at http://%s:%s/", SERVER, PORT);
console.log("Make a test request with something like:");
console.log("curl -v -X POST '" + BASE_URL + "typeset' --data " +
            "'{\"text\": \"math! f(x) = x^2/sin(x) * E_0\", " +
              "\"team_domain\": \"test\"}' " +
              "\"token\": \"test\"}' " +
            "-H \"Content-Type: application/json\"");
console.log('___________\n');
