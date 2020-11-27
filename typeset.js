// Initialize MathJax
const Util = require('util');
const _ = require('underscore');
const fs = require('fs').promises;
const md5 = require('md5');
const process = require('process');
const puppeteer = require('puppeteer')
const Entities = require('html-entities').XmlEntities;
entities = new Entities();
var browser;


MathJax = {
  options: {
    enableAssistiveMml: false,
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
  console.log(`${new Date()}: extractRawMath("${text}", "${prefix}") =>`, results);
  return results;
};

const renderMathObject = async function(mathObject, filepath) {
  const state = {};
  var status = 'Initializing MathJax';
  try {
    console.log(`${new Date()}: renderMathObject: ${status}: ...`);
    await MathJax.startup.promise;
    console.log(`${new Date()}: renderMathObject: ${status}: complete`);
  } catch(error) {
    console.log(`${new Date()}: renderMathObject: ${status}: failed:`, error);
    throw error;
  }

  status = 'Rendering SVG';
  try {
    console.log(`${new Date()}: renderMathObject: ${status}: ${mathObject.input}`);
    state.svgNode = await MathJax.tex2svgPromise(mathObject.input, {
      display: true,
      ex: 4,
    });
    console.log(`${new Date()}: renderMathObject: ${status}: complete`);
  } catch(error) {
    console.log(`${new Date()}: renderMathObject: ${status} from ${mathObject.input}: failed:`, error);
    throw error;
  }

  status = 'Rendering PNG';
  try {
    
    console.log(`${new Date()}: renderMathObject: ${status}: ${mathObject.input}`);
    const svgpath = filepath.replace(/\.png$/, '.svg');
    await fs.writeFile(svgpath,
		       MathJax.startup.adaptor.innerHTML(state.svgNode));
    if (!browser) {
      browser = await puppeteer.launch();
    }
    const page = await browser.newPage();
    const svgurl = `file://${process.cwd()}/${svgpath}`;
    await page.goto(svgurl);
    // Check for errors.
    const errorText = await page.evaluate(async function() {
      return Array.from(document.querySelectorAll('g[data-mjx-error]'))
	.map((elt) => elt.getAttribute('data-mjx-error'))
	.join('\n');
    });
    if (errorText !== '') {
      await page.close();
      throw new Error(`Unable to typeset '${mathObject.input}': ${errorText}`);
    }
    // Otherwise, resize to the SVG dimensions and save the PNG.
    const {width, height} = await page.evaluate(async () => {
      const element = document.querySelector('svg');
      const {width, height} = element.getBoundingClientRect();
      return {width, height};
    });
    await page.screenshot({path: filepath,
			   clip: {x: 0, y: 0, width, height}});
    await page.close();
    console.log(`${new Date()}: renderMathObject: ${status}: complete`);
  } catch(error) {
    console.log(`${new Date()}: renderMathObject: ${status} from ${mathObject.input}: failed:`, error);
    throw error;
  }

  console.log(`${new Date()}: renderMathObject: Wrote '${filepath}'`);

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
  console.log(`${new Date()}: renderMathObjectCached: Checking if "${filepath}" exists`);
  if (await exists(filepath)) {
    console.log(`${new Date()}: renderMathObjectCached: Using existing PNG: '${filename}'`);
    mathObject.output = filepath;
    return mathObject;
  }
  try {
    console.log(`${new Date()}: renderMathObjectCached: Rendering "${mathObject.input}"`);
    return await renderMathObject(mathObject, filepath);
  } catch(error) {
    console.log(`${new Date()}: renderMathObjectCached: Failed:`, error);
    mathObject.error = error;
    mathObject.output = null;
    throw mathObject;
  }
}

const typeset = async function(text, prefix) {
  const rawMathArray = extractRawMath(entities.decode(text), prefix);
  console.log(`${new Date()}: typeset: Found ${rawMathArray.length} inputs`);
  if (rawMathArray.length === 0) {
    throw new Error('No math to typeset');
  }
  console.log(`${new Date()}: typeset: Awaiting rendering`);
  return await Promise.all(_.map(rawMathArray, renderMathObjectCached));
};

module.exports = {
  typeset: typeset,
};
