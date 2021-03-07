const
    fs = require('fs'),
    rollup = require('rollup'),
    less = require('less'),
    babel = require("@babel/core"),
    minify = require("babel-minify");

const inputOptions = {input: "src/skewt.js"};
const outputOptions = {file:"dist/bundle.js",  format:"iife", compact:true, minifyInternalExports:true};

const files=["math.js","skewt.js","atmosphere.js","skewt.less"];

async function build() {
    console.log("rollup");
    let bundle;
    try {
        bundle = await rollup.rollup(inputOptions);
    }  catch(er){
          console.log("Er",er);
    }
    console.log("result");
    let result = await bundle.generate(outputOptions);
    //await bundle.write(outputOptions);
    await bundle.close();
    return result.output[0].code;
}

async function minifyCode(c){
    c = babel.transformSync( c ,{
            presets: ["@babel/preset-env"]
    });
    return minify(c.code).code;
}

let building = false;
async function main(f){
    if (building) {
        console.log("busy try again");
        return;
    }
    building=true;
    console.log(f);
    const lessSrc = await fs.readFileSync("src/skewt.less", 'utf8');
    let { css } = await less.render(lessSrc, {
        cleancss: true,
        compress: true,
    }).catch(console.log);
    //css=`document.head.insertAdjacentHTML("beforeend", \`<style>${css}</style>\`)`;
    fs.writeFileSync("dist/skewt.css", css);
    console.log("start build")
    let code = await build();//with rollup
    //code = await minifyCode(code);
    fs.writeFileSync("dist/bundle.js", code);
    console.log("done");
    building=false;
}

main("start watching");

files.forEach(f=>
    fs.watchFile("src/"+f,()=>main(f+"  changed"))
);
