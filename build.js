const
    fs = require('fs'),
    rollup = require('rollup'),
    less = require('less'),
    babel = require("@babel/core"),
    minify = require("babel-minify");
    translate2windyMod = require("./make_w_mod");

const inputOptions = {input: "src/skewt.mjs"};
const outputOptions = {file:"dist/bundle.js",  format:"iife", compact:true, minifyInternalExports:true};

const files=["d3.custom.min.mjs","clouds.mjs","math.mjs","skewt.mjs","atmosphere.mjs","skewt.less"];  

async function build() {
    let bundle;
    try {
        bundle = await rollup.rollup(inputOptions);
    }  catch(er){
        console.log("Error",er);
        return
    }
    let result = await bundle.generate(outputOptions);
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
    fs.writeFileSync("dist/skewt.css", css);
    console.log("start build")
    let code = await build();//with rollup

    //code = await minifyCode(code);
    if (code){
        fs.writeFileSync("dist/bundle.js", code);

        //translate to windy modules
        let code4windyMod=  translate2windyMod(code);
        let min4windy= await minifyCode(code4windyMod);
        
        fs.writeFileSync("windy_module/skewt.js",code4windyMod,'utf8');
        fs.writeFileSync("windy_module/skewt.min.js",min4windy,'utf8');
        
        console.log("done");
    } else {
        console.log("error,  fix it and save again")
    }
    building=false;
}

main("start watching");

files.forEach(f=>
    fs.watchFile("src/"+f,()=>main(f+"  changed"))
);
