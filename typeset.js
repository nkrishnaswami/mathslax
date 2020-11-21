// Initialize MathJax
const Util = require('util');
const _ = require('underscore');
const fs = require('fs').promises;
const md5 = require('md5');
const Svg2Img = require('svg2img')
const Entities = require('html-entities').XmlEntities;
entities = new Entities();

const mathjax = require('mathjax-full');
const MathJaxPromise = Util.promisify(mathjax.init)({
  options: { },
  loader: { load: [
    'core', 'adaptors/liteDOM', 'input/tex-base', '[tex]/all-packages',
    'output/svg', 'output/svg/fonts/tex'
  ]},
  tex: { packages: ['base', 'autoload', 'require', 'ams', 'newcommand'] },
  svg: { fontCache: 'local' },
  startup: { typeset: false }
});


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
  return results;
};

const renderMathObject = async function(mathObject) {
  try {
    const MathJax = await MathJaxPromise;
    const adaptor = MathJax.startup.adaptor;
    const svgNode = await MathJax.tex2svg(mathObject.input, {
      display: true,
      ex: 4,
      containerWidth: 800,
    });
  } catch(error) {
    console.log("Failed to render", mathObject.input, "to SVG:", error);
    throw error;
  }
  console.log("Rendered", mathObject.input, "to SVG");
  try {
    const pngBuffer = await Util.promisify(Svg2Img)(svgNode.OuterHTML, {
      format: 'png'
    });
  } catch(error) {
    console.log("Failed to render", mathObject.input, "to PNG:", error);
    throw error;
  }
  console.log('Rendered to PNG');
  try {
    await fs.writeFile(filepath, pngBuffer);
  } catch(error) {
    console.log("Failed to save PNG of", mathObject.input, "to file:", error);
    throw error;
  }
  console.log('Wrote to: %s', filename);

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
  if (await exists(filepath)) {
    console.log('using existing PNG: %s', filename);
    mathObject.output = filepath;
    return mathObject;
  }
  try {
    return await renderMathObject(mathObject, filepath);
  } catch(error) {
    mathObject.error = error;
    mathObject.output = null;
    throw mathObject;
  }
}

const typeset = async function(text, prefix) {
  const rawMathArray = extractRawMath(entities.decode(text), prefix);
  if (rawMathArray.length === 0) {
    throw new Error('No math to typeset');
  }
  return await Promise.all(_.map(rawMathArray, renderMathObjectCached));
};

module.exports = {
  typeset: typeset,
};
