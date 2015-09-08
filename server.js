var Express = require('express');
var BodyParser = require('body-parser');
var Jade = require('jade');
var Typeset = require('./typeset.js');
var util = require('util');
var config = require('./config.js');

var SERVER = process.env.SERVER || config.server || '127.0.0.1';
var PORT = process.env.PORT || config.port || '8080';

console.log("Starting MathSlax instance on " + SERVER + ":" + PORT.toString());

// Install the routes.
var router = Express.Router();
router.get('/', function(req, res) {
  res.json(['Hello', 'World', {underDevelopment: true}]);
});
router.post('/typeset', function(req, res) {
  var cd = new Date();
  var requestString = req.body.text;
  var bpr = 'math\\!';
  console.log(cd + ":" + requestString);
  console.log( " going to send "+bpr );
  var authToken = req.body.token;
  if (authToken != config.authToken) {
    res.status(401).send();
    return;
  };
  var typesetPromise = Typeset.typeset(requestString,bpr);
  if (typesetPromise === null) {
    res.send('no text found to typeset');
    res.end(); // Empty 200 response -- no text was found to typeset.
    return;
  }
  var promiseSuccess = function(mathObjects) {
    var locals = {'mathObjects': mathObjects,
                  'serverAddress': util.format('http://%s:%s/', SERVER, PORT)};
    var pngResult = Jade.renderFile('./views/slack-response.jade', locals);
    res.json({'text' : pngResult});
    res.end();
  };
  var promiseError = function(mathObject) {
    console.log('Error in typesetting:');
    console.log(mathObject);
    if (mathObject && mathObject.output && mathObject.output.errors) {
	locals={
	    'errors': mathObject.output.errors,
	    'expr': mathObject.input
	}
	var errResult = Jade.renderFile('./views/slack-error-response.jade', locals);
	res.json({
	    'text': errResult
	});
    }
    res.end(); // Empty 200 response.
  };
  typesetPromise.then(promiseSuccess, promiseError);
});
router.post('/slashtypeset', function(req, res) {
  var cd = new Date();
  var requestString = req.body.text;
  var typesetPromise = Typeset.typeset(requestString,'');
  if (typesetPromise === null) {
    res.send('no text found to typeset');
    res.end(); // Empty 200 response -- no text was found to typeset.
    return;
  }
  var promiseSuccess = function(mathObjects) {
    var locals = {'mathObjects': mathObjects,
                  'serverAddress': util.format('http://%s:%s/', SERVER, PORT)};
    var htmlResult = Jade.renderFile('./views/slack-slash-response.jade', locals);
    res.send(htmlResult);
    res.end();
  };
  var promiseError = function(mathObject) {
    console.log('Error in typesetting:');
    console.log(mathObject);
    if (mathObject && mathObject.output && mathObject.output.errors) {
	var locals = {'errors': mathObject.output.errors,
		      'expr': mathObject.input};
	    var htmlResult = Jade.renderFile('./views/slack-slash-error-response.jade', locals);
	    res.send(htmlResult);
    }
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

app.listen(PORT);
console.log("Mathslax is listening at http://%s:%s/", SERVER, PORT);
console.log("Make a test request with something like:");
console.log("curl -v -X POST '%s:%d/typeset' --data " +
            "'{\"text\": \"math! f(x) = x^2/sin(x) * E_0\", " +
              "\"token\": \"" + config.authToken + "\"}' " +
            "-H \"Content-Type: application/json\"", SERVER, PORT);
console.log('___________\n');
