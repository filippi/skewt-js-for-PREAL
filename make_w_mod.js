// this is called anyway by build.js

const fs = require("fs");

let file=fs.readFileSync("dist/bundle.js",'utf8');
let css=fs.readFileSync("dist/skewt.css",'utf8');

function translate2windyMod(file){

    file=
    `if(!W['@plugins/skewt']) W.define(
        '@plugins/skewt',
        [],
        function (__exports) {
        'use strict';
        console.log("skewt loaded");
    // `+file;

    file = file.replace('window.SkewT',  'this.SkewT' );

    let lastpos=file.lastIndexOf("());")
    file= file.slice(0,lastpos)+
    `    
        , 
            false
        ,        
            \`${css}\`
    )`;
    return file;
}

module.exports = translate2windyMod;


