var MathJax = require('MathJax-node/lib/mj-single.js');
var _ = require('underscore');
var Q = require('q');
var fs = require('fs');
var md5 = require('md5');
var Entities = require('html-entities').XmlEntities;
entities = new Entities();

MathJax.start();

// Application logic for typesetting.
var extractRawMath = function(text, prefix) {
  var mathRegex = new RegExp("^\s*" + prefix + "\s*((?:\n|.)*)$","g");
  var results = [];
  var match;
  while (match = mathRegex.exec(text)) {
    results.push({ // mathObject
      input: match[1],
      output: null,
      error: null,
    });
  }
  return results;
};

var renderMath = function(mathObject) {
  var typesetOptions = {
    math: mathObject.input,
    format: 'TeX',
    png: true,
    dpi: 200,
    font: 'TeX',
    ex: 4,
    width: 800,
    linebreaks: false,
  };
  var deferred = Q.defer();
  var typesetCallback = function(result) {
    console.log("Rendered "+ mathObject.input);
    if (!result || !result.png || !!result.errors) {
      mathObject.error = new Error('Invalid response from MathJax.');
      mathObject.output = result;
      deferred.reject(mathObject);
      return;
    }
    var filename = md5(mathObject.input) + '.png';
    var filepath = 'static/' + filename;
    if (!fs.existsSync(filepath)) {
      console.log('writing new PNG: %s', filename);
      var pngData = new Buffer(result.png.slice(22), 'base64');
      fs.writeFile(filepath, pngData, function(error) {
        if (error) {
          mathObject.error = error;
          mathObject.output = null;
          deferred.reject(mathObject);
        }
      });
    } else {
      console.log('using existing PNG: %s', filename);
    }
    mathObject.output = filepath;
    deferred.resolve(mathObject);
  };
  MathJax.typeset(typesetOptions, typesetCallback);
  return deferred.promise;
}

var typeset = function(text, prefix) {
  var rawMathArray = extractRawMath(entities.decode(text), prefix);
  if (rawMathArray.length === 0) {
    return null;
  }
  return Q.all(_.map(rawMathArray, renderMath));
};

module.exports = {
  typeset: typeset,
};
