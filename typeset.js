// Initialize MathJax
const Util = require('util');
const _ = require('underscore');
const fs = require('fs').promises;
const md5 = require('md5');
const Svg2Img = require('svg2img')
const Entities = require('html-entities').XmlEntities;
entities = new Entities();

MathJax = {
  options: {
  },
  loader: {
    paths: ['mathjax-full/es5'],
    source: require('mathjax-full/components/src/source.js').source,
    require: require,
    load: [
      'adaptors/liteDOM'
    ]
  },
  tex: {
    packages: ['base', 'autoload', 'require', 'ams', 'newcommand']
  },
  svg: {
    fontCache: 'local'
  },
  startup: {
    typeset: false
  }
};
require('mathjax-full/es5/tex-svg.js');

// Application logic for typesetting.
const extractRawMath = function(text, prefix) {
  const mathRegex = new RegExp("^\s*" + prefix + "\s*((?:\n|.)*)$","g");
  var results = [];
  var match;
  while (match = mathRegex.exec(text)) {
    results.push({ // mathObject
      input: match[1],
      output: null,
      error: null,
    });
  }
  console.log(`${new Date()}: DEBUG: extractRawMath("${text}", "${prefix}"):`, results);
  return results;
};

const renderMathObject = async function(mathObject, filepath) {
  const state = {};
  var status = 'Initializing MathJax';
  try {
    console.log(`${new Date()}: ${status}: ...`);
    await MathJax.startup.promise;
    console.log(`${new Date()}: ${status}: complete`);
  } catch(error) {
    console.log(`${new Date()}: ${status}: failed:`, error);
    throw error;
  }

  status = 'Rendering SVG';
  try {
    console.log(`${new Date()}: ${status}: ${mathObject.input}`);
    state.svgNode = await MathJax.tex2svgPromise(mathObject.input, {
      display: true,
      ex: 4,
    });
    console.log(`${new Date()}: ${status}: complete`);
  } catch(error) {
    console.log(`${new Date()}: ${status} from ${mathObject.input}: failed:`, error);
    throw error;
  }

  status = 'Rendering PNG';
  try {
    console.log(`${new Date()}: ${status}: ${mathObject.input}`);
    state.pngBuffer = await Util.promisify(Svg2Img)(
      MathJax.startup.adaptor.outerHTML(state.svgNode), {
	format: 'png'
      });
    console.log(`${new Date()}: ${status}: complete`);
  } catch(error) {
    console.log(`${new Date()}: ${status} from ${mathObject.input}: failed:`, error);
    throw error;
  }

  status = 'Saving file';
  try {
    console.log(`${new Date()}: ${status}: ${filepath}`);
    await fs.writeFile(filepath, state.pngBuffer);
    console.log(`${new Date()}: ${status}: complete`);
  } catch(error) {
    console.log(`${new Date()}: ${status} to ${filepath}: failed:`, error);
    throw error;
  }
  console.log(`${new Date()}: Wrote '${filepath}'`);

  mathObject.output = filepath;
  return mathObject;
}

const renderMathObjectCached = async function(mathObject) {
  const filename = md5(mathObject.input) + '.png';
  const filepath = 'static/' + filename;
  const exists = async function(filepath) {
    try {
      if (await fs.stat(filepath)) {
	return true;
      }
    } catch(error) {
    }
    return false;
  };
  console.log(`${new Date()}: DEBUG: renderMathObjectCached: Checking if "${filepath}" exists`);
  if (await exists(filepath)) {
    console.log(`${new Date()}: Using existing PNG: '${filename}'`);
    mathObject.output = filepath;
    return mathObject;
  }
  try {
    console.log(`${new Date()}: DEBUG: renderMathObjectCached: Rendering "${mathObject.input}"`);
    return await renderMathObject(mathObject, filepath);
  } catch(error) {
    console.log(`${new Date()}: DEBUG: renderMathObjectCached: Failed:`, error);
    mathObject.error = error;
    mathObject.output = null;
    throw mathObject;
  }
}

const typeset = async function(text, prefix) {
  const rawMathArray = extractRawMath(entities.decode(text), prefix);
  console.log(`${new Date()}: DEBUG: typeset: Found ${rawMathArray.length} inputs`);
  if (rawMathArray.length === 0) {
    throw new Error('No math to typeset');
  }
  console.log(`${new Date()}: DEBUG: typeset: Awaiting rendering`);
  return await Promise.all(_.map(rawMathArray, renderMathObjectCached));
};

module.exports = {
  typeset: typeset,
};
