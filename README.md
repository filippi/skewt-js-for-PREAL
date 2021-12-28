# skewt-js
Plot a skew-T log-P diagram based on sounding data.

This was forked from:  [https://github.com/dfelix/skewt-js](https://github.com/dfelix/skewt-js).

## Changes

- By now LOTS.   
- Updated to work with D3 version 5.
- A treeshaken D3 is now bundled into bundle.js,  no need to load it.  
- Interactivity:  Set top pressure (zoom),  set gradient, set parcel temperature,  toggle maintain temperature range.
- Highlight different lines.  

I have added the following functionality thanks to [Victor Berchet](https://github.com/vicb/windy-plugin-sounding) :

- Added moist adiabats.
- Added isohumes.
- Added parcel trajectory.


Added calculations for TCON,  LCL,  CCL,  Thermal top and cloud Top.  Lines to indicate these parameters can be toggled.  

## How to use

```html
<link rel="stylesheet" href="dist/skewt.css">

<script src="dist/bundle.js"></script>
```

Ensure you create a div using a specified id (ex: id="mySkewt") and class = "skew-t"

```html
<div id="mySkewt" class="skew-t"></div>
```

Declare a new SkewT var passing the css selector for the placeholder.

```javascript
var skewt = new SkewT('#mySkewt' , options);
```

SkewT currently only contains methods:

### Plot

`.plot(array, plotOptions)` will plot dew point and air temperature lines and wind barbs. options is optional.

Available options: 

```javascript
plotOptions = {
	add:true, // to add a plotline,  else the current ones will be cleared. 
  	select:true, // added plot line will be highlighted,  relevant if >1.
	max: 2// maximum number of plots superimposed,  if max reached,  last one will be overwritten,
	ixShift: 1// moves the windbarbs and clouds to the right, ( I use it in windy to differentiate between sonde data and forecast data )
}
```  

```javascript
  var skewt = new SkewT('#mySkewt');
  var sounding = [];
  skewt.plot(sounding, plotOptions);
```

Expected array format should follow the GSD Sounding Format.

```javascript
[{
		"press": 1000.0,  // pressure in whole millibars
		"hght": 173.0,    // height in meters (m)
		"temp": 14.1,     // temperature in degrees Celsius
		"dwpt": 6.5,      // dew point temperature in degree Celsius
		"wdir": 8.0,      // wind direction in degrees
		"wspd": 6.173     // wind speed in meters per second (m/s)
	}, {
		"press": 975.0,
		"hght": 386.0,
		"temp": 12.1,
		"dwpt": 5.6,
		"wdir": 10.0,
		"wspd": 7.716
	},
	...
]
```

### Clear

`.clear()` will clear the previous plot lines and wind barbs.

### Select a skewt plot

`.selectSkewt(  array_previously_sent_with_plot )`  to highlight a plot lines.  The tooltips will then display info from this line.

### Remove a specific plot,  leave the others:

`.removePlot`  //remove a specific plot,  referenced by data object passed initially.



### Parcel trajectory calculations can be done,  without actually plotting it:

```javascript
.parcelTrajectory(
	{temp,  gh,  level},  //arrays,  must be same length
	steps,  // integer
	surface_temp,  surface_pressure, surface_dewpoint
)
```
### set or get Params
```javascript
.setParams(
	{
		height,  //in pixels 
		topp,  //top pressure
		parctempShift,  //default parcel temperature offset  
		parctemp,  
		basep, 
		steph,  //step height  
		gradient //in degrees 
	}
)
.getParams();
```
### Tooltips:

`.move2P`,   `.hideTooltips` and  `.showTooltips`

### Listener

`.on(event, callback)`;

Possible events:  

- `press`,  //when tooltip is moved. 
- `parctemp,  topp,   parctempShift,   gradient`;  //when any of the ranges are moved




    

  