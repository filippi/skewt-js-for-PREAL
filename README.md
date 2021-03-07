# skewt-js
Plot a skew-T log-P diagram based on sounding data.

This was forked from:  [https://github.com/dfelix/skewt-js](https://github.com/dfelix/skewt-js).

## Changes

- Updated to work with D3 version 5.
- Interactivity:  Set top pressure (zoom),  set gradient,  toggle maintain temperature range.

I have added the following functionality thanks to [Victor Berchet](https://github.com/vicb/windy-plugin-sounding) :

- Added moist adiabats.
- Added isohumes.
- Added parcel trajectory.

## Dependencies
skewt-js requires [D3 JavaScript library](https://github.com/d3/d3).

```html
<script src="https://d3js.org/d3.v5.js"></script>
```

## How to use

```html
<script src="https://d3js.org/d3.v5.js"></script>
<script src="dist/bundle.js"></script>
```

Ensure you create a div using a specified id (ex: id="mySkewt") and class = "skew-t"

```html
<div id="mySkewt" class="skew-t"></div>
```

Declare a new SkewT var passing the css selector for the placeholder.

```html
<script>
	var skewt = new SkewT('#mySkewt');
</script>
```

SkewT currently only contains methods:

#### Plot

.plot(array, options) will plot dew point and air temperature lines and wind barbs. options is optional.

Available options {add:true} to add a plotline,  else the current ones will be cleared.  If add:true, and select:true,  then the added plot line will be highlighted.

```javascript
  var skewt = new SkewT('#mySkewt');
  var sounding = [];
  skewt.plot(sounding);
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

#### Clear

.clear() will clear the previous plot lines and wind barbs.

#### more methods

.selectSkewt(  array_previously_sent_with_plot )  to highlight a plot lines.  The tooltips will then display info from this line.
