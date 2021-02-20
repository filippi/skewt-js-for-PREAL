const
    fs = require('fs'),
    rollup = require('rollup'),
    less = require('less');


async function build() {
    const inputOptions = {input: "src/skewt.js"};
    const outputOptions = {file:"dist/bundle.js",  format:"iife"};
    const bundle = await rollup.rollup(inputOptions);
    const { output } = await bundle.generate(outputOptions);
    await bundle.write(outputOptions);
    await bundle.close();
}

!async function(){
    const lessSrc = await fs.readFileSync("src/skewt.less", 'utf8');
    let { css } = await less.render(lessSrc, {
        cleancss: true,
        compress: true,
    }).catch(console.log);
    css=`document.head.insertAdjacentHTML("beforeend", \`<style>${css}</style>\`)`;
    fs.writeFileSync("src/skewtcss.js", css);
    await build();//with rollup
    fs.unlinkSync("src/skewtcss.js");
}()