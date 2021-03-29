
import * as atm from './atmosphere.js';


////Original code from:

/**
 * SkewT v1.1.0
 * 2016 David Félix - dfelix@live.com.pt
 *
 * Dependency:
 * d3.v3.min.js from https://d3js.org/
 *
 */

window.SkewT = function(div, isTouchDevice) {

    var _this=this;
    //properties used in calculations
    var wrapper = d3.select(div);
    var width = parseInt(wrapper.style('width'), 10);
    var height = width + 20; //tofix
    var margin = {top: 10, right: 25, bottom: 10, left: 25}; //container margins
    var deg2rad = (Math.PI/180);
    var gradient = 55;
    var adjustGradient=false;
    var tan;
    var basep = 1000;
    var topp = 50;
    var pIncrement=-50;
    var midtemp=0, temprange=60;
    var xOffset=0;
    //var parctemp;
    var steph = atm.getElevation(topp)/20;
    var moving = false;
    //console.log(steph);

    var selectedSkewt;

    var plines = [1000,900,800,700,600,500,400,300,200,100,50];
    var pticks = [], tickInterval=25;
    for (let i=plines[0]+tickInterval; i>plines[plines.length-1]; i-=tickInterval) pticks.push(i);
    var barbsize = 15;   /////
    // functions for Scales and axes. Note the inverted domain for the y-scale: bigger is up!
    var r = d3.scaleLinear().range([0,300]).domain([0,150]);
    var y2 = d3.scaleLinear();
    var bisectTemp = d3.bisector(function(d) { return d.press; }).left; // bisector function for tooltips
    var w, h, x, y, xAxis, yAxis, yAxis2;
    var dataSel = [],  dataReversed = [];
    var dataAr = [];
    //aux
    var unit = "kt"; // or kmh


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
    var svg = wrapper.append("svg").attr("id", "svg");	 //main svg
    var controls = wrapper.append("div").attr("class","controls");
    var rangeContainer = wrapper.append("div").attr("class","range-container");
    var container = svg.append("g").attr("id", "container"); //container
    var skewtbg = container.append("g").attr("id", "skewtbg").attr("class", "skewtbg");//background
    var skewtgroup = container.append("g").attr("class", "skewt"); // put skewt lines in this group  (class skewt not used)
    var barbgroup  = container.append("g").attr("class", "windbarb"); // put barbs in this group
    var tooltipgroup = container.append("g").attr("class", "tooltips");      //class tooltps not used
    var tooltipRect = container.append("rect").attr("id",  "tooltipRect").attr("class", "overlay");

    //local functions
    function setVariables() {
        width = parseInt(wrapper.style('width'), 10) -10; // tofix: using -10 to prevent x overflow
        height = width; //to fix
        w = width - margin.left - margin.right;
        h = width - margin.top - margin.bottom;
        tan = Math.tan((gradient || 55) *deg2rad);
        x = d3.scaleLinear().range([0-w/2, w+w/2]).domain([midtemp-temprange*2 , midtemp+temprange*2]);
        y = d3.scaleLog().range([0, h]).domain([topp, basep]);
        xAxis = d3.axisBottom(x).tickSize(0,0).ticks(20);//.orient("bottom");
        yAxis = d3.axisLeft(y).tickSize(0,0).tickValues(plines).tickFormat(d3.format(".0d"));//.orient("left");
        yAxis2 = d3.axisRight(y).tickSize(5,0).tickValues(pticks);//.orient("right");
    }

    function convert(msvalue, unit)
    {
        switch(unit) {
            case "kt":
                return msvalue*1.943844492;
                //return msvalue;   //wind is provided as kt by michael's program
            break;
            case "kmh":
                return msvalue*3.6;
            break;
            default:
                return msvalue;
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

        // create array to plot dry adiabats

        //console.log(pIncrement);
        var pp = moving?
                [basep, basep-(basep-topp)*0.25,basep-(basep-topp)*0.5,basep-(basep-topp)*0.75, topp]
                : d3.range(basep,topp-50 ,pIncrement);

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
                        atm.dryLapse(pp[i],273.15 + d,basep) -273.15
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
                temp= i==0? 273.15 + d : ((temp + atm.moistGradientT(pp[i], temp) * (moving?(topp-basep)/4:pIncrement)) )
                return x(temp - 273.15) + (y(basep)-y(pp[i]))/tan;
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
        var mixingRatio;
        var isohumeFx = d3.line()
            .curve(d3.curveLinear)
            .x(function(d,i) {
                //console.log(d);
                if (i==0) mixingRatio = atm.mixingRatio(atm.saturationVaporPressure(d + 273.15), pp[i]);
                temp = atm.dewpoint(atm.vaporPressure(pp[i], mixingRatio));
                return x(temp - 273.15) + (y(basep)-y(pp[i]))/tan;
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
    }

    var makeBarbTemplates = function(){
        var speeds = d3.range(5,205,5);
        var barbdef = container.append('defs')
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
                    .attr("y2", px+2)
                px -= 3;
            }
            // Draw half-pennants on each barb
            for (i=0; i<halfpennants; i++) {
                thisbarb.append("line")
                    .attr("x1", 0)
                    .attr("x2", -3)
                    .attr("y1", px)
                    .attr("y2", px+1)
                px -= 3;
            }
        });
    }


    var shiftXAxis= function(){

        clipper.attr("x", -xOffset);
        xAxisValues.attr("transform", `translate(${xOffset}, ${h-0.5} )`);
        for (let p in lines) {
            lines[p].attr("transform",`translate(${xOffset},0)`);
        };
        dataAr.forEach(d=>{
            for (let p in d.lines){
                d.lines[p].attr("transform",`translate(${xOffset},0)`);
            }
        })
    }



    var drawToolTips = function() {

        // Draw tooltips
        var tmpcfocus = tooltipgroup.append("g").attr("class", "focus tmpc").style("display", "none");
        tmpcfocus.append("circle").attr("r", 4);
        tmpcfocus.append("text").attr("x", 9).attr("dy", ".35em");

        var dwpcfocus = tooltipgroup.append("g").attr("class", "focus dwpc").style("display", "none");
        dwpcfocus.append("circle").attr("r", 4);
        dwpcfocus.append("text").attr("x", -9).attr("text-anchor", "end").attr("dy", ".35em");

        var hghtfocus = tooltipgroup.append("g").attr("class", "focus").style("display", "none");
        var hght1 = hghtfocus.append("text").attr("x", 0).attr("text-anchor", "start").attr("dy", ".35em");
        var hght2 = hghtfocus.append("text").attr("x", 0).attr("text-anchor", "start").attr("dy", "-0.65em").style("fill","blue");

        var wspdfocus = tooltipgroup.append("g").attr("class", "focus windspeed").style("display", "none");
        var wspd1 = wspdfocus.append("text").attr("x", "0.8em").attr("text-anchor", "start").attr("dy", ".35em");
        var wspd2 = wspdfocus.append("text").attr("x", "0.8em").attr("text-anchor", "start").attr("dy", "-0.65em").style("fill","red") ;
        var wspd3 = wspdfocus.append("text").attr("class","skewt-wind-arrow").html("&#8681;") ;
        //console.log(wspdfocus)


        let startX=null;

        function start(e){
            [tmpcfocus, dwpcfocus, hghtfocus, wspdfocus].forEach(e=>e.style("display", null));
            move.call(tooltipRect.node());
            startX=d3.mouse(this)[0]-xOffset;
            //console.log("start drag");

        }

        function end(e){
            startX=null;
            //console.log("end drag");
        }

        _this.hideTooltips = function(){
            [tmpcfocus, dwpcfocus, hghtfocus, wspdfocus].forEach(e=>e.style("display", "none"));
        }

        _this.showTooltips = function(){
            [tmpcfocus, dwpcfocus, hghtfocus, wspdfocus].forEach(e=>e.style("display", null));
        }

        _this.move2P = function(y0){

            //console.log("line moving vertically");
            var i = bisectTemp(dataReversed, y0, 1, dataReversed.length-1);
            var d0 = dataReversed[i - 1];
            var d1 = dataReversed[i];
            var d = y0 - d0.press > d1.press - y0 ? d1 : d0;

            tmpcfocus.attr("transform", "translate(" +  (xOffset + x(d.temp) + (y(basep)-y(d.press))/tan)+ "," + y(d.press) + ")");
            dwpcfocus.attr("transform", "translate(" +  (xOffset + x(d.dwpt) + (y(basep)-y(d.press))/tan)+ "," + y(d.press) + ")");

            hghtfocus.attr("transform", "translate(0," + y(d.press) + ")");
            hght1.html("- "+Math.round(d.hght)); 	//hgt or hghtagl ???
            hght2.html("&nbsp;&nbsp;&nbsp;"+Math.round(d.dwpt)+"&#176;C");

            wspdfocus.attr("transform", "translate(" + (w-60)  + "," + y(d.press) + ")");
            wspd1.html(isNaN(d.wspd)?"" : (Math.round(convert(d.wspd, unit)*10)/10 + " " + unit));
            wspd2.html(Math.round(d.temp)+"&#176;C");
            wspd3.style("transform",`rotate(${d.wdir}deg)`);

            if (_this.cbf) _this.cbf(d.press);
        }

        function move(e){
            //console.log("move");
            var newX=d3.mouse(this)[0];
            if (startX!==null){
                xOffset=-(startX-newX);
                shiftXAxis();
            }
            var y0 = y.invert(d3.mouse(this)[1]); // get y value of mouse pointer in pressure space
            _this.move2P(y0);
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
    }


    //var parctrajLine;
    var drawParcelTraj = function(dataObj){

        if(dataObj.lines.parctrajLine) dataObj.lines.parctrajLine.remove();

            let {data,parctemp}=dataObj;

            let parcelTraj = atm.parcelTrajectory(
                { level:data.map(e=>e.press), gh: data.map(e=>e.hght),  temp:  data.map(e=>e.temp+273.15) },
                moving? 5:40,
                parctemp + 273.15 ,
                data[0].press,
                data[0].dwpt+273.15
            )

            var parclinedata = parcelTraj?     //may be null
                [[].concat(parcelTraj.dry||[],parcelTraj.moist||[]).map(e=>{return {parct:e[0]-273.15, press:e[1]}})]
                :[];

            var parctrajFx = d3.line()
            .curve(d3.curveLinear)
            .x(function(d,i) { return x(d.parct) + (y(basep)-y(d.press))/tan; })
            .y(function(d,i) { return y(d.press); });

            dataObj.lines.parctrajLine = skewtgroup
                .selectAll("parctrajlines")
                .data(parclinedata).enter().append("path")
                .attr("class", `parcel highlight-line`)// ${dataAr.indexOf(dataObj)==selectedSkewt?"highlight-line":""}`)
                .attr("clip-path", "url(#clipper)")
                .attr("d", parctrajFx)
                .attr("transform",`translate(${xOffset},0)`);
    }




    var selectSkewt = function(data){  //use the data,  then can be found from the outside by using data obj ref
        dataAr.forEach(d=>{
            let found=d.data==data;
            for (let p in d.lines) d.lines[p].classed("highlight-line",found);
            if (found){
                dataReversed=[].concat(d.data).reverse();
            }
        })
        _this.hideTooltips();

    }



    //if in options:  add,  add new plot,  if select,  set selected ix and highlight.  if select false,  must hightlight separtely.
    var plot = function(s, {add,select}={} ){

        if(s.length==0) return;

        let ix=0;

        if (!add){
            dataAr.forEach(d=>{  //clear all plots
                for (let p in d.lines) d.lines[p].remove();
            })
            dataAr=[];
        }

        let dataObj = dataAr.find(d=>d.data==s);

        let data;
        if (!dataObj) {
            let parctemp=s[0].temp;
            data=s;//.filter(d=> d.temp > -1000 && d.dwpt > -1000);      //do not filter here,  do not change obj ref
            ix = dataAr.push({data, parctemp, lines:{}})  -1;
            dataObj = dataAr[ix];
        } else {
            ix = dataAr.indexOf(dataObj);
            data=dataObj.data;
            for (let p in dataObj.lines) dataObj.lines[p].remove();
        }

        //reset parctemp range
        ranges.parctemp.input.node().value = ranges.parctemp.value = dataObj.parctemp = Math.round(dataObj.parctemp*10)/10 ;
        ranges.parctemp.valueDiv.html(`${dataObj.parctemp} ${unit4range("parctemp")}`);

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
            })]
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

        //barbs stuff
        var stepH = 300;
        var lastH=-300;

        var barbs = skewtlines[0].filter(function(d) {
            if (d.hght>lastH+steph) lastH=d.hght;
            return (d.hght==lastH && d.wdir >= 0 && d.wspd >= 0 && d.press >= topp);
        });

        dataObj.lines.barbs = barbgroup.append("svg").attr("class","barblines");//.attr("transform","translate(30,80)");

        dataObj.lines.barbs.selectAll("barbs")
            .data(barbs).enter().append("use")
            .attr("href", function (d) { return "#barb"+Math.round(convert(d.wspd, "kt")/5)*5; }) // 0,5,10,15,... always in kt
            .attr("transform", function(d) { return "translate("+(w + 15 * ix) +","+y(d.press)+") rotate("+ (d.wdir+180)+")"; });

        if (select || dataAr.length==1){
            selectedSkewt=dataObj;
            selectSkewt(dataObj.data);
        }
        shiftXAxis();

        return dataAr.length;
    }

    //controls
    var buttons = {"Dry Adiabat":{},"Moist Adiabat":{},"Isohume":{},"Temp":{},"Pressure":{}};
    for (let p in buttons){
        let b= buttons[p];
        b.hi=false;
        b.el=controls.append("div").attr("class","buttons").text(p).on("click", ()=>{
            b.hi=!b.hi;
            b.el.node().classList[b.hi?"add":"remove"]("clicked");
            let line=p.replace(" ","").toLowerCase();
            lines[line]._groups[0].forEach(p=>p.classList[b.hi?"add":"remove"]("highlight-line"));
        })
    };

    let ranges= {
        gradient:{min:0, max:85, step:5,  value: 90-gradient},
        topp:{ min:50, max:900, step: 50, value:50},
    //    midtemp:{value:0, step:2, min:-50, max:50},
        parctemp:{value: 10, step:2, min:-50, max: 50}
    };
    const unit4range = p => p=="gradient"?"deg":p=="topp"?"hPa":"&#176;C";
    for (let p in ranges){

        let r=ranges[p];
        r.valueDiv = rangeContainer.append("div").attr("class","skewt-range-val").html(p=="gradient"?"Gradient:":p=="topp"?"Top P:":p=="parctemp"?"Parcel T:":"Mid Temp");
        r.valueDiv = rangeContainer.append("div").attr("class","skewt-range-val").html(`${p!="gradient"?r.value : 90-r.value} ${unit4range(p)}`);
        r.input = rangeContainer.append("input").attr("type","range").attr("min",r.min).attr("max",r.max).attr("step",r.step).attr("value",r.value).attr("class","skewt-ranges")
        .on("input",(a,b,c)=>{

            _this.hideTooltips();
            r.value=+c[0].value;

            if(p=="gradient") {
                gradient = r.value = 90-r.value;;
            }
            if(p=="topp"){
                let pph=y(basep)-y(topp);
                topp= r.value;
                let ph=y(basep)-y(topp);
                pIncrement=topp>500?-25:-50;
                if(adjustGradient){
                    ranges.gradient.value = gradient = Math.atan(Math.tan(gradient*deg2rad) * pph/ph)/deg2rad;
                    ranges.gradient.input.node().value = 90-gradient;
                    ranges.gradient.valueDiv.html(`${Math.round(gradient)} ${unit4range("gradient")}`);
                } else {
                    temprange*= ph/pph;
                    setVariables();
                }
                steph = atm.getElevation(topp)/20;
            }
            if(p=="midtemp"){
                midtemp = r.value = -r.value;
            }
            r.valueDiv.html(`${r.value} ${unit4range(p)}`);

            clearTimeout(moving);
            moving=setTimeout(()=>{
                moving=false;
                resize();
            },1000)

            if(p=="parctemp"){
                selectedSkewt.parctemp = r.value;
                drawParcelTraj(selectedSkewt);
            } else {
                resize();
            }
        })


        rangeContainer.append("div").attr("class","flex-break");
    }

    rangeContainer.append("input").attr("type","checkbox").on("click",(a,b,e)=>{
            adjustGradient= e[0].checked;
    });
    rangeContainer.append("div").attr("class","skewt-checkbox-text").html("Maintain temp range on X-axis when zooming");


    var remove = function(s){
        let dataObj=dataAr.find(d=>d.data==s);
        if (!dataObj) return;
        for (let p in dataObj.lines){
            dataObj.lines[p].remove();
        }
        dataAr.splice(dataAr.indexOf(dataObj),1);

    }

    var clear = function(s){   //remove everything

        dataAr.forEach(d=>{
            for (let p in d.lines) d.lines[p].remove;
        });
        skewtgroup.selectAll("path").remove(); //clear previous paths from skew
        skewtgroup.selectAll("g").remove();
        barbgroup.selectAll("use").remove(); //clear previous paths  from barbs
        dataAr=[];
        //if(tooltipRect)tooltipRect.remove();    tooltip rect is permanent
    }

    var clearBg = function(){
        skewtbg.selectAll("*").remove();
    }

    var setParams = function(p){
        ({ topp=topp, basep=basep, steph=steph, gradient=gradient} = p);
    }

    //addings functions as public methods
    this.drawBackground = drawBackground;
    this.plot = plot;
    this.clear = clear;
    this.clearBg= clearBg;
    this.selectSkewt=selectSkewt;
    this.remove=remove;
    this.cbf=null;
    this.setCallback=f=>{
        this.cbf=f;
    }
    //this.move2P and this.hideTooltips,  this.showTooltips,  has been declared

    //init
    setVariables();
    resize();
    drawToolTips();  //only once
    makeBarbTemplates();  //only once
};

