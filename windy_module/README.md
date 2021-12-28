# Skewt windy module

In your plugin config.js,  dependencies,  add:  

`"https://unpkg.com/windyplugin-module-skewt"`

This will register the skewt as an available plugin in Windy,  but not load it yet.

In your plugin:

`const skewtMod = W.plugins.skewt;`

then,  when you need it:

`skewtMod.open().then( `, Promise is just to show it is loaded,  now you can start using it like this:

`const mySkewt = new skewtMod.skewt(myDiv, {height:200, maxtopp: 50, topp:150, gradient: 50, margins:{top:0, left:25, right:15, bottom:0}});`

See skewt README for functions.

