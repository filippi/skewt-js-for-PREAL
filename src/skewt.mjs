
import atm from './atmosphere.mjs';
import clouds from './clouds.mjs';
import d3 from './d3.custom.min.mjs';

////Original code from:

/**
 * SkewT v1.1.0
 * 2016 David Félix - dfelix@live.com.pt
 *
 * Dependency:
 * d3.v3.min.js from https://d3js.org/
 *
 */


window.SkewT=


function (div, { isTouchDevice, gradient = 45, topp = 50, maxtopp=50, parctempShift = 2,  height , margins = {}} = {}) {
            
    
    const _this = this;
    //properties used in calculations
    const outerWrapper = d3.select(div);//.style("overflow","hidden");
    let width = parseInt(outerWrapper.style('width'), 10);
    const margin = { top: margins.top||10, right: margins.right||25, bottom: margins.bottom||10, left:margins.left || 25 }; //container margins
    const deg2rad = (Math.PI / 180);
    //var gradient = 46;
    
    let parctemp;  //parctemp is only used to receive values with setParams. 
    this.refs = {};
    let adjustGradient = false;
    let tan;
    let basep = 1050;
    //var topp = 50;
    let pIncrement = -50;
    let midtemp = 0, temprange = 60, init_temprange = 60;
    let xOffset = 0;
    let xAxisTicks=40;
    let steph; //= atm.getElevation(topp) / 30;
    let moving = false;
    const K0 = 273.15; //Kelvin of 0 deg
    let selectedSkewt;
    let currentY = null;//used to store y position of tooltip,  so filled at correct position of unit changed.

    const plines = [1000, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150, 100, 50];

    const pticks = [];
    const tickInterval = 25;
    for (let i = plines[0] + tickInterval; i > plines[plines.length - 1]; i -= tickInterval) pticks.push(i);

    const altticks = [];
    for (let i = 0; i < 20000; i += (10000 / 3.28084)) altticks.push(atm.pressureFromElevation(i));
    //console.log(altticks);

    const barbsize = 15;   /////
    // functions for Scales and axes. Note the inverted domain for the y-scale: bigger is up!
    const r = d3.scaleLinear().range([0, 300]).domain([0, 150]);
    const y2 = d3.scaleLinear();
    const bisectTemp = d3.bisector(function (d) { return d.press; }).left; // bisector function for tooltips
    let w, h, x, y, xAxis, yAxis, yAxis2, yAxis3;
    let ymax;   //log scale for max top pressure  

    let dataSel = [], dataReversed = [];
    let dataAr = [];
    //aux
    const unitSpd = "kt"; // or kmh
    let unitAlt = "m";
    let windDisplay = "Barbs";

    if (isTouchDevice === void 0) {
        if (L && L.version) {  //check if leaflet is loaded globally
            if (L.Browser.mobile) isTouchDevice = true;
        } else {
            isTouchDevice = ('ontouchstart' in window) ||
                (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
        }
    }
    //console.log("this is a touch device:", isTouchDevice);



    //containers
    const wrapper = outerWrapper.append("div").style("position","relative");
    const cloudContainer = wrapper.append("div").attr("class", "cloud-container");
    const svg = wrapper.append("svg").attr("class", "mainsvg");	 //main svg
    const controls = wrapper.append("div").attr("class", "controls fnt controls1");
    const valuesContainer = wrapper.append("div").attr("class", "controls fnt controls2");
    const rangeContainer = wrapper.append("div").attr("class", "range-container fnt");
    const rangeContainer2 = wrapper.append("div").attr("class", "range-container-extra fnt");
    const container = svg.append("g");//.attr("id", "container"); //container
    const skewtbg = container.append("g").attr("class", "skewtbg");//.attr("id", "skewtbg");//background
    const skewtgroup = container.append("g").attr("class", "skewt"); // put skewt lines in this group  (class skewt not used)
    const barbgroup = container.append("g").attr("class", "windbarb"); // put barbs in this group
    const tooltipgroup = container.append("g").attr("class", "tooltips");      //class tooltps not used
    const tooltipRect = container.append("rect").attr("class", "overlay");//.attr("id",  "tooltipRect")
    const cloudCanvas1 = cloudContainer.append("canvas").attr("width", 1).attr("height", 200).attr("class", "cloud"); //original = width 10 and height 300
    this.cloudRef1 = cloudCanvas1.node();
    const cloudCanvas2 = cloudContainer.append("canvas").attr("width", 1).attr("height", 200).attr("class", "cloud");
    this.cloudRef2 = cloudCanvas2.node();


    function getFlags(f) {
        const flags = {
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

        const foundflags = [];
        const decode = (a, i) => {
            if (a % 2) foundflags.push(flags[1 << i]);
            if (a) decode(a >> 1, i + 1);
        }
        decode(f, 0);
        //console.log(foundflags);
        return foundflags;
    }



    //local functions
    function setVariables() {
        width = parseInt(wrapper.style('width'), 10);
        height = height ||  width; 
        //if (height>width) height = width;
        w = width - margin.left - margin.right;
        h = height - margin.top - margin.bottom;
        tan = Math.tan((gradient || 55) * deg2rad);
        //use the h for the x range,  so that appearance does not change when resizing,  remains square 
        
        ymax = d3.scaleLog().range([0 ,h ]).domain([maxtopp, basep]);
        y = d3.scaleLog().range([0 ,h ]).domain([topp, basep]);

        temprange = init_temprange * (h-ymax(topp))/ (h-ymax(maxtopp));
        x = d3.scaleLinear().range([w/2 - h*2, w/2  + h*2]).domain([midtemp - temprange * 4, midtemp + temprange * 4]);   //range is w*2

        xAxisTicks = temprange < 40 ? 30: 40;
        xAxis = d3.axisBottom(x).tickSize(0, 0).ticks(xAxisTicks);//.orient("bottom");
        yAxis = d3.axisLeft(y).tickSize(0, 0).tickValues(plines.filter(p => (p % 100 == 0 || p == 50 || p == 150))).tickFormat(d3.format(".0d"));//.orient("left");
        yAxis2 = d3.axisRight(y).tickSize(5, 0).tickValues(pticks);//.orient("right");
        yAxis3 = d3.axisLeft(y).tickSize(2, 0).tickValues(altticks);

        steph = atm.getElevation(topp) / (h/12);

    }

    function convSpd(msvalue, unit) {
        switch (unit) {
            case "kt":
                return msvalue * 1.943844492;
                //return msvalue;   //wind is provided as kt by michael's program
                break;
            case "kmh":
                return msvalue * 3.6;
                break;
            default:
                return msvalue;
        }
    }
    function convAlt(v, unit) {
        switch (unit) {
            case "m":
                return Math.round(v) + unit;
                //return msvalue;   //wind is provided as kt by michael's program
                break;
            case "f":
                return Math.round(v * 3.28084) + "ft";
                break;
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
        container.attr("transform", "translate(" + margin.left + "," + (margin.top) + ")");
        drawBackground();
        dataAr.forEach(d => {
            plot(d.data, { add: true, select: false });
        });//redraw each plot
        if (selectedSkewt) selectSkewt(selectedSkewt.data);
        shiftXAxis();
        tooltipRect.attr("width", w).attr("height", h);

        cloudContainer.style("left", (margin.left + 2) + "px").style("top", margin.top + "px").style("height", h + "px");
        const canTop = y(100);  //top of canvas for pressure 100
        cloudCanvas1.style("left", "0px").style("top", canTop + "px").style("height", (h - canTop) + "px");
        cloudCanvas2.style("left", "10px").style("top", canTop + "px").style("height", (h - canTop) + "px");
    }

    const lines = {};
    let clipper;
    let xAxisValues;
    //let tempLine,  tempdewLine;  now in object


    const drawBackground = function () {

        // Add clipping path
        clipper = skewtbg.append("clipPath")
            .attr("id", "clipper")
            .append("rect")
            .attr("x", 0)
            .attr("y", 0 )
            .attr("width", w)
            .attr("height", h );

        // Skewed temperature lines
        lines.temp = skewtbg.selectAll("templine")
            .data(d3.scaleLinear().domain([midtemp - temprange * 4, midtemp + temprange*4]).ticks(xAxisTicks))
            .enter().append("line")
            .attr("x1", d => x(d) - 0.5 + (y(basep) - y(topp)) / tan)
            .attr("x2", d => x(d) - 0.5)
            .attr("y1", 0)
            .attr("y2", h)
            .attr("class", d => d == 0 ? `tempzero ${buttons["Temp"].hi ? "highlight-line" : ""}` : `templine ${buttons["Temp"].hi ? "highlight-line" : ""}`)
            .attr("clip-path", "url(#clipper)");
        //.attr("transform", "translate(0," + h + ") skewX(-30)");


        /*
        let topTempOffset = x.invert(h/tan + w/2);
        let elevDiff = (atm.getElevation(topp) - atm.getElevation(basep));// * 3.28084;
        let km11y =  h*(11000 - atm.getElevation(basep)) / elevDiff;
        let tempOffset11 = x.invert(km11y/tan + w/2);

        console.log("top temp shift", tempOffset11, x.invert(km11y/tan)   )  ;//(elevDiff/304.8));  //deg per 1000ft
       */

        const pp = moving ?
            [basep, basep - (basep - topp) * 0.25, basep - (basep - topp) * 0.5, basep - (basep - topp) * 0.75, topp]
            : d3.range(basep, topp - 50, pIncrement);


        const pAt11km = atm.pressureFromElevation(11000);
        //console.log(pAt11km);

        const elrFx = d3.line()
            .curve(d3.curveLinear)
            .x(function (d, i) {
                const e = atm.getElevation2(d);
                const t = d > pAt11km ? 15 - atm.getElevation(d) * 0.00649 : -56.5   //6.49 deg per 1000 m
                return x(t) + (y(basep) - y(d)) / tan;
            })
            .y(function (d, i) { return y(d) });

        lines.elr = skewtbg.selectAll("elr")
            .data([plines.filter(p => p > pAt11km).concat([pAt11km, 50])])
            .enter().append("path")
            .attr("d", elrFx)
            .attr("clip-path", "url(#clipper)")
            .attr("class", `elr ${showElr ? "highlight-line" : ""}`);

        // Logarithmic pressure lines
        lines.pressure = skewtbg.selectAll("pressureline")
            .data(plines)
            .enter().append("line")
            .attr("x1", - w)
            .attr("x2", 2 * w)
            .attr("y1", y)
            .attr("y2", y)
            .attr("clip-path", "url(#clipper)")
            .attr("class", `pressure ${buttons["Pressure"].hi ? "highlight-line" : ""}`);

        // create array to plot adiabats

        const dryad = d3.scaleLinear().domain([midtemp - temprange * 2, midtemp + temprange * 6]).ticks(xAxisTicks);

        const all = [];

        for (let i = 0; i < dryad.length; i++) {
            const z = [];
            for (let j = 0; j < pp.length; j++) { z.push(dryad[i]); }
            all.push(z);
        }


        const drylineFx = d3.line()
            .curve(d3.curveLinear)
            .x(function (d, i) {
                return x(
                    atm.dryLapse(pp[i], K0 + d, basep) - K0
                ) + (y(basep) - y(pp[i])) / tan;
            })
            .y(function (d, i) { return y(pp[i]) });

        // Draw dry adiabats
        lines.dryadiabat = skewtbg.selectAll("dryadiabatline")
            .data(all)
            .enter().append("path")
            .attr("class", `dryadiabat  ${buttons["Dry Adiabat"].hi ? "highlight-line" : ""}`)
            .attr("clip-path", "url(#clipper)")
            .attr("d", drylineFx);

        // moist adiabat fx
        let temp;
        const moistlineFx = d3.line()
            .curve(d3.curveLinear)
            .x(function (d, i) {
                temp = i == 0 ? K0 + d : ((temp + atm.moistGradientT(pp[i], temp) * (moving ? (topp - basep) / 4 : pIncrement)))
                return x(temp - K0) + (y(basep) - y(pp[i])) / tan;
            })
            .y(function (d, i) { return y(pp[i]) });

        // Draw moist adiabats
        lines.moistadiabat = skewtbg.selectAll("moistadiabatline")
            .data(all)
            .enter().append("path")
            .attr("class", `moistadiabat ${buttons["Moist Adiabat"].hi ? "highlight-line" : ""}`)
            .attr("clip-path", "url(#clipper)")
            .attr("d", moistlineFx);

        // isohume fx
        let mixingRatio;
        const isohumeFx = d3.line()
            .curve(d3.curveLinear)
            .x(function (d, i) {
                //console.log(d);
                if (i == 0) mixingRatio = atm.mixingRatio(atm.saturationVaporPressure(d + K0), pp[i]);
                temp = atm.dewpoint(atm.vaporPressure(pp[i], mixingRatio));
                return x(temp - K0) + (y(basep) - y(pp[i])) / tan;
            })
            .y(function (d, i) { return y(pp[i]) });

        // Draw isohumes
        lines.isohume = skewtbg.selectAll("isohumeline")
            .data(all)
            .enter().append("path")
            .attr("class", `isohume ${buttons["Isohume"].hi ? "highlight-line" : ""}`)
            .attr("clip-path", "url(#clipper)")
            .attr("d", isohumeFx);

        // Line along right edge of plot
        skewtbg.append("line")
            .attr("x1", w - 0.5)
            .attr("x2", w - 0.5)
            .attr("y1", 0)
            .attr("y2", h)
            .attr("class", "gridline");

        // Add axes
        xAxisValues = skewtbg.append("g").attr("class", "x axis").attr("transform", "translate(0," +   (h - 0.5 ) + ")").call(xAxis).attr("clip-path", "url(#clipper)");
        skewtbg.append("g").attr("class", "y axis").attr("transform", "translate(-0.5,0)").call(yAxis);
        skewtbg.append("g").attr("class", "y axis ticks").attr("transform", "translate(-0.5,0)").call(yAxis2);
        skewtbg.append("g").attr("class", "y axis hght-ticks").attr("transform", "translate(-0.5,0)").call(yAxis3);
    }

    const makeBarbTemplates = function () {
        const speeds = d3.range(5, 205, 5);
        const barbdef = container.append('defs')
        speeds.forEach(function (d) {
            const thisbarb = barbdef.append('g').attr('id', 'barb' + d);
            const flags = Math.floor(d / 50);
            const pennants = Math.floor((d - flags * 50) / 10);
            const halfpennants = Math.floor((d - flags * 50 - pennants * 10) / 5);
            let px = barbsize / 2;
            // Draw wind barb stems
            thisbarb.append("line").attr("x1", 0).attr("x2", 0).attr("y1", -barbsize / 2).attr("y2", barbsize / 2);
            // Draw wind barb flags and pennants for each stem
            for (var i = 0; i < flags; i++) {
                thisbarb.append("polyline")
                    .attr("points", "0," + px + " -6," + (px) + " 0," + (px - 2))
                    .attr("class", "flag");
                px -= 5;
            }
            // Draw pennants on each barb
            for (i = 0; i < pennants; i++) {
                thisbarb.append("line")
                    .attr("x1", 0)
                    .attr("x2", -6)
                    .attr("y1", px)
                    .attr("y2", px + 2)
                px -= 3;
            }
            // Draw half-pennants on each barb
            for (i = 0; i < halfpennants; i++) {
                thisbarb.append("line")
                    .attr("x1", 0)
                    .attr("x2", -3)
                    .attr("y1", px)
                    .attr("y2", px + 1)
                px -= 3;
            }
        });
    }


    const shiftXAxis = function () {
        clipper.attr("x", -xOffset);
        xAxisValues.attr("transform", `translate(${xOffset}, ${h  - 0.5} )`);
        for (const p in lines) {
            lines[p].attr("transform", `translate(${xOffset},0)`);
        };
        dataAr.forEach(d => {
            for (const p in d.lines) {
                d.lines[p].attr("transform", `translate(${xOffset},0)`);
            }
        })
    }


    const drawToolTips = function () {

        // Draw tooltips
        const tmpcfocus = tooltipgroup.append("g").attr("class", "focus tmpc");
        tmpcfocus.append("circle").attr("r", 4);
        tmpcfocus.append("text").attr("x", 9).attr("dy", ".35em");

        const dwpcfocus = tooltipgroup.append("g").attr("class", "focus dwpc");
        dwpcfocus.append("circle").attr("r", 4);
        dwpcfocus.append("text").attr("x", -9).attr("text-anchor", "end").attr("dy", ".35em");

        const hghtfocus = tooltipgroup.append("g").attr("class", "focus");
        const hght1 = hghtfocus.append("text").attr("x", "0.8em").attr("text-anchor", "start").attr("dy", ".35em");
        const hght2 = hghtfocus.append("text").attr("x", "0.8em").attr("text-anchor", "start").attr("dy", "-0.65em").style("fill", "blue");

        const wspdfocus = tooltipgroup.append("g").attr("class", "focus windspeed");
        const wspd1 = wspdfocus.append("text").attr("x", "0.8em").attr("text-anchor", "start").attr("dy", ".35em");
        const wspd2 = wspdfocus.append("text").attr("x", "0.8em").attr("text-anchor", "start").attr("dy", "-0.65em").style("fill", "red");
        const wspd3 = wspdfocus.append("text").attr("class", "skewt-wind-arrow").html("&#8681;");
        const wspd4 = wspdfocus.append("text").attr("y", "1em").attr("text-anchor", "start").style("fill", "rgba(0,0,0,0.3)").style("font-size", "10px");
        //console.log(wspdfocus)

        let startX = null;

       
        function start(e) {
            showTooltips();
            move.call(tooltipRect.node());
            startX = d3.mouse(this)[0] - xOffset;
        }

        function end(e) {
            startX = null;
        }

        const hideTooltips = () => {
            [tmpcfocus, dwpcfocus, hghtfocus, wspdfocus].forEach(e => e.style("display", "none"));
            currentY = null;
        }
        hideTooltips();

        const showTooltips = () => {
            [tmpcfocus, dwpcfocus, hghtfocus, wspdfocus].forEach(e => e.style("display", null));
        }

        const move2P = (y0) => {
            //console.log("mving to",  y0);
            if (y0 || y0===0) showTooltips();
            const i = bisectTemp(dataReversed, y0, 1, dataReversed.length - 1);
            const d0 = dataReversed[i - 1];
            const d1 = dataReversed[i];
            const d = y0 - d0.press > d1.press - y0 ? d1 : d0;
            currentY = y0;

            tmpcfocus.attr("transform", "translate(" + (xOffset + x(d.temp) + (y(basep) - y(d.press)) / tan) + "," + y(d.press) + ")");
            dwpcfocus.attr("transform", "translate(" + (xOffset + x(d.dwpt) + (y(basep) - y(d.press)) / tan) + "," + y(d.press) + ")");

            hghtfocus.attr("transform", "translate(0," + y(d.press) + ")");
            hght1.html("&nbsp;&nbsp;&nbsp;" + ((d.hght || d.hght===0) ?  convAlt(d.hght, unitAlt):"") ); 	//hgt or hghtagl ???
            hght2.html("&nbsp;&nbsp;&nbsp;" + Math.round(d.dwpt) + "&#176;C");

            wspdfocus.attr("transform", "translate(" + (w - (windDisplay=="Barbs" ? 70:80)) + "," + y(d.press) + ")");
            wspd1.html(isNaN(d.wspd) ? "" : (Math.round(convSpd(d.wspd, unitSpd) * 10) / 10  + unitSpd));
            wspd2.html(Math.round(d.temp) + "&#176;C");
            wspd3.style("transform", `rotate(${d.wdir}deg)`);
            wspd4.html(d.flags ? getFlags(d.flags).map(f => `<tspan x="-8em" dy="0.8em">${f}</tspan>`).join() : "");
            //console.log(     getFlags(d.flags).join("<br>"));

            if (pressCbfs) pressCbfs.forEach(cbf=>cbf(d.press));
        }

        function move(e) {
            const newX = d3.mouse(this)[0];
            if (startX !== null) {
                xOffset = -(startX - newX);
                shiftXAxis();
            }
            const y0 = y.invert(d3.mouse(this)[1]); // get y value of mouse pointer in pressure space
            move2P(y0);
        }

        tooltipRect
            .attr("width", w)
            .attr("height", h);

        //.on("mouseover", start)
        //.on("mouseout",  end)
        //.on("mousemove", move)
        if (!isTouchDevice) {

            tooltipRect.call(d3.drag().on("start", start).on("drag", move).on("end", end));
        } else {
            tooltipRect
                //tooltipRect.node().addEventListener('touchstart',start, true)
                //tooltipRect.node().addEventListener('touchmove',move, true)
                //tooltipRect.node().addEventListener('touchend',end, true)
                .on('touchstart', start)
                .on('touchmove', move)
                .on('touchend', end);
        }

        Object.assign(this, { move2P, hideTooltips, showTooltips });
    }



    const drawParcelTraj = function (dataObj) {

        const { data, parctemp } = dataObj;

        if (data[0].dwpt == undefined) return;

        const pt = atm.parcelTrajectory(
            { level: data.map(e => e.press), gh: data.map(e => e.hght), temp: data.map(e => e.temp + K0) },
            moving ? 10 : xAxisTicks,
            parctemp + K0,
            data[0].press,
            data[0].dwpt + K0
        )

        //draw lines
        const parctrajFx = d3.line()
            .curve(d3.curveLinear)
            .x(function (d, i) { return x(d.t) + (y(basep) - y(d.p)) / tan; })
            .y(function (d, i) { return y(d.p); });

        //let parcLines={dry:[], moist:[], isohumeToDry:[], isohumeToTemp:[], moistFromCCL:[],  TCONline:[], thrm:[], cloud:[]};

        const parcLines = { parcel: [], LCL: [], CCL: [], TCON: [], "THRM top": [], "CLD top": [] };

        for (const prop in parcLines) {
            const p = prop;
            if (dataObj.lines[p]) dataObj.lines[p].remove();

            let line = [], press;
            switch (p) {
                case "parcel":
                    if (pt.dry) line.push(pt.dry);
                    if (pt.moist) line.push(pt.moist);
                    break;
                case "TCON":
                    const t = pt.TCON;
                    line = t !== void 0 ? [[[t, basep], [t, topp]]] : [];
                    break;
                case "LCL":
                    if (pt.isohumeToDry) line.push(pt.isohumeToDry);
                    break;
                case "CCL":
                    if (pt.isohumeToTemp) line.push(pt.isohumeToTemp);
                    if (pt.moistFromCCL) line.push(pt.moistFromCCL);
                    break;
                case "THRM top":
                    press = pt.pThermalTop;
                    if (press) line = [[[0, press], [400, press]]];
                    break;
                case "CLD top":
                    press = pt.pCloudTop;
                    if (press) line = [[[0, press], [400, press]]];
                    break;
            }

            if (line) parcLines[p] = line.map(e => e.map(ee => { return { t: ee[0] - K0, p: ee[1] } }));

            dataObj.lines[p] = skewtgroup
                .selectAll(p)
                .data(parcLines[p]).enter().append("path")
                .attr("class", `${p == "parcel" ? "parcel" : "cond-level"} ${selectedSkewt && data == selectedSkewt.data && (p == "parcel" || values[p].hi) ? "highlight-line" : ""}`)
                .attr("clip-path", "url(#clipper)")
                .attr("d", parctrajFx)
                .attr("transform", `translate(${xOffset},0)`);
        }

        //update values
        for (const p in values) {
            let v = pt[p == "CLD top" ? "cloudTop" : p == "THRM top" ? "elevThermalTop" : p];
            let CLDtopHi;
            if (p == "CLD top" && v == 100000) {
                v = data[data.length - 1].hght;
                CLDtopHi = true;
            }
            const txt = `${(p[0].toUpperCase() + p.slice(1)).replace(" ", "&nbsp;")}:<br><span style="font-size:1.1em;"> ${!v ? "" : p == "TCON" ? (v - K0).toFixed(1) + "&#176;C" : (CLDtopHi ? "> " : "") + convAlt(v, unitAlt)}</span>`;
            values[p].val.html(txt);
        }
    }

    const selectSkewt = function (data) {  //use the data,  then can be found from the outside by using data obj ref
        dataAr.forEach(d => {
            const found = d.data == data;
            for (const p in d.lines) {
                d.lines[p].classed("highlight-line", found && (!values[p] || values[p].hi));
            }
            if (found) {
                selectedSkewt = d;
                dataReversed = [].concat(d.data).reverse();
                ranges.parctemp.input.node().value = ranges.parctemp.value = d.parctemp = Math.round(d.parctemp * 10) / 10;
                ranges.parctemp.valueDiv.html(html4range(d.parctemp, "parctemp"));
            }
        })
        _this.hideTooltips();
    }



    //if in options:  add,  add new plot,
    //if select,  set selected ix and highlight. if select false,  must hightlight separtely.
    //ixShift used to shift to the right,  used when you want to keep position 0 open.
    //max is the max number of plots, by default at the moment 2,
    const plot = function (s, { add, select, ixShift = 0, max = 2 } = {}) {

        if (s.length == 0) return;

        let ix = 0;  //index of the plot, there may be more than one,  to shift barbs and make clouds on canvas

        if (!add) {
            dataAr.forEach(d => {  //clear all plots
                for (const p in d.lines) d.lines[p].remove();
            });
            dataAr = [];
            [1, 2].forEach(c => {
                const ctx = _this["cloudRef" + c].getContext("2d");
                ctx.clearRect(0, 0, 10, 200);
            });
        }

        let dataObj = dataAr.find(d => d.data == s);

        let data;

        if (!dataObj) {
            const parctemp = Math.round((s[0].temp + ranges.parctempShift.value) * 10) / 10;
            data = s;     //do not filter here, filter creates new obj, looses ref
            //however, object itself can be changed.
            for(let i = 0; i<data.length; i++){
                // if there is no dewpoint available,  but humidity is available,  then use august-magnus-roche equation.  
                if (  !(data[i].dwpt || data[i].dwpt===0 )  && (data[i].rh>=0 && data[i].rh<=100)){
                    let {rh, temp} = data[i];
                    data[i].dwpt = 243.04*(Math.log(rh/100)+((17.625*temp)/(243.04+temp)))/(17.625-Math.log(rh/100)-((17.625*temp)/(243.04+temp)))
                } 
            }
            ix = dataAr.push({ data, parctemp, lines: {} }) - 1;
            dataObj = dataAr[ix];
            if (ix >= max) {
                console.log("more than max plots added");
                ix--;
                setTimeout((ix) => {
                    if (dataAr.length > max) _this.removePlot(dataAr[ix].data);
                }, 1000, ix);
            }
        } else {
            ix = dataAr.indexOf(dataObj);
            data = dataObj.data;
            for (const p in dataObj.lines) dataObj.lines[p].remove();
        }

        //reset parctemp range if this is the selected range
        if (select) {
            ranges.parctemp.input.node().value = ranges.parctemp.value = dataObj.parctemp;
            ranges.parctemp.valueDiv.html(html4range(dataObj.parctemp, "parctemp"));
        }

        //skew-t stuff
        
        // Filter data,  depending on range moving,  or nullish values
        
        let data4moving; 
        if (data.length > 50 && moving) {
            let prev = -1;
            data4moving = data.filter((e, i, a) => {
                const n = Math.floor(i * 50 / (a.length - 1));
                if (n > prev) {
                    prev = n;
                    return true;
                }
            })
        } else {
            data4moving = data.map(e=>e);
        }
        let data4temp = [data4moving.filter(e=>( e.temp || e.temp===0 ) && e.temp>-999 )];
        let data4dwpt = [data4moving.filter(e=>( e.dwpt || e.dwpt===0 ) && e.dwpt>-999 )];

        
        


        const templineFx = d3.line().curve(d3.curveLinear).x(function (d, i) { return x(d.temp) + (y(basep) - y(d.press)) / tan; }).y(function (d, i) { return y(d.press); });
        dataObj.lines.tempLine = skewtgroup
            .selectAll("templines")
            .data(data4temp).enter().append("path")
            .attr("class", "temp")//(d,i)=> `temp ${i<10?"skline":"mean"}` )
            .attr("clip-path", "url(#clipper)")
            .attr("d", templineFx);

        const tempdewlineFx = d3.line().curve(d3.curveLinear).x(function (d, i) { return x(d.dwpt) + (y(basep) - y(d.press)) / tan; }).y(function (d, i) { return y(d.press); });
        dataObj.lines.tempdewLine = skewtgroup
            .selectAll("tempdewlines")
            .data(data4dwpt).enter().append("path")
            .attr("class", "dwpt")//(d,i)=>`dwpt ${i<10?"skline":"mean"}` )
            .attr("clip-path", "url(#clipper)")
            .attr("d", tempdewlineFx);

        drawParcelTraj(dataObj);
         
        
    
        const siglines = data
            .filter((d, i, a, f) => d.flags && (f = getFlags(d.flags), f.includes("tropopause level") || f.includes("surface")) ? d.press : false)
            .map((d, i, a, f) => (f = getFlags(d.flags), { press: d.press, classes: f.map(e => e.replace(/ /g, "-")).join(" ") }));

        dataObj.lines.siglines = skewtbg.selectAll("siglines")
            .data(siglines)
            .enter().append("line")
            .attr("x1", - w).attr("x2", 2 * w)
            .attr("y1", d => y(d.press)).attr("y2", d => y(d.press))
            .attr("clip-path", "url(#clipper)")
            .attr("class", d => `sigline ${d.classes}`);


        //barbs stuff

        let lastH = -300;
        //filter barbs to be valid and not too crowded
        const barbs = data4moving.filter(function (d) {
            if (d.hght > lastH + steph && (d.wspd || d.wspd === 0) && d.press >= topp && !(d.wspd === 0 && d.wdir === 0)) lastH = d.hght;
            return d.hght == lastH;
        });

        dataObj.lines.barbs = barbgroup.append("svg").attr("class", `barblines ${windDisplay=="Numerical"?"hidden":""}`);//.attr("transform","translate(30,80)");
        dataObj.lines.barbs.selectAll("barbs")
            .data(barbs).enter().append("use")
            .attr("href", function (d) { return "#barb" + Math.round(convSpd(d.wspd, "kt") / 5) * 5; }) // 0,5,10,15,... always in kt
            .attr("transform", function (d) { return "translate(" + (w + 15 * (ix + ixShift)) + "," + y(d.press) + ") rotate(" + (d.wdir + 180) + ")"; });


        dataObj.lines.windtext = barbgroup.append("svg").attr("class", `windtext ${windDisplay=="Barbs"?"hidden":""}`);//.attr("class", "barblines");    
        dataObj.lines.windtext.selectAll("windtext")
            .data(barbs).enter().append("g")
            .attr("transform",d=> `translate(${w + 28 * (ix + ixShift) - 20} , ${y(d.press)})`)
        dataObj.lines.windtext.selectAll("g").append("text")
            .html( "&#x2191;"  )
            .style("transform",d=> "rotate("  + (180 + d.wdir)+"deg)");
        dataObj.lines.windtext.selectAll("g").append("text")
            .html( d=>Math.round(convSpd(d.wspd,"kt")))
            .attr("x","0.5em");

        ////clouds
        const clouddata = clouds.computeClouds(data);
        clouddata.canvas = _this["cloudRef" + (ix + ixShift + 1)];
        clouds.cloudsToCanvas(clouddata);
        dataObj.cloudCanvas = clouddata.canvas;
        //////

        if (select || dataAr.length == 1) {
            selectSkewt(dataObj.data);
        }
        shiftXAxis();

        return dataAr.length;
    }


    //// controls at bottom

    var buttons = { "Dry Adiabat": {}, "Moist Adiabat": {}, "Isohume": {}, "Temp": {}, "Pressure": {} };
    for (const p in buttons) {
        const b = buttons[p];
        b.hi = false;
        b.el = controls.append("div").attr("class", "buttons").text(p).on("click", () => {
            b.hi = !b.hi;
            b.el.node().classList[b.hi ? "add" : "remove"]("clicked");
            const line = p.replace(" ", "").toLowerCase();
            lines[line]._groups[0].forEach(p => p.classList[b.hi ? "add" : "remove"]("highlight-line"));
        })
    };
    this.refs.highlightButtons = controls.node();

    //values
    const values = {
        "surface": {},
        "LCL": { hi: true },
        "CCL": { hi: true },
        "TCON": { hi: false },
        "THRM top": { hi: false },
        "CLD top": { hi: false }
    };

    for (const prop in values) {
        const p = prop;
        const b = values[p];
        b.val = valuesContainer.append("div").attr("class", `buttons ${p == "surface" ? "noclick" : ""} ${b.hi ? "clicked" : ""}`).html(p + ":");
        if (/CCL|LCL|TCON|THRM top|CLD top/.test(p)) {
            b.val.on("click", () => {
                b.hi = !b.hi;
                b.val.node().classList[b.hi ? "add" : "remove"]("clicked");
                selectedSkewt.lines[p]._groups[0].forEach(p => p.classList[b.hi ? "add" : "remove"]("highlight-line"));
            })
        }
    }
    this.refs.valueButtons = valuesContainer.node();

    const ranges = {
        parctemp: { value: 10, step: 0.1, min: -50, max: 50 },
        topp: { min: 50, max: 900, step: 25, value: topp },
        parctempShift: { min: -5, step: 0.1, max: 10, value: parctempShift },
        gradient: { min: 0, max: 85, step: 1, value: gradient },
        //    midtemp:{value:0, step:2, min:-50, max:50},

    };

    const unit4range = p => p == "gradient" ? "&#176" : p == "topp" ? "hPa" : "&#176;C";

    const html4range = (v, p) => {
        let html = "";
        if (p == "parctempShift" && r.value >= 0) html += "+";
        html += (p == "gradient" || p == "topp" ? Math.round(v) : Math.round(v * 10) / 10) + unit4range(p);
        if (p == "parctemp") {
            const shift = selectedSkewt ? (Math.round((v - selectedSkewt.data[0].temp) * 10) / 10) : parctempShift;
            html += " <span style='font-size:0.8em'>&nbsp;" + (shift > 0 ? "+" : "") + shift + "</span>";
        }
        return html;
    }

    for (const prop in ranges) {
        const p = prop;
        const contnr = p == "parctemp" || p == "topp" ? rangeContainer : rangeContainer2;
        const r = ranges[p];
        r.row=contnr.append("div").attr("class","row");;
        this.refs[p]=r.row.node();
        r.valueDiv = r.row.append("div").attr("class", "skewt-range-des").html(p == "gradient" ? "Gradient:" : p == "topp" ? "Top P:" : p == "parctemp" ? "Parcel T:" : "Parcel T Shift:");
        r.valueDiv = r.row.append("div").attr("class", "skewt-range-val").html(html4range(r.value, p));
        r.input = r.row.append("input").attr("type", "range").attr("min", r.min).attr("max", r.max).attr("step", r.step).attr("value", p == "gradient" ? 90 - r.value : r.value).attr("class", "skewt-ranges")
            .on("input", (a, b, c) => {

                _this.hideTooltips();
                r.value = +c[0].value;

                if (p == "gradient") {
                    gradient = r.value = 90 - r.value;
                    showErlFor2Sec(0, 0, r.input);
                    //console.log("GRADIENT ST", gradient);
                }
                if (p == "topp") {
                    showErlFor2Sec(0, 0, r.input);
                    const h_oldtopp = y(basep) - y(topp);
                    topp = r.value;
                    const h_newtopp = y(basep) - y(topp);
                    pIncrement = topp > 500 ? -25 : -50;
                    if (adjustGradient) {
                        ranges.gradient.value = gradient =  Math.atan(Math.tan(gradient * deg2rad) * h_oldtopp / h_newtopp) / deg2rad;
                        ranges.gradient.input.node().value =  90 - gradient;  //will trigger input event anyway
                        ranges.gradient.valueDiv.html(html4range(gradient, "gradient"));  
                        init_temprange*=h_oldtopp/h_newtopp;
                        if (ranges.gradient.cbfs) ranges.gradient.cbfs.forEach(cbf => cbf(gradient));
                    } else {
                       // temprange = init_temprange * ph / pph;
                       // setVariables();
                    }
                    steph = atm.getElevation(topp) / 30;
                }
                if (p == "parctempShift") {
                    parctempShift = r.value;
                }

                r.valueDiv.html(html4range(r.value, p));

                clearTimeout(moving);
                moving = setTimeout(() => {
                    moving = false;
                    if (p == "parctemp") {
                        if (selectedSkewt) drawParcelTraj(selectedSkewt);   //value already set
                    } else {
                        resize();
                    }
                }, 1000)

                if (p == "parctemp"){ 
                    if (selectedSkewt) {
                        selectedSkewt.parctemp = r.value;
                        drawParcelTraj(selectedSkewt);
                    }
                } else {
                    resize();
                }

                //this.cbfRange({ topp, gradient, parctempShift });
                if (r.cbfs) r.cbfs.forEach(cbf => cbf(p=="gradient"? gradient: r.value))
            })

        //contnr.append("div").attr("class", "flex-break");
    }


    let showElr;
    const showErlFor2Sec = (a, b, target) => {
        target = target[0] || target.node();
        lines.elr.classed("highlight-line", true);
        clearTimeout(showElr);
        showElr = null;
        showElr = setTimeout(() => {
            target.blur();
            lines.elr.classed("highlight-line", showElr = null);  //background may be drawn again
        }, 1000);
    }

    ranges.gradient.input.on("focus", showErlFor2Sec);
    ranges.topp.input.on("focus", showErlFor2Sec);

    const cbSpan = rangeContainer2.append("span").attr("class", "row checkbox-container");
    this.refs.maintainXCheckBox = cbSpan.node();
    cbSpan.append("input").attr("type", "checkbox").on("click", (a, b, e) => {
        adjustGradient = e[0].checked;
    });
    cbSpan.append("span").attr("class", "skewt-checkbox-text").html("Maintain temp range on X-axis when zooming");

    const selectUnits = rangeContainer2.append("div").attr("class", "row select-units");
    this.refs.selectUnits = selectUnits.node();
    selectUnits.append("div").style("width","10em").html("Select alt units: ");
    const units = { "meter": {}, "feet": {} };
    for (const prop in units) {
        const p = prop;
        units[p].hi = p[0] == unitAlt;
        units[p].el = selectUnits.append("div").attr("class", "buttons units" + (unitAlt == p[0] ? " clicked" : "")).text(p).on("click", () => {
            for (const p2 in units) {
                units[p2].hi = p == p2;
                units[p2].el.node().classList[units[p2].hi ? "add" : "remove"]("clicked");
            }
            unitAlt = p[0];
            if (currentY !== null) _this.move2P(currentY);
            drawParcelTraj(selectedSkewt);
        })
    };

    const selectWindDisp = rangeContainer2.append("div").attr("class", "row select-units");
    this.refs.selectWindDisp = selectWindDisp.node();
    selectWindDisp.append("div").style("width","10em").html("Select wind display: ");
    const windDisp = { "Barbs": {}, "Numerical": {} };
    for (const prop in windDisp) {
        const p = prop;
        windDisp[p].hi = p == windDisplay;
        windDisp[p].el = selectWindDisp.append("div").attr("class", "buttons units" + (windDisplay == p ? " clicked" : "")).text(p).on("click", () => {
            for (const p2 in windDisp) {
                windDisp[p2].hi = p == p2;
                windDisp[p2].el.node().classList[windDisp[p2].hi ? "add" : "remove"]("clicked");
            }
            windDisplay = p;
            //console.log(windDisplay);
            dataAr.forEach(d=>{
                d.lines.barbs.classed("hidden", windDisplay=="Numerical");
                d.lines.windtext.classed("hidden", windDisplay=="Barbs");
            })
        })
    };

    const removePlot =  (s) => { //remove single plot
        const dataObj = dataAr.find(d => d.data == s);
        //console.log(dataObj);
        if (!dataObj) return;
        let ix=dataAr.indexOf(dataObj);
        //clear cloud canvas.
        if (dataObj.cloudCanvas){
            const ctx = dataObj.cloudCanvas.getContext("2d");
            ctx.clearRect(0, 0, 10, 200);
        }

        for (const p in dataObj.lines) {
            dataObj.lines[p].remove();
        }
        dataAr.splice(ix, 1);
        if(dataAr.length==0) {
            _this.hideTooltips();
            console.log("All plots removed");
        }
    }

    const clear =  () => {   //remove all plots and data
        dataAr.forEach(d => {
            for (const p in d.lines) d.lines[p].remove();
            const ctx = d.cloudCanvas.getContext("2d");
            ctx.clearRect(0, 0, 10, 200);
        });
        _this.hideTooltips();
        // these maybe not required,  addressed by above.
        skewtgroup.selectAll("lines").remove();
        skewtgroup.selectAll("path").remove(); //clear previous paths from skew
        skewtgroup.selectAll("g").remove();
        barbgroup.selectAll("use").remove(); //clear previous paths  from barbs
        dataAr = [];
        //if(tooltipRect)tooltipRect.remove();    tooltip rect is permanent
    }

    const clearBg = () => {
        skewtbg.selectAll("*").remove();
    }

    const setParams = (p) => {
        ({ height=height, topp=topp, parctempShift=parctempShift,  parctemp=parctemp,  basep=basep, steph=steph, gradient=gradient } = p);
        if (p=="gradient") ranges.gradient.input.value = 90 - p;
        else if (ranges[p]) ranges[p].input.value = p;
        //resize();
    }

    const getParams = () =>{
        return  {height, topp, basep, steph, gradient, parctempShift, parctemp: selectSkewt.parctemp }
    }

    const shiftDegrees = function (d) {
        xOffset = x(0) - x(d) ;
        //console.log("xOffs", xOffset);
        shiftXAxis();
    }

    
    // Event cbfs.
    // possible events:  temp, press, parctemp,  topp,   parctempShift,   gradient;
    
    const pressCbfs=[];
    const tempCbfs=[];
    const on = (ev, cbf) =>{
        let evAr;
        if (ev=="press" || ev=="temp") {
            evAr=ev=="press"?pressCbfs:tempCbfs; 
        } else {
            for (let p in ranges) {
                if(ev.toLowerCase() == p.toLowerCase()){
                    if (!ranges[p].cbfs) ranges[p].cbfs = [];
                    evAr=ranges[p].cbfs;
                }
            }
        }
        if (evAr){
            if (!evAr.includes(cbf)) {
                evAr.push(cbf);
            } else {
                console.log("EVENT ALREADY REGISTERED");
            }
        } else {
            console.log("EVENT NOT RECOGNIZED");
        }
    }

    const off = (ev, cbf) => {
        let evAr;
        if (ev=="press" || ev=="temp") {
            evAr=ev=="press"?pressCbfs:tempCbfs; 
        } else {
            for (let p in ranges) {
                if(ranges[p].cbfs && ev.toLowerCase() == p.toLowerCase()){
                    evAr=ranges[p].cbfs;
                }
            }    
        }
        if (evAr) { 
            let ix = evAr.findIndex(c=>cbf==c);
            if (ix>=0) evAr.splice(ix,1);
        }
    }

    // Add functions as public methods

    this.drawBackground = drawBackground;
    this.resize = resize;
    this.plot = plot;
    this.clear = clear; //clear all the plots
    this.clearBg = clearBg;
    this.selectSkewt = selectSkewt;
    this.removePlot = removePlot; //remove a specific plot,  referenced by data object passed initially
  
    this.on = on;
    this.off = off;
    this.setParams = setParams;
    this.getParams = getParams;
    this.shiftDegrees = shiftDegrees;
    
    /**
    *  parcelTrajectory: 
    * @param params = {temp,  gh,  level},
    * @param {number} steps,
    * @param surfacetemp,  surf pressure and surf dewpoint
    */
    this.parcelTrajectory = atm.parcelTrajectory;

    this.pressure2y = y;
    this.temp2x = x;
    this.gradient = gradient;  //read only,  use setParams to set.

    //  this.move2P,   this.hideTooltips,  this.showTooltips,  has been declared

    //  this.cloudRef1 and this.cloudRef2  =  references to the canvas elements to add clouds with other program
    
    this.refs.tooltipRect = tooltipRect.node();

    /*  other refs:
        highlightButtons
        valueButtons
        parctemp
        topp
        gradient
        parctempShift
        maintainXCheckBox
        selectUnits
        selectWindDisp
        tooltipRect
    */

    //init
    setVariables();
    resize();
    drawToolTips.call(this);  //only once
    makeBarbTemplates();  //only once
};

