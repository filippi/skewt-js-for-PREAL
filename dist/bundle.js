(function(){'use strict';// Linear interpolation
// The values (y1 and y2) can be arrays
function linearInterpolate(x1, y1, x2, y2, x) {
    if (x1 == x2) {
        return y1;
    }
    const w = (x - x1) / (x2 - x1);

    if (Array.isArray(y1)) {
        return y1.map((y1, i) => y1 * (1 - w) + y2[i] * w);
    }
    return y1 * (1 - w) + y2 * w;
}

// Sampling at at targetXs with linear interpolation
// xs and ys must have the same length.
function sampleAt(xs, ys, targetXs) {
    const descOrder = xs[0] > xs[1];
    return targetXs.map((tx) => {
        let index = xs.findIndex((x) => (descOrder ? x <= tx : x >= tx));
        if (index == -1) {
            index = xs.length - 1;
        } else if (index == 0) {
            index = 1;
        }
        return linearInterpolate(xs[index - 1], ys[index - 1], xs[index], ys[index], tx);
    });
}

// x?s must be sorted in ascending order.
// x?s and y?s must have the same length.
// return [x, y] or null when no intersection found.
function firstIntersection(x1s, y1s, x2s, y2s) {
    // Find all the points in the intersection of the 2 x ranges
    const min = Math.max(x1s[0], x2s[0]);
    const max = Math.min(x1s[x1s.length - 1], x2s[x2s.length - 1]);
    const xs = Array.from(new Set([...x1s, ...x2s]))
        .filter((x) => x >= min && x <= max)
        .sort((a, b) => (Number(a) > Number(b) ? 1 : -1));
    // Interpolate the lines for all the points of that intersection
    const iy1s = sampleAt(x1s, y1s, xs);
    const iy2s = sampleAt(x2s, y2s, xs);
    // Check if each segment intersect
    for (let index = 0; index < xs.length - 1; index++) {
        const y11 = iy1s[index];
        const y21 = iy2s[index];
        const x1 = xs[index];
        if (y11 == y21) {
            return [x1, y11];
        }
        const y12 = iy1s[index + 1];
        const y22 = iy2s[index + 1];
        if (Math.sign(y21 - y11) != Math.sign(y22 - y12)) {
            const x2 = xs[index + 1];
            const width = x2 - x1;
            const slope1 = (y12 - y11) / width;
            const slope2 = (y22 - y21) / width;
            const dx = (y21 - y11) / (slope1 - slope2);
            const dy = dx * slope1;
            return [x1 + dx, y11 + dy];
        }
    }
    return null;
}

function zip(a, b) {
    return a.map((v, i) => [v, b[i]]);
}

function scaleLog(from, to) {
    from = from.map(Math.log);
    const scale = (v) => sampleAt(from, to, [Math.log(v)])[0];
    scale.invert = (v) => Math.exp(sampleAt(to, from, [v])[0]);
    return scale;
}// Gas constant for dry air at the surface of the Earth
const Rd = 287;
// Specific heat at constant pressure for dry air
const Cpd = 1005;
// Molecular weight ratio
const epsilon = 18.01528 / 28.9644;
// Heat of vaporization of water
const Lv = 2501000;
// Ratio of the specific gas constant of dry air to the specific gas constant for water vapour
const satPressure0c = 6.112;
// C + celsiusToK -> K
const celsiusToK = 273.15;
const L$1 = -6.5e-3;
const g = 9.80665;

/**
 * Computes the temperature at the given pressure assuming dry processes.
 *
 * t0 is the starting temperature at p0 (degree Celsius).
 */
function dryLapse(p, tK0, p0) {
  return tK0 * Math.pow(p / p0, Rd / Cpd);
}


//to calculate isohume lines:
//1.  Obtain saturation vapor pressure at a specific temperature = partial pressure at a specific temp where the air will be saturated.
//2.  Mixing ratio:  Use the partial pressure where air will be saturated and the actual pressure to determine the degree of mixing,  thus what % of air is water.
//3.  Having the mixing ratio at the surface,  calculate the vapor pressure at different pressures.
//4.  Dewpoint temp can then be calculated with the vapor pressure.

// Computes the mixing ration of a gas.
function mixingRatio(partialPressure, totalPressure, molecularWeightRatio = epsilon) {
  return (molecularWeightRatio * partialPressure) / (totalPressure - partialPressure);
}

// Computes the saturation mixing ratio of water vapor.
function saturationMixingRatio(p, tK) {
  return mixingRatio(saturationVaporPressure(tK), p);
}

// Computes the saturation water vapor (partial) pressure
function saturationVaporPressure(tK) {
  const tC = tK - celsiusToK;
  return satPressure0c * Math.exp((17.67 * tC) / (tC + 243.5));
}

// Computes the temperature gradient assuming liquid saturation process.
function moistGradientT(p, tK) {
  const rs = saturationMixingRatio(p, tK);
  const n = Rd * tK + Lv * rs;
  const d = Cpd + (Math.pow(Lv, 2) * rs * epsilon) / (Rd * Math.pow(tK, 2));
  return (1 / p) * (n / d);
}

// Computes water vapor (partial) pressure.
function vaporPressure(p, mixing) {
  return (p * mixing) / (epsilon + mixing);
}

// Computes the ambient dewpoint given the vapor (partial) pressure.
function dewpoint(p) {
  const val = Math.log(p / satPressure0c);
  return celsiusToK + (243.5 * val) / (17.67 - val);
}

function getElevation(p, p0=1013.25) {
  const t0 = 288.15;
  //const p0 = 1013.25;
  return (t0 / L$1) * (Math.pow(p / p0, (-L$1 * Rd) / g) - 1);
}

function pressureFromElevation(e, refp=1013.25){
    e = e*3.28084;
    return Math.pow((-(e/145366.45 - 1)), 1/0.190284) * refp;
}


function parcelTrajectory(params, steps, sfcT, sfcP, sfcDewpoint) {

  //remove invalid or NaN values in params
  for (let i=0;  i< params.temp.length; i++){
    let inval=false;
    for (let p in params) if (!params[p][i] && params[p][i]!==0) inval=true;
    if (inval) for (let p in params) params[p].splice(i,1);
  }

  //console.log(params,steps, sfcT,sfcP,sfcDewpoint);

  const parcel = {};
  const dryGhs = [];
  const dryPressures = [];
  const dryTemps = [];  //dry temps from surface temp,  which can be greater than templine start
  const dryDewpoints = [];
  const dryTempsTempline = []; //templine start

  const mRatio = mixingRatio(saturationVaporPressure(sfcDewpoint), sfcP);

  const pToEl = scaleLog(params.level, params.gh);
  const minEl = pToEl(sfcP);
  const maxEl = Math.max(minEl, params.gh[params.gh.length - 1]);
  const stepEl = (maxEl - minEl) / steps;

  const moistLineFromEandT = (elevation, t) => {
  //this calculates a moist line from elev and temp to the intersection of the temp line if the intersection exists otherwise very high cloudtop
    const moistGhs=[], moistPressures=[], moistTemps=[];
    let previousP = pToEl.invert(elevation);
    for (; elevation < maxEl + stepEl; elevation += stepEl) {
      const p = pToEl.invert(elevation);
      t = t + (p - previousP) * moistGradientT(p, t);
      previousP = p;
      moistGhs.push(elevation);
      moistPressures.push(p);
      moistTemps.push(t);
    }
    let moist = zip(moistTemps, moistPressures);
    let cloudTop, pCloudTop;
    const equilibrium = firstIntersection(moistGhs, moistTemps, params.gh, params.temp);
    if (equilibrium) {
        cloudTop = equilibrium[0];
        pCloudTop = pToEl.invert(equilibrium[0]);
        moist = moist.filter((pt) => pt[1] >= pCloudTop);
        moist.push([equilibrium[1], pCloudTop]);
    } else { //does not intersect,  very high CBs
        cloudTop = 100000;
        pCloudTop = pToEl.invert(cloudTop);
    }
    return {moist, cloudTop, pCloudTop};
  };


  for (let elevation = minEl; elevation <= maxEl; elevation += stepEl) {
    const p = pToEl.invert(elevation);
    const t = dryLapse(p, sfcT, sfcP);
    const dp = dewpoint(vaporPressure(p, mRatio));
    dryGhs.push(elevation);
    dryPressures.push(p);
    dryTemps.push(t);        //dry adiabat line from templine surfc
    dryDewpoints.push(dp);   //isohume line from dewpoint line surfc

    const t2 =  dryLapse(p, params.temp[0], sfcP);
    dryTempsTempline.push(t2);
  }

  const cloudBase = firstIntersection(dryGhs, dryTemps, dryGhs, dryDewpoints);
  //intersection dry adiabat from surface temp to isohume from surface dewpoint,  if dp==surf temp,  then cloudBase will be null

  let thermalTop = firstIntersection(dryGhs, dryTemps, params.gh, params.temp);
  //intersection of dryadiabat from surface to templine.  this will be null if stable,  leaning to the right

  let LCL = firstIntersection(dryGhs, dryTempsTempline, dryGhs, dryDewpoints);
  //intersection dry adiabat from surface temp to isohume from surface dewpoint,  if dp==surf temp,  then cloudBase will be null

  let CCL=firstIntersection(dryGhs, dryDewpoints, params.gh, params.temp);
  //console.log(CCL, dryGhs, dryDewpoints, params.gh, params.temp );
  //intersection of isohume line with templine


  //console.log(cloudBase, thermalTop, LCL, CCL);

  if (LCL && LCL.length){
    parcel.LCL=LCL[0];
    let LCLp = pToEl.invert(LCL[0]);
    parcel.isohumeToDry =[].concat(
        zip(dryTempsTempline, dryPressures).filter(p => p[1] >= LCLp),
        [[LCL[1],LCLp]],
        zip(dryDewpoints, dryPressures).filter(p => p[1] >= LCLp).reverse()
    );
  }

  if (CCL && CCL.length){
    //parcel.CCL=CCL[0];
    let CCLp=pToEl.invert(CCL[0]);
    parcel.TCON=dryLapse(sfcP,CCL[1],CCLp);

    //check if dryTempsTCON crosses temp line at CCL,  if lower,  then inversion exists and TCON,  must be moved.
   /* const calcDryTempsTCON = () =>{
        let a = [];
        for (let elevation = minEl; elevation <= maxEl; elevation += stepEl) {  //line from isohume/temp intersection to TCON
            const t = dryLapse(pToEl.invert(elevation), parcel.TCON, sfcP);
            a.push(t);
        }
        return a;
    }  */

    let dryTempsTCON,  crossTemp = [-Infinity];
    for (; crossTemp[0] < CCL[0]; parcel.TCON+=0.5){
        dryTempsTCON = [];
        for (let elevation = minEl; elevation <= maxEl; elevation += stepEl) {  //line from isohume/temp intersection to TCON
            const t = dryLapse(pToEl.invert(elevation), parcel.TCON, sfcP);
            dryTempsTCON.push(t);
        }
        crossTemp = firstIntersection(dryGhs, dryTempsTCON, params.gh, params.temp) ;
    }

    parcel.TCON-=0.5;
    if (crossTemp[0] > CCL[0]) {
        CCL = firstIntersection(dryGhs, dryTempsTCON, dryGhs, dryDewpoints);
    }
    parcel.CCL=CCL[0];
    CCLp=pToEl.invert(CCL[0]);

    parcel.isohumeToTemp =[].concat(
        zip(dryDewpoints, dryPressures).filter(p => p[1] >= CCLp),
        [[CCL[1],CCLp]],
        zip(dryTempsTCON, dryPressures).filter(p => p[1] >= CCLp).reverse()
    );
    parcel.moistFromCCL = moistLineFromEandT(CCL[0],CCL[1]).moist;
  }

  parcel.surface = params.gh[0];


  if (!thermalTop) {
    return parcel;
  } else {
      parcel.origThermalTop=thermalTop[0];
  }

  if (thermalTop && cloudBase && cloudBase[0] < thermalTop[0]) {

    thermalTop = cloudBase;

    const pCloudBase = pToEl.invert(cloudBase[0]);

    Object.assign(
        parcel,
        moistLineFromEandT(cloudBase[0],cloudBase[1])   //add to parcel: moist = [[moistTemp,moistP]...],  cloudTop and pCloudTop.
    );

    const isohume = zip(dryDewpoints, dryPressures).filter((pt) => pt[1] > pCloudBase); //filter for pressures higher than cloudBase,  thus lower than cloudBase
    isohume.push([cloudBase[1], pCloudBase]);



    //parcel.pCloudTop = params.level[params.level.length - 1];



    //parcel.cloudTop = cloudTop;
    //parcel.pCloudTop = pCloudTop;

    //parcel.moist = moist;

    parcel.isohume = isohume;

  }

  let pThermalTop = pToEl.invert(thermalTop[0]) ;
  const dry = zip(dryTemps, dryPressures).filter((pt) => pt[1] > pThermalTop);
  dry.push([thermalTop[1], pThermalTop]);

  parcel.dry = dry;
  parcel.pThermalTop = pThermalTop;
  parcel.elevThermalTop = thermalTop[0];



  //console.log(parcel);
  return parcel;
}function lerp(v0, v1, weight) {
    return v0 + weight * (v1 - v0);
}
/////




const lookup = new Uint8Array(256);

for (let i = 0; i < 160; i++) {
    lookup[i] = clampIndex(24 * Math.floor((i + 12) / 16), 160);
}



// Compute the rain clouds cover.
// Output an object:
// - clouds: the clouds cover,
// - width & height: dimension of the cover data.
function computeClouds(ad, wdth=1, hght=200 ) {      ////added wdth and hght,  to improve performance   ///supply own hrAlt   altutude percentage distribution,  based on pressure levels
    // Compute clouds data.

    //console.log("WID",wdth,hght);

    /////////convert to windy format
    //ad must be sorted;

    //rel position 0 to 100
    const logscale = (x,d,r) =>{  //log scale function D3,  x is the value d is the domain [] and r is the range []
        let xlog=Math.log10(x),
            dlog=[Math.log10(d[0]),Math.log10(d[1])],
            delta_d=dlog[1]-dlog[0],
            delta_r=r[1]-r[0];
        return r[0] + ((xlog - dlog[0]) /delta_d) * delta_r;
    };

    let airData = {};
    let hrAltPressure=[], hrAlt=[];
    ad.forEach(a=>{
        if (!a.press) return;
        if(a.rh==void 0 && a.dwpt && a.temp) {
            a.rh=100*( Math.exp((17.625*a.dwpt)/(243.04+a.dwpt))/Math.exp((17.625*a.temp)/(243.04+a.temp)));     ///August-Roche-Magnus approximation.
        }
        if (a.rh && a.press>=100){
            let p=Math.round(a.press);
            airData[`rh-${p}h`]=[a.rh];
            hrAltPressure.push(p);
            hrAlt.push( logscale(p,[1050,100],[0,100]));
        }
    });

    //fix underground clouds,  add humidty 0 element in airData wehre the pressure is surfcace pressure +1:
    airData[`rh-${(hrAltPressure[0]+1)}h`] = [0];
    hrAlt.unshift(null,hrAlt[0]);
    hrAltPressure.unshift(null, hrAltPressure[0]+1);
    hrAltPressure.pop();  hrAltPressure.push(null);

    ///////////


    const numX = airData[`rh-${hrAltPressure[1]}h`].length;
    const numY = hrAltPressure.length;
    const rawClouds = new Array(numX * numY);

    for (let y = 0, index = 0; y < numY; ++y) {
        if (hrAltPressure[y] == null) {
            for (let x = 0; x < numX; ++x) {
                rawClouds[index++] = 0.0;
            }
        } else {
            const weight = hrAlt[y] * 0.01;
            const pAdd = lerp(-60, -70, weight);
            const pMul = lerp(0.025, 0.038, weight);
            const pPow = lerp(6, 4, weight);
            const pMul2 = 1 - 0.8 * Math.pow(weight, 0.7);
            const rhRow = airData[`rh-${hrAltPressure[y]}h`];
            for (let x = 0; x < numX; ++x) {
                const hr = Number(rhRow[x]);
                let f = Math.max(0.0, Math.min((hr + pAdd) * pMul, 1.0));
                f = Math.pow(f, pPow) * pMul2;
                rawClouds[index++] = f;
            }
        }
    }


    // Interpolate raw clouds.
    const sliceWidth = wdth || 10;
    const width = sliceWidth * numX;
    const height = hght || 300;
    const clouds = new Array(width * height);
    const kh = (height - 1) * 0.01;
    const dx2 = (sliceWidth + 1) >> 1;
    let heightLookupIndex = 2 * height;
    const heightLookup = new Array(heightLookupIndex);
    const buffer = new Array(16);
    let previousY;
    let currentY = height;

    for (let j = 0; j < numY - 1; ++j) {
        previousY = currentY;
        currentY = Math.round(height - 1 - hrAlt[j + 1] * kh);
        const j0 = numX * clampIndex(j + 2, numY);
        const j1 = numX * clampIndex(j + 1, numY);
        const j2 = numX * clampIndex(j + 0, numY);
        const j3 = numX * clampIndex(j - 1, numY);
        let previousX = 0;
        let currentX = dx2;
        const deltaY = previousY - currentY;
        const invDeltaY = 1.0 / deltaY;

        for (let i = 0; i < numX + 1; ++i) {
            if (i == 0 && deltaY > 0) {
                const ry = 1.0 / deltaY;
                for (let l = 0; l < deltaY; l++) {
                    heightLookup[--heightLookupIndex] = j;
                    heightLookup[--heightLookupIndex] = Math.round(10000 * ry * l);
                }
            }
            const i0 = clampIndex(i - 2, numX);
            const i1 = clampIndex(i - 1, numX);
            const i2 = clampIndex(i + 0, numX);
            const i3 = clampIndex(i + 1, numX);
            buffer[0] = rawClouds[j0 + i0];
            buffer[1] = rawClouds[j0 + i1];
            buffer[2] = rawClouds[j0 + i2];
            buffer[3] = rawClouds[j0 + i3];
            buffer[4] = rawClouds[j1 + i0];
            buffer[5] = rawClouds[j1 + i1];
            buffer[6] = rawClouds[j1 + i2];
            buffer[7] = rawClouds[j1 + i3];
            buffer[8] = rawClouds[j2 + i0];
            buffer[9] = rawClouds[j2 + i1];
            buffer[10] = rawClouds[j2 + i2];
            buffer[11] = rawClouds[j2 + i3];
            buffer[12] = rawClouds[j3 + i0];
            buffer[13] = rawClouds[j3 + i1];
            buffer[14] = rawClouds[j3 + i2];
            buffer[15] = rawClouds[j3 + i3];

            const topLeft = currentY * width + previousX;
            const dx = currentX - previousX;
            const fx = 1.0 / dx;

            for (let y = 0; y < deltaY; ++y) {
                let offset = topLeft + y * width;
                for (let x = 0; x < dx; ++x) {
                    const black = step(bicubicFiltering(buffer, fx * x, invDeltaY * y) * 160.0);
                    clouds[offset++] = 255 - black;
                }
            }

            previousX = currentX;
            currentX += sliceWidth;

            if (currentX > width) {
                currentX = width;
            }
        }
    }

    return { clouds, width, height };
}

function clampIndex(index, size) {
    return index < 0 ? 0 : index > size - 1 ? size - 1 : index;
}

function step(x) {
    return lookup[Math.floor(clampIndex(x, 160))];
}

function cubicInterpolate(y0, y1, y2, y3, m) {
    const a0 = -y0 * 0.5 + 3.0 * y1 * 0.5 - 3.0 * y2 * 0.5 + y3 * 0.5;
    const a1 = y0 - 5.0 * y1 * 0.5 + 2.0 * y2 - y3 * 0.5;
    const a2 = -y0 * 0.5 + y2 * 0.5;
    return a0 * m ** 3 + a1 * m ** 2 + a2 * m + y1;
}

function bicubicFiltering(m, s, t) {
    return cubicInterpolate(
        cubicInterpolate(m[0], m[1], m[2], m[3], s),
        cubicInterpolate(m[4], m[5], m[6], m[7], s),
        cubicInterpolate(m[8], m[9], m[10], m[11], s),
        cubicInterpolate(m[12], m[13], m[14], m[15], s),
        t
    );
}

// Draw the clouds on a canvas.
// This function is useful for debugging.
function cloudsToCanvas({ clouds, width, height, canvas }) {
    if (canvas == null) {
        canvas = document.createElement("canvas");
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    let imageData = ctx.getImageData(0, 0, width, height);
    let imgData = imageData.data;


    let srcOffset = 0;
    let dstOffset = 0;
    for (let x = 0; x < width; ++x) {
        for (let y = 0; y < height; ++y) {
            const color = clouds[srcOffset++];
            imgData[dstOffset++] = color;
            imgData[dstOffset++] = color;
            imgData[dstOffset++] = color;
            imgData[dstOffset++] = color < 245 ? 255 : 0;
        }
    }


    ctx.putImageData(imageData, 0, 0);
    ctx.drawImage(canvas, 0, 0, width, height);

    return canvas;
}

var clouds = {computeClouds,  cloudsToCanvas};////Original code from:

/**
 * SkewT v1.1.0
 * 2016 David Félix - dfelix@live.com.pt
 *
 * Dependency:
 * d3.v3.min.js from https://d3js.org/
 *
 */

window.SkewT = function(div, {isTouchDevice, gradient=45, topp=50, parctempShift=2 }={} ) {

    var _this=this;
    //properties used in calculations
    var wrapper = d3.select(div);
    var width = parseInt(wrapper.style('width'), 10);
    var margin = {top: 10, right: 25, bottom: 10, left: 25}; //container margins
    var deg2rad = (Math.PI/180);
    //var gradient = 46;
    var adjustGradient=false;
    var tan;
    var basep = 1050;
    //var topp = 50;
    var pIncrement=-50;
    var midtemp=0, temprange=60;
    var xOffset=0;
    //var parctemp;
    var steph = getElevation(topp)/30;
    var moving = false;

    var K0=273.15; //Kelvin of 0 deg

    var selectedSkewt;
    var currentY = null;//used to store y position of tooltip,  so filled at correct position of unit changed.

    var plines = [1000,950,925,900,850,800,700,600,500,400,300,250,200,150,100,50];

    var pticks = [], tickInterval=25;
    for (let i=plines[0]+tickInterval; i>plines[plines.length-1]; i-=tickInterval) pticks.push(i);

    var altticks = [];
    for (let i=0; i<20000; i+=(10000 / 3.28084)) altticks.push(pressureFromElevation(i));
    //console.log(altticks);

    var barbsize = 15;   /////
    // functions for Scales and axes. Note the inverted domain for the y-scale: bigger is up!
    var r = d3.scaleLinear().range([0,300]).domain([0,150]);
    d3.scaleLinear();
    var bisectTemp = d3.bisector(function(d) { return d.press; }).left; // bisector function for tooltips
    var w, h, x, y, xAxis, yAxis, yAxis2, yAxis3;
    var dataReversed = [];
    var dataAr = [];
    //aux
    var unitSpd = "kt"; // or kmh
    var unitAlt ="m";

    if (isTouchDevice === void 0){
        if (L && L.version) {  //check if leaflet is loaded globally
            if (L.Browser.mobile) isTouchDevice = true;
        } else {
            isTouchDevice =  ('ontouchstart' in window)   ||
                (navigator.maxTouchPoints > 0) ||  (navigator.msMaxTouchPoints > 0);
        }
    }
    //console.log("this is a touch device:", isTouchDevice);



    //containers
    var cloudContainer = wrapper.append("div").attr("class","cloud-container");

    var svg = wrapper.append("svg").attr("class", "mainsvg");	 //main svg
    var controls = wrapper.append("div").attr("class","controls fnt");
    var valuesContainer = wrapper.append("div").attr("class","controls fnt");
    var rangeContainer = wrapper.append("div").attr("class","range-container fnt");
    var rangeContainer2 = wrapper.append("div").attr("class","range-container-extra fnt");
    var container = svg.append("g");//.attr("id", "container"); //container
    var skewtbg = container.append("g").attr("class", "skewtbg");//.attr("id", "skewtbg");//background
    var skewtgroup = container.append("g").attr("class", "skewt"); // put skewt lines in this group  (class skewt not used)
    var barbgroup  = container.append("g").attr("class", "windbarb"); // put barbs in this group
    var tooltipgroup = container.append("g").attr("class", "tooltips");      //class tooltps not used
    var tooltipRect = container.append("rect").attr("class", "overlay");//.attr("id",  "tooltipRect")
    var cloudCanvas1 =  cloudContainer.append("canvas").attr("width",1).attr("height",200).attr("class","cloud"); //original = width 10 and height 300
    this.cloudRef1 = cloudCanvas1.node();
    var cloudCanvas2 =  cloudContainer.append("canvas").attr("width",1).attr("height",200).attr("class","cloud");
    this.cloudRef2 = cloudCanvas2.node();


    function getFlags(f){
        let flags={
            "131072": "surface",
            "65536": "standard level",
            "32768": "tropopause level",
            "16384": "maximum wind level",
            "8192": "significant temperature level",
            "4096": "significant humidity level",
            "2048": "significant wind level",
            "1024": "beginning of missing temperature data",
            "512": "end of missing temperature data",
            "256": "beginning of missing humidity data",
            "128": "end of missing humidity data",
            "64": "beginning of missing wind data",
            "32": "end of missing wind data",
            "16": "top of wind sounding",
            "8": "level determined by regional decision",
            "4": "reserved",
            "2": "pressure level vertical coordinate"
        };

        let foundflags=[];
        let decode=(a,i) => {
            if (a%2) foundflags.push(flags[1<<i]);
            if (a) decode(a>>1,i+1);
        };
        decode(f,0);
        //console.log(foundflags);
        return foundflags;
    }



    //local functions
    function setVariables() {
        width = parseInt(wrapper.style('width'), 10) -10; // tofix: using -10 to prevent x overflow
        w = width - margin.left - margin.right;
        h = width - margin.top - margin.bottom;
        tan = Math.tan((gradient || 55) *deg2rad);
        x = d3.scaleLinear().range([-w/2, w+w/2]).domain([midtemp-temprange*2 , midtemp+temprange*2]);   //range is w*2
        y = d3.scaleLog().range([0, h]).domain([topp, basep]);

        xAxis = d3.axisBottom(x).tickSize(0,0).ticks(20);//.orient("bottom");
        yAxis = d3.axisLeft(y).tickSize(0,0).tickValues(plines.filter(p=> (p%100==0 || p==50 || p==150) )).tickFormat(d3.format(".0d"));//.orient("left");
        yAxis2 = d3.axisRight(y).tickSize(5,0).tickValues(pticks);//.orient("right");
        yAxis3 = d3.axisLeft(y).tickSize(2,0).tickValues(altticks);
    }

    function convSpd(msvalue, unit) {
        switch(unit) {
            case "kt":
                return msvalue*1.943844492;
            case "kmh":
                return msvalue*3.6;
            default:
                return msvalue;
        }
    }
    function convAlt(v, unit) {
        switch(unit) {
            case "m":
                return Math.round(v) +unit;
            case "f":
                return Math.round(v*3.28084) +"ft";
            default:
                return v;
        }
    }

    //assigns d3 events
    d3.select(window).on('resize', resize);

    function resize() {
        skewtbg.selectAll("*").remove();
        setVariables();
        svg.attr("width", w + margin.right + margin.left).attr("height", h + margin.top + margin.bottom);
        container.attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        drawBackground();
        dataAr.forEach(d=> {
            plot(d.data,{add:true, select:false});
        } );//redraw each plot
        if(selectedSkewt) selectSkewt(selectedSkewt.data);
        shiftXAxis();
        tooltipRect.attr("width", w).attr("height", h);

        cloudContainer.style("left", (margin.left+2) +"px").style("top", margin.top+"px").style("height", h+"px");
        let canTop=y(100);  //top of canvas for pressure 100
        cloudCanvas1.style("left","0px").style( "top",canTop+"px").style("height",(h-canTop)+"px");
        cloudCanvas2.style("left","10px").style("top",canTop+"px").style("height",(h-canTop)+"px");
    }

    let lines={};
    let clipper;
    let xAxisValues;
    //let tempLine,  tempdewLine;  now in object


    var drawBackground = function() {

        // Add clipping path
        clipper=skewtbg.append("clipPath")
            .attr("id", "clipper")
            .append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", w)
            .attr("height", h);

        // Skewed temperature lines
        lines.temp = skewtbg.selectAll("templine")
            .data(d3.scaleLinear().domain([midtemp-temprange*3,midtemp+temprange]).ticks(24))
            .enter().append("line")
            .attr("x1", d => x(d)-0.5 + (y(basep)-y(topp))/tan)
            .attr("x2", d => x(d)-0.5)
            .attr("y1", 0)
            .attr("y2", h)
            .attr("class",  d=> d == 0 ?  `tempzero ${buttons["Temp"].hi?"highlight-line":""}`: `templine ${buttons["Temp"].hi?"highlight-line":""}`)
            .attr("clip-path", "url(#clipper)");
            //.attr("transform", "translate(0," + h + ") skewX(-30)");


        /*
        let topTempOffset = x.invert(h/tan + w/2);
        let elevDiff = (atm.getElevation(topp) - atm.getElevation(basep));// * 3.28084;
        let km11y =  h*(11000 - atm.getElevation(basep)) / elevDiff;
        let tempOffset11 = x.invert(km11y/tan + w/2);

        console.log("top temp shift", tempOffset11, x.invert(km11y/tan)   )  ;//(elevDiff/304.8));  //deg per 1000ft
       */

        var pp = moving?
                [basep, basep-(basep-topp)*0.25,basep-(basep-topp)*0.5,basep-(basep-topp)*0.75, topp]
                : d3.range(basep,topp-50 ,pIncrement);


        let pAt11km= pressureFromElevation(11000);
        //console.log(pAt11km);

        var elrFx = d3.line()
            .curve(d3.curveLinear)
            .x(function(d,i) {
                let t= d > pAt11km? 15 - getElevation(d) * 0.00649 : -56.5;   //6.49 deg per 1000 m
                return x(t) + (y(basep)-y(d))/tan ;
            })
            .y(function(d,i) { return y(d)} );

        lines.elr = skewtbg.selectAll("elr")
            .data([plines.filter(p=> p> pAt11km ).concat([pAt11km,50])])
            .enter().append("path")
            .attr("d", elrFx)
            .attr("clip-path", "url(#clipper)")
            .attr("class", `elr ${showElr ? "highlight-line":""}`);

        // Logarithmic pressure lines
        lines.pressure = skewtbg.selectAll("pressureline")
            .data(plines)
            .enter().append("line")
            .attr("x1", - w)
            .attr("x2", 2*w)
            .attr("y1", y )
            .attr("y2", y)
            .attr("clip-path", "url(#clipper)")
            .attr("class", `pressure ${buttons["Pressure"].hi?"highlight-line":""}`);

        // create array to plot adiabats

        var dryad = d3.scaleLinear().domain([midtemp-temprange*2,midtemp+temprange*4]).ticks(36);

        var all = [];

        for (var i=0; i<dryad.length; i++) {
            var z = [];
            for (var j=0; j<pp.length; j++) { z.push(dryad[i]); }
            all.push(z);
        }


        var drylineFx = d3.line()
            .curve(d3.curveLinear)
            .x(function(d,i) {
                return x(
                        dryLapse(pp[i], K0 + d, basep) - K0
                    ) + (y(basep)-y(pp[i]))/tan;})
            .y(function(d,i) { return y(pp[i])} );

        // Draw dry adiabats
        lines.dryadiabat = skewtbg.selectAll("dryadiabatline")
            .data(all)
            .enter().append("path")
            .attr("class", `dryadiabat  ${buttons["Dry Adiabat"].hi?"highlight-line":""}` )
            .attr("clip-path", "url(#clipper)")
            .attr("d", drylineFx);

        // moist adiabat fx
        var temp;
        var moistlineFx = d3.line()
            .curve(d3.curveLinear)
            .x(function(d,i) {
                temp= i==0? K0 + d : ((temp + moistGradientT(pp[i], temp) * (moving?(topp-basep)/4:pIncrement)) );
                return x(temp - K0) + (y(basep)-y(pp[i]))/tan;
            })
            .y(function(d,i) { return y(pp[i])} );

        // Draw moist adiabats
        lines.moistadiabat = skewtbg.selectAll("moistadiabatline")
            .data(all)
            .enter().append("path")
            .attr("class", `moistadiabat ${buttons["Moist Adiabat"].hi?"highlight-line":""}`)
            .attr("clip-path", "url(#clipper)")
            .attr("d", moistlineFx);

        // isohume fx
        var mixingRatio$1;
        var isohumeFx = d3.line()
            .curve(d3.curveLinear)
            .x(function(d,i) {
                //console.log(d);
                if (i==0) mixingRatio$1 = mixingRatio(saturationVaporPressure(d + K0), pp[i]);
                temp = dewpoint(vaporPressure(pp[i], mixingRatio$1));
                return x(temp - K0) + (y(basep)-y(pp[i]))/tan;
            })
            .y(function(d,i) { return y(pp[i])} );

        // Draw isohumes
        lines.isohume = skewtbg.selectAll("isohumeline")
            .data(all)
            .enter().append("path")
            .attr("class", `isohume ${buttons["Isohume"].hi?"highlight-line":""}` )
            .attr("clip-path", "url(#clipper)")
            .attr("d", isohumeFx);

        // Line along right edge of plot
        skewtbg.append("line")
            .attr("x1", w-0.5)
            .attr("x2", w-0.5)
            .attr("y1", 0)
            .attr("y2", h)
            .attr("class", "gridline");

        // Add axes
        xAxisValues=skewtbg.append("g").attr("class", "x axis").attr("transform", "translate(0," + (h-0.5) + ")").call(xAxis).attr("clip-path", "url(#clipper)")  ;
        skewtbg.append("g").attr("class", "y axis").attr("transform", "translate(-0.5,0)").call(yAxis);
        skewtbg.append("g").attr("class", "y axis ticks").attr("transform", "translate(-0.5,0)").call(yAxis2);
        skewtbg.append("g").attr("class", "y axis hght-ticks").attr("transform", "translate(-0.5,0)").call(yAxis3);
    };

    var makeBarbTemplates = function(){
        var speeds = d3.range(5,205,5);
        var barbdef = container.append('defs');
        speeds.forEach(function(d) {
            var thisbarb = barbdef.append('g').attr('id', 'barb'+d);
            var flags = Math.floor(d/50);
            var pennants = Math.floor((d - flags*50)/10);
            var halfpennants = Math.floor((d - flags*50 - pennants*10)/5);
            var px = barbsize/2;
            // Draw wind barb stems
            thisbarb.append("line").attr("x1", 0).attr("x2", 0).attr("y1", -barbsize/2).attr("y2", barbsize/2);
            // Draw wind barb flags and pennants for each stem
            for (var i=0; i<flags; i++) {
                thisbarb.append("polyline")
                    .attr("points", "0,"+px+" -6,"+(px)+" 0,"+(px-2))
                    .attr("class", "flag");
                px -= 5;
            }
            // Draw pennants on each barb
            for (i=0; i<pennants; i++) {
                thisbarb.append("line")
                    .attr("x1", 0)
                    .attr("x2", -6)
                    .attr("y1", px)
                    .attr("y2", px+2);
                px -= 3;
            }
            // Draw half-pennants on each barb
            for (i=0; i<halfpennants; i++) {
                thisbarb.append("line")
                    .attr("x1", 0)
                    .attr("x2", -3)
                    .attr("y1", px)
                    .attr("y2", px+1);
                px -= 3;
            }
        });
    };


    var shiftXAxis = function(){
        clipper.attr("x", -xOffset);
        xAxisValues.attr("transform", `translate(${xOffset}, ${h-0.5} )`);
        for (let p in lines) {
            lines[p].attr("transform",`translate(${xOffset},0)`);
        }        dataAr.forEach(d=>{
            for (let p in d.lines){
                d.lines[p].attr("transform",`translate(${xOffset},0)`);
            }
        });
    };


    var drawToolTips = function() {

        // Draw tooltips
        var tmpcfocus = tooltipgroup.append("g").attr("class", "focus tmpc").style("display", "none");
        tmpcfocus.append("circle").attr("r", 4);
        tmpcfocus.append("text").attr("x", 9).attr("dy", ".35em");

        var dwpcfocus = tooltipgroup.append("g").attr("class", "focus dwpc").style("display", "none");
        dwpcfocus.append("circle").attr("r", 4);
        dwpcfocus.append("text").attr("x", -9).attr("text-anchor", "end").attr("dy", ".35em");

        var hghtfocus = tooltipgroup.append("g").attr("class", "focus").style("display", "none");
        var hght1 = hghtfocus.append("text").attr("x", "0.8em").attr("text-anchor", "start").attr("dy", ".35em");
        var hght2 = hghtfocus.append("text").attr("x", "0.8em").attr("text-anchor", "start").attr("dy", "-0.65em").style("fill","blue");

        var wspdfocus = tooltipgroup.append("g").attr("class", "focus windspeed").style("display", "none");
        var wspd1 = wspdfocus.append("text").attr("x", "0.8em").attr("text-anchor", "start").attr("dy", ".35em");
        var wspd2 = wspdfocus.append("text").attr("x", "0.8em").attr("text-anchor", "start").attr("dy", "-0.65em").style("fill","red") ;
        var wspd3 = wspdfocus.append("text").attr("class","skewt-wind-arrow").html("&#8681;") ;
        var wspd4 = wspdfocus.append("text").attr("y", "1em").attr("text-anchor", "start").style("fill","rgba(0,0,0,0.3)").style("font-size","10px") ;
        //console.log(wspdfocus)

        let startX=null;

        function start(e){
            [tmpcfocus, dwpcfocus, hghtfocus, wspdfocus].forEach(e=>e.style("display", null));
            move.call(tooltipRect.node());
            startX=d3.mouse(this)[0]-xOffset;
        }

        function end(e){
            startX=null;
            //console.log("end drag");
        }

        const hideTooltips = () =>{
            [tmpcfocus, dwpcfocus, hghtfocus, wspdfocus].forEach(e=>e.style("display", "none"));
             currentY=null;
        };

        const showTooltips = () =>{
            [tmpcfocus, dwpcfocus, hghtfocus, wspdfocus].forEach(e=>e.style("display", null));
        };

        const move2P = (y0) => {
            var i = bisectTemp(dataReversed, y0, 1, dataReversed.length-1);
            var d0 = dataReversed[i - 1];
            var d1 = dataReversed[i];
            var d = y0 - d0.press > d1.press - y0 ? d1 : d0;
            currentY=y0;

            tmpcfocus.attr("transform", "translate(" +  (xOffset + x(d.temp) + (y(basep)-y(d.press))/tan)+ "," + y(d.press) + ")");
            dwpcfocus.attr("transform", "translate(" +  (xOffset + x(d.dwpt) + (y(basep)-y(d.press))/tan)+ "," + y(d.press) + ")");

            hghtfocus.attr("transform", "translate(0," + y(d.press) + ")");
            hght1.html("&nbsp;&nbsp;&nbsp;"+convAlt(d.hght, unitAlt)); 	//hgt or hghtagl ???
            hght2.html("&nbsp;&nbsp;&nbsp;"+Math.round(d.dwpt)+"&#176;C");

            wspdfocus.attr("transform", "translate(" + (w-60)  + "," + y(d.press) + ")");
            wspd1.html(isNaN(d.wspd)?"" : (Math.round(convSpd(d.wspd)*10)/10 + " " + unitSpd));
            wspd2.html(Math.round(d.temp)+"&#176;C");
            wspd3.style("transform",`rotate(${d.wdir}deg)`);
            wspd4.html(d.flags?getFlags(d.flags).map(f=>`<tspan x="-8em" dy="0.8em">${f}</tspan>`).join() : "");
            //console.log(     getFlags(d.flags).join("<br>"));

            if (this.cbf) this.cbf(d.press);
        };

        function move(e){
            var newX=d3.mouse(this)[0];
            if (startX!==null){
                xOffset=-(startX-newX);
                shiftXAxis();
            }
            var y0 = y.invert(d3.mouse(this)[1]); // get y value of mouse pointer in pressure space
            move2P(y0);
        }

        tooltipRect
            .attr("width", w)
            .attr("height", h);

            //.on("mouseover", start)
            //.on("mouseout",  end)
            //.on("mousemove", move)
        if (!isTouchDevice) {

            tooltipRect.call(d3.drag().on("start", start).on("drag",move).on("end", end));
        } else {
            tooltipRect
            //tooltipRect.node().addEventListener('touchstart',start, true)
            //tooltipRect.node().addEventListener('touchmove',move, true)
            //tooltipRect.node().addEventListener('touchend',end, true)
            .on('touchstart', start)
            .on('touchmove',move)
            .on('touchend',end);
        }

        Object.assign(this,{move2P, hideTooltips, showTooltips});
    };



    var drawParcelTraj = function(dataObj){

        let {data, parctemp}=dataObj;

        let pt = parcelTrajectory(
            { level:data.map(e=>e.press), gh: data.map(e=>e.hght),  temp:  data.map(e=>e.temp+ K0) },
            moving? 10:40,
            parctemp + K0 ,
            data[0].press,
            data[0].dwpt+ K0
        );

        //draw lines
        var parctrajFx = d3.line()
            .curve(d3.curveLinear)
            .x(function(d,i) { return x(d.t) + (y(basep)-y(d.p))/tan; })
            .y(function(d,i) { return y(d.p); });

        //let parcLines={dry:[], moist:[], isohumeToDry:[], isohumeToTemp:[], moistFromCCL:[],  TCONline:[], thrm:[], cloud:[]};

        let parcLines={parcel:[], LCL:[], CCL:[], TCON:[],  "THRM top":[], "CLD top":[]};

        for (let p in parcLines){
            if(dataObj.lines[p]) dataObj.lines[p].remove();

            let line=[], press;
            switch (p){
                case "parcel":
                    if (pt.dry) line.push(pt.dry);
                    if (pt.moist) line.push(pt.moist);
                break;
                case "TCON":
                    let t = pt.TCON;
                    line = t !== void 0? [[[t, basep],[t, topp]]]: [];
                break;
                case "LCL":
                    if (pt.isohumeToDry)  line.push(pt.isohumeToDry);
                break;
                case "CCL":
                    if (pt.isohumeToTemp) line.push(pt.isohumeToTemp);
                    if (pt.moistFromCCL) line.push(pt.moistFromCCL);
                break;
                case "THRM top":
                    press= pt.pThermalTop;
                    if (press) line=[[[0,press],[400,press]]];
                break;
                case "CLD top":
                    press= pt.pCloudTop;
                    if (press) line=[[[0,press],[400,press]]];
                break;
            }

            if (line) parcLines[p]= line.map(e => e.map( ee=> { return {t:ee[0]- K0, p:ee[1]} }));

            dataObj.lines[p] = skewtgroup
                .selectAll(p)
                .data(parcLines[p]).enter().append("path")
                .attr("class", `${p=="parcel"?"parcel":"cond-level"} ${selectedSkewt && data==selectedSkewt.data && (p=="parcel" || values[p].hi)?"highlight-line":""}`)
                .attr("clip-path", "url(#clipper)")
                .attr("d", parctrajFx)
                .attr("transform",`translate(${xOffset},0)`);
        }

        //update values
        for (let p in values){
            let v=pt[p=="CLD top"?"cloudTop":p=="THRM top"?"elevThermalTop":p];
            let CLDtopHi;
            if (p=="CLD top" && v==100000) {
                v=data[data.length-1].hght;
                CLDtopHi=true;
            }
            let txt=`${(p[0].toUpperCase()+p.slice(1)).replace(" ","&nbsp;")}:<br><span style="font-size:1.1em;"> ${!v? ""  : p=="TCON"? (v- K0).toFixed(1)+"&#176;C": (CLDtopHi?"> ":"")+convAlt(v,unitAlt)}</span>`;
            values[p].val.html(txt);
        }
    };

    var selectSkewt = function(data){  //use the data,  then can be found from the outside by using data obj ref
        dataAr.forEach(d=>{
            let found= d.data==data;
            for (let p in d.lines){

                d.lines[p].classed("highlight-line", found  && (!values[p]  || values[p].hi) );
            }
            if (found){
                selectedSkewt=d;
                dataReversed=[].concat(d.data).reverse();
                ranges.parctemp.input.node().value = ranges.parctemp.value = d.parctemp = Math.round(d.parctemp*10)/10;
                ranges.parctemp.valueDiv.html(html4range(d.parctemp,"parctemp"));
            }
        });
        _this.hideTooltips();
    };



    //if in options:  add,  add new plot,
    //if select,  set selected ix and highlight. if select false,  must hightlight separtely.
    //ixShift used to shift to the right,  used when you want to keep position 0 open.
    //max is the max number of plots, by default at the moment 2,
    var plot = function(s, {add, select, ixShift=0, max=2}={} ){

        if(s.length==0) return;

        let ix=0;  //index of the plot, there may be more than one,  to shift barbs and make clouds on canvas

        if (!add){
            dataAr.forEach(d=>{  //clear all plots
                for (let p in d.lines) d.lines[p].remove();
            });
            dataAr=[];
            [1,2].forEach(c=>{
                let ctx = _this["cloudRef"+c].getContext("2d");
                ctx.clearRect(0, 0, 10, 200);
            });
        }

        let dataObj = dataAr.find(d=>d.data==s);

        let data;
        if (!dataObj) {
            let parctemp=Math.round((s[0].temp + ranges.parctempShift.value)*10)/10;
            data=s;//.filter(d=> d.temp > -1000 && d.dwpt > -1000);      //do not filter here,  do not change obj ref
            ix = dataAr.push({data, parctemp, lines:{}})  -1;
            dataObj = dataAr[ix];
            if(ix>=max) {
                console.log("more than max plots added");
                ix--;
                setTimeout((ix)=>{
                    if (dataAr.length>max) _this.removePlot(dataAr[ix].data);
                },1000,ix);
            }
        } else {
            ix = dataAr.indexOf(dataObj);
            data=dataObj.data;
            for (let p in dataObj.lines) dataObj.lines[p].remove();
        }

        //reset parctemp range if this is the selected range
        if (select){
            ranges.parctemp.input.node().value = ranges.parctemp.value = dataObj.parctemp  ;
            ranges.parctemp.valueDiv.html(html4range(dataObj.parctemp,"parctemp"));
        }

        //skew-t stuff
        let filteredData=data.filter(d=> d.temp > -1000 && d.dwpt > -1000);
        var skewtlines=[filteredData];
        if (data.length>50 && moving){
            let prev=-1;
            skewtlines=[filteredData.filter((e,i,a)=>{
                let n=Math.floor(i*50/(a.length-1));
                if (n>prev){
                    prev=n;
                    return true;
                }
            })];
        }

        var templineFx = d3.line().curve(d3.curveLinear).x(function(d,i) { return x(d.temp) + (y(basep)-y(d.press))/tan; }).y(function(d,i) { return y(d.press); });
        dataObj.lines.tempLine = skewtgroup
            .selectAll("templines")
            .data(skewtlines).enter().append("path")
            .attr("class", "temp")//(d,i)=> `temp ${i<10?"skline":"mean"}` )
            .attr("clip-path", "url(#clipper)")
            .attr("d", templineFx);

        if (data[0].dwpt){
            var tempdewlineFx = d3.line().curve(d3.curveLinear).x(function(d,i) { return x(d.dwpt) + (y(basep)-y(d.press))/tan; }).y(function(d,i) { return y(d.press); });
            dataObj.lines.tempdewLine = skewtgroup
                .selectAll("tempdewlines")
                .data(skewtlines).enter().append("path")
                .attr("class", "dwpt")//(d,i)=>`dwpt ${i<10?"skline":"mean"}` )
                .attr("clip-path", "url(#clipper)")
                .attr("d", tempdewlineFx);

            drawParcelTraj(dataObj);
        }

        let siglines=data
                .filter((d,i,a,f) => d.flags && (f=getFlags(d.flags), f.includes("tropopause level") || f.includes("surface"))? d.press: false)
                .map((d,i,a,f) => (f=getFlags(d.flags), {press:d.press, classes: f.map(e=> e.replace(/ /g,"-")).join(" ")  }));

        dataObj.lines.siglines = skewtbg.selectAll("siglines")
            .data(siglines)
            .enter().append("line")
            .attr("x1", - w).attr("x2", 2*w)
            .attr("y1", d=>y(d.press)).attr("y2", d=>y(d.press))
            .attr("clip-path", "url(#clipper)")
            .attr("class", d=> `sigline ${d.classes}`);


        //barbs stuff

        var lastH=-300;
        //filter barbs to be valid and not too crowded
        var barbs = skewtlines[0].filter(function(d) {
            if (d.hght>lastH+steph && (d.wspd || d.wspd===0) && d.press >= topp) lastH=d.hght;
            return d.hght==lastH;
        });

        dataObj.lines.barbs = barbgroup.append("svg").attr("class","barblines");//.attr("transform","translate(30,80)");
        dataObj.lines.barbs.selectAll("barbs")
            .data(barbs).enter().append("use")
            .attr("href", function (d) { return "#barb"+Math.round(convSpd(d.wspd, "kt")/5)*5; }) // 0,5,10,15,... always in kt
            .attr("transform", function(d) { return "translate("+(w + 15 * (ix + ixShift)) +","+y(d.press)+") rotate("+ (d.wdir+180)+")"; });


        ////clouds
        let clouddata=clouds.computeClouds(data);
        clouddata.canvas= _this["cloudRef"+(ix + ixShift + 1)];
        clouds.cloudsToCanvas(clouddata);
        //////

        if (select || dataAr.length==1){
            selectSkewt(dataObj.data);
        }
        shiftXAxis();

        return dataAr.length;
    };


    //controls
    var buttons = {"Dry Adiabat":{},"Moist Adiabat":{},"Isohume":{},"Temp":{},"Pressure":{}};
    for (let p in buttons){
        let b = buttons[p];
        b.hi = false;
        b.el=controls.append("div").attr("class","buttons").text(p).on("click", ()=>{
            b.hi=!b.hi;
            b.el.node().classList[b.hi?"add":"remove"]("clicked");
            let line=p.replace(" ","").toLowerCase();
            lines[line]._groups[0].forEach(p=>p.classList[b.hi?"add":"remove"]("highlight-line"));
        });
    }
    //values
    var values = {
        "surface":{},
        "LCL":{hi:true},
        "CCL":{hi:true},
        "TCON":{hi:false},
        "THRM top":{hi:false},
        "CLD top":{hi:false}
    };

    for (let p in values){
        let b = values[p];
        b.val=valuesContainer.append("div").attr("class",`buttons ${p=="surface"?"noclick":""} ${b.hi?"clicked":""}`).html(p+":");
        if (/CCL|LCL|TCON|THRM top|CLD top/.test(p)){
            b.val.on("click", ()=>{
                b.hi=!b.hi;
                b.val.node().classList[b.hi?"add":"remove"]("clicked");
                selectedSkewt.lines[p]._groups[0].forEach(p=>p.classList[b.hi?"add":"remove"]("highlight-line"));
            });
        }

    }

    let ranges= {
        parctemp:{value: 10, step:0.1, min:-50, max: 50},
        topp:{ min:50, max:900, step: 25, value: topp},
        parctempShift: {min:-5, step:0.1, max:10, value: parctempShift},
        gradient:{min:0, max:85, step:1,  value: gradient},
    //    midtemp:{value:0, step:2, min:-50, max:50},

    };

    const unit4range = p => p=="gradient"?"&#176":p=="topp"?"hPa":"&#176;C";

    const html4range = (v,p) =>{
        let html="";
        if (p=="parctempShift" && r.value>=0) html += "+";
        html +=  (p=="gradient" || p=="topp"? Math.round(v): Math.round(v*10)/10)  + unit4range(p);
        if (p=="parctemp"){
            let shift=selectedSkewt?(Math.round((v - selectedSkewt.data[0].temp)*10)/10):parctempShift;
            html+=" <span style='font-size:0.8em'>&nbsp;" + (shift>0?"+":"")+shift+"</span>";
        }
        return html;
    };

    for (let p in ranges){

        let contnr= p=="parctemp"||p=="topp"? rangeContainer:rangeContainer2;

        let r=ranges[p];
        r.valueDiv = contnr.append("div").attr("class","skewt-range-des").html(p=="gradient"?"Gradient:":p=="topp"?"Top P:":p=="parctemp"?"Parcel T:":"Parcel T Shift:");
        r.valueDiv = contnr.append("div").attr("class","skewt-range-val").html(html4range(r.value, p));
        r.input =    contnr.append("input").attr("type","range").attr("min",r.min).attr("max",r.max).attr("step",r.step).attr("value",p=="gradient"?90-r.value: r.value).attr("class","skewt-ranges")
        .on("input",(a,b,c)=>{

            _this.hideTooltips();
            r.value=+c[0].value;

            if(p=="gradient") {
                gradient = r.value = 90-r.value;
                showErlFor2Sec(0,0,r.input);
            }
            if(p=="topp"){
                showErlFor2Sec(0,0,r.input);
                let pph=y(basep)-y(topp);
                topp= r.value;
                let ph=y(basep)-y(topp);
                pIncrement=topp>500?-25:-50;
                if(adjustGradient){
                    ranges.gradient.value = gradient = Math.atan(Math.tan(gradient*deg2rad) * pph/ph)/deg2rad;
                    ranges.gradient.input.node().value = 90-gradient;
                    ranges.gradient.valueDiv.html(html4range(gradient, "gradient"));
                } else {
                    temprange*= ph/pph;
                    setVariables();
                }
                steph = getElevation(topp)/30;
            }
            if(p=="parctempShift"){
                parctempShift=r.value;
            }

            r.valueDiv.html(html4range(r.value, p));

            clearTimeout(moving);
            moving=setTimeout(()=>{
                moving=false;
                if(p=="parctemp"){
                    drawParcelTraj(selectedSkewt);   //vale already set
                } else  {
                    resize();
                }
            },1000);

            if(p=="parctemp"){
                selectedSkewt.parctemp = r.value;
                drawParcelTraj(selectedSkewt);
            } else {
                resize();
            }

            this.cbfRange({topp,gradient,parctempShift});

        });

        contnr.append("div").attr("class","flex-break");
    }

    let showElr;
    const showErlFor2Sec=(a,b,target)=>{
        target = target[0] || target.node();
        lines.elr.classed("highlight-line", true);
        clearTimeout(showElr);
        showElr=null;
        showElr = setTimeout(()=>{
            target.blur();
            lines.elr.classed("highlight-line", showElr=null );  //background may be drawn again
        }, 1000);
    };

    ranges.gradient.input.on("focus", showErlFor2Sec);
    ranges.topp.input.on("focus", showErlFor2Sec);

    let cbSpan = rangeContainer2.append("span").attr("class","checkbox-container");
    cbSpan.append("input").attr("type","checkbox").on("click",(a,b,e)=>{
        adjustGradient= e[0].checked;
    });
    cbSpan.append("span").attr("class","skewt-checkbox-text").html("Maintain temp range on X-axis when zooming");

    rangeContainer2.append("span").attr("class","skewt-checkbox-text").style("line-height","22px").html("Select alt units: ");

    var units = {"meter":{},"feet":{}};
    for (let p in units){
        units[p].hi = p[0]==unitAlt;
        units[p].el=rangeContainer2.append("div").attr("class","buttons units"+(unitAlt==p[0]?" clicked":"")).text(p).on("click", ()=>{
            for (let p2 in units) {
                units[p2].hi= p==p2;
                units[p2].el.node().classList[units[p2].hi?"add":"remove"]("clicked");
            }
            unitAlt=p[0];
            //console.log(unitAlt);
            if(currentY!==null) _this.move2P(currentY);
            drawParcelTraj(selectedSkewt);
        });
    }

    var removePlot = function(s){
        let dataObj=dataAr.find(d=>d.data==s);
        if (!dataObj) return;
        for (let p in dataObj.lines){
            dataObj.lines[p].remove();
        }
        dataAr.splice(dataAr.indexOf(dataObj),1);

    };

    var clear = function(s){   //remove all plots and data

        dataAr.forEach(d=>{
            for (let p in d.lines) d.lines[p].remove();
        });
        skewtgroup.selectAll("lines").remove();
        skewtgroup.selectAll("path").remove(); //clear previous paths from skew
        skewtgroup.selectAll("g").remove();
        barbgroup.selectAll("use").remove(); //clear previous paths  from barbs
        dataAr=[];
        //if(tooltipRect)tooltipRect.remove();    tooltip rect is permanent
    };

    var clearBg = function(){
        skewtbg.selectAll("*").remove();
    };

    //addings functions as public methods
    this.drawBackground = drawBackground;
    this.resize = resize;
    this.plot = plot;
    this.clear = clear; //clear all the plots
    this.clearBg= clearBg;
    this.selectSkewt = selectSkewt;
    this.removePlot = removePlot; //remove a specific plot,  referenced by data object passed initially
    this.cbf= () =>{};
    this.cbfRange= () =>{};  //cbf for range input,  to set local storage in plugin
    this.setCallback= f =>{
        this.cbf=f;
    };
    this.setCallbackRange= f =>{
        this.cbfRange=f;
    };
    //this.cloudRef1 and this.cloudRef2  =  references to the canvas elements to add clouds with other program.
    //this.move2P and this.hideTooltips,  this.showTooltips,  has been declared

    this.refs={};
    this.refs.tooltipRect = tooltipRect.node();

    //init
    setVariables();
    resize();
    drawToolTips.call(this);  //only once
    makeBarbTemplates();  //only once

};}());