// Initialize MathJax
import Util from 'util';
import _ from 'underscore';
import fs from 'node:fs/promises';
import md5 from 'md5';
import process from 'process';
import { chromium } from 'playwright';
import { XmlEntities as Entities } from 'html-entities';
const entities = new Entities();
var browser;

import {mathjax} from 'mathjax-full/js/mathjax.js';
import {TeX} from 'mathjax-full/js/input/tex.js';
import {SVG} from 'mathjax-full/js/output/svg.js';
import {liteAdaptor} from 'mathjax-full/js/adaptors/liteAdaptor.js';
import {RegisterHTMLHandler} from 'mathjax-full/js/handlers/html.js';
import {AssistiveMmlHandler} from 'mathjax-full/js/a11y/assistive-mml.js';
import {AllPackages} from 'mathjax-full/js/input/tex/AllPackages.js';

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
  var html, adaptor;
  try {
    console.log(`${new Date()}: renderMathObject: ${status}: ...`);
    adaptor = liteAdaptor();
    const handler = RegisterHTMLHandler(adaptor);
    const tex = new TeX({packages: ['base', 'autoload', 'require', 'ams', 'newcommand']});
    const svg = new SVG({fontCache: 'local'});
    html = mathjax.document('', {InputJax: tex, OutputJax: svg});
    console.log(`${new Date()}: renderMathObject: ${status}: complete`);
  } catch(error) {
    console.log(`${new Date()}: renderMathObject: ${status}: failed:`, error);
    throw error;
  }

  status = 'Rendering SVG';
  try {
    console.log(`${new Date()}: renderMathObject: ${status}: ${mathObject.input}`);
    state.svgNode = html.convert(mathObject.input, {
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
    await fs.writeFile(svgpath, adaptor.innerHTML(state.svgNode));
    if (!browser) {
      console.log(`${new Date()}: renderMathObject: launching browser`);
	browser = await chromium.launch({
	    args: ['--disable-gpu',
		   '--no-sandbox',
		   '--disable-setuid-sandbox'],
	    dumpio: true});
      console.log(`${new Date()}: renderMathObject: done`);
    }
    console.log(`${new Date()}: renderMathObject: opening new page`);
    const page = await browser.newPage();
    const svgurl = `file://${process.cwd()}/${svgpath}`;
    console.log(`${new Date()}: renderMathObject: navigating to SVG file ${svgurl}`);
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
    console.log(`${new Date()}: renderMathObject: getting bounding box`);
    // Otherwise, resize to the SVG dimensions and save the PNG.
    const {width, height} = await page.evaluate(async () => {
      const element = document.querySelector('svg');
      const {width, height} = element.getBoundingClientRect();
      return {width, height};
    });
    console.log(`${new Date()}: renderMathObject: taking screenshot`);
    await page.screenshot({path: filepath,
			   clip: {x: 0, y: 0, width, height}});
    console.log(`${new Date()}: renderMathObject: closing page`);
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

export default async function(text, prefix) {
  const rawMathArray = extractRawMath(entities.decode(text), prefix);
  console.log(`${new Date()}: typeset: Found ${rawMathArray.length} inputs`);
  if (rawMathArray.length === 0) {
    throw new Error('No math to typeset');
  }
  console.log(`${new Date()}: typeset: Awaiting rendering`);
  return await Promise.all(_.map(rawMathArray, renderMathObjectCached));
};
