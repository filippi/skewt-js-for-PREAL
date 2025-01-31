<?php
// index.php

// ------------------------------------------------------
// 1) Helper functions to retrieve .csv and .nam files
// ------------------------------------------------------
function getCsvFiles($dir = 'data') {
    $files = [];
    if (is_dir($dir)) {
        if ($dh = opendir($dir)) {
            while (($file = readdir($dh)) !== false) {
                if (strtolower(pathinfo($file, PATHINFO_EXTENSION)) === 'csv') {
                    $files[] = $file;
                }
            }
            closedir($dh);
        }
    }
    return $files;
}

function getNamFiles($dir = 'data') {
    $files = [];
    if (is_dir($dir)) {
        if ($dh = opendir($dir)) {
            while (($file = readdir($dh)) !== false) {
                if (strtolower(pathinfo($file, PATHINFO_EXTENSION)) === 'nam') {
                    $files[] = $file;
                }
            }
            closedir($dh);
        }
    }
    return $files;
}

// ------------------------------------------------------
// 2) Gather files
// ------------------------------------------------------
$csvFiles = getCsvFiles();
$namFiles = getNamFiles();

// Merge all known files into a single list for "selectedFile" checks
$allFiles = array_merge($csvFiles, $namFiles);

// ------------------------------------------------------
// 3) Check if "file" parameter is set
// ------------------------------------------------------
if (!isset($_GET['file'])) {
    // No file selected: show the list of CSV and NAM files
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Skew-T Log-P Diagrams</title>
        <link rel="stylesheet" href="dist/skewt.css">
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 20px;
            }
            .file-list {
                margin-bottom: 40px;
            }
            .file-list ul {
                list-style: none;
                padding: 0;
            }
            .file-item {
                margin: 5px 0;
            }
            #skewtContainer {
                width: 800px;
                height: 600px;
                border: 1px solid #ccc;
            }
        </style>
    </head>
    <body>

    <h1>Skew-T Log-P Diagrams</h1>

    <div class="file-list">
        <h2>Available CSV Files</h2>
        <ul>
            <?php
            if (empty($csvFiles)) {
                echo '<li>No CSV files found in the "data" directory.</li>';
            } else {
                sort($csvFiles); // Sort for neatness
                foreach ($csvFiles as $file) {
                    echo '<li class="file-item">';
                    echo '<a href="?file=' . urlencode($file) . '">' . htmlspecialchars($file) . '</a>';
                    echo '</li>';
                }
            }
            ?>
        </ul>
    </div>
    <div class="file-list">
        <h2>Available NAM Files</h2>
        <ul>
            <?php
            if (empty($namFiles)) {
                echo '<li>No NAM files found in the "data" directory.</li>';
            } else {
                sort($namFiles);
                foreach ($namFiles as $file) {
                    echo '<li class="file-item">';
                    echo '<a href="?file=' . urlencode($file) . '">' . htmlspecialchars($file) . '</a>';
                    echo '</li>';
                }
            }
            ?>
        </ul>
    </div>

    </body>
    </html>
    <?php
    exit;
} else {
    // ------------------------------------------------------
    // 4) A file is selected => verify it
    // ------------------------------------------------------
    $selectedFile = basename($_GET['file']);

    // Check if file is in our known lists (csv or nam)
    if (!in_array($selectedFile, $allFiles)) {
        echo "<p>Error: File not found or unsupported extension.</p>";
        exit;
    }

    // We'll need the extension for raw text parsing mode
    $extension = strtolower(pathinfo($selectedFile, PATHINFO_EXTENSION));
    ?>

    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Skew-T Log-P Diagrams</title>
        <link rel="stylesheet" href="dist/skewt.css">
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 20px;
            }
            #mySkewt {
                width: 800px;
                height: 600px;
                border: 1px solid #ccc;
                margin-bottom: 1em;
            }
            .download-link {
                margin: 10px 0;
                display: inline-block;
            }
            textarea {
                width: 100%;
                height: 200px;
                font-family: monospace;
                margin-top: 10px;
            }
            button {
                margin-top: 5px;
                padding: 6px 12px;
                cursor: pointer;
            }
        </style>
    </head>
    <body>

    <div>
        <a href="index.php">← Back to File List</a>
    </div>
    <h2>Displaying: <?php echo htmlspecialchars($selectedFile); ?></h2>
  <!-- Text editing UI: load original text, let user modify, parse it -->
  <h3>Edit Raw <?php echo strtoupper($extension); ?> Content</h3>
    <p>Change the text below, then click <em>Parse</em> to re-plot.</p>
    <textarea id="textInput"></textarea>
    <br>
    <button id="parseButton">Parse</button>
<button id="btnCsv">See as CSV</button>
  <button id="btnJson">See as JSON</button>
  <button id="btnNam">See as NAM</button>
 
    <!-- Link to directly download the JSON after server-side parse -->
    <div class="download-link">
        <a href="data.php?file=<?php echo urlencode($selectedFile); ?>&download=1"
           target="_blank"
           rel="noopener noreferrer">
           Download Parsed JSON
        </a>
    </div>

    <!-- The Skew-T container -->
    <div id="mySkewt" class="skew-t"></div>

  

    <!-- Include SkewT JS library -->
    <script src="dist/bundle.js"></script>
    <script>
document.addEventListener('DOMContentLoaded', function () {
  var skewt = new SkewT('#mySkewt');
  var textArea = document.getElementById('textInput');
  var parseButton = document.getElementById('parseButton');


  // NEW: We'll store the parsed data in a variable so we can re-format later.
  var lastParsedData = null; 

  // 1) Initial load from data.php?file=...
  fetchDataAndPlot("data.php?file=<?php echo urlencode($selectedFile); ?>");

  // 2) Also fetch the *raw* file content for the textarea 
  //    (this part might already exist in your code).
  fetch('raw.php?file=<?php echo urlencode($selectedFile); ?>')
    .then(resp => resp.text())
    .then(text => textArea.value = text)
    .catch(err => {
      console.error(err);
      alert("Error loading raw text: " + err);
    });

  // 3) "Parse" button => post raw text => re-plot
  parseButton.addEventListener('click', function(){
    var rawText = textArea.value || "";
    var formData = new FormData();
    formData.append('raw_text', rawText);
    formData.append('extension', '<?php echo $extension; ?>'); // from PHP

    fetch('data.php', { method:'POST', body:formData })
      .then(r => r.json())
      .then(json => {
        lastParsedData = json;
        skewt.plot(json);
      })
      .catch(err => {
        console.error("Error re-parsing raw text:", err);
        alert("Error re-parsing raw text: " + err);
      });
  });

  function fetchDataAndPlot(url) {
    fetch(url)
      .then(r => r.json())
      .then(json => {
        lastParsedData = json;
        skewt.plot(json);
      })
      .catch(err => {
        console.error(err);
        alert("Failed to fetch or parse data: " + err);
      });
  }

  // NEW: The 3 formatting buttons
  var btnCsv = document.getElementById('btnCsv');
  var btnJson = document.getElementById('btnJson');
  var btnNam = document.getElementById('btnNam');

  btnCsv.addEventListener('click', function(){
    if (!Array.isArray(lastParsedData)) {
      alert("No parsed data to convert.");
      return;
    }
    textArea.value = convertToCSV(lastParsedData);
  });

  btnJson.addEventListener('click', function(){
    if (!Array.isArray(lastParsedData)) {
      alert("No parsed data to convert.");
      return;
    }
    // Pretty-print the JSON
    textArea.value = JSON.stringify(lastParsedData, null, 2);
  });

  btnNam.addEventListener('click', function(){
    if (!Array.isArray(lastParsedData)) {
      alert("No parsed data to convert.");
      return;
    }
    textArea.value = convertToNam(lastParsedData);
  });

  /* ---------------------------------------------------------
     Below are the client-side helper functions for format 
  --------------------------------------------------------- */
  function convertToCSV(dataArr) {
    // Basic CSV with header: press,hght,temp,dwpt,wdir,wspd
    let lines = [];
    lines.push("press,hght,temp,dwpt,wdir,wspd"); 
    dataArr.forEach(obj => {
      // Ensure each field is safe
      let press = obj.press ?? "";
      let hght  = obj.hght ?? "";
      let temp  = obj.temp ?? "";
      let dwpt  = obj.dwpt ?? "";
      let wdir  = obj.wdir ?? "";
      let wspd  = obj.wspd ?? "";
      lines.push(`${press},${hght},${temp},${dwpt},${wdir},${wspd}`);
    });
    return lines.join("\n");
  }

  function convertToNam(dataArr) {
    // A *rough* example to produce a "ZUVTHDMR"-style .nam text.
    // This is very approximate—actual logic depends on how you invert 
    // T(°C), p(hPa), wdir, wspd, etc. to "virtual potential temperature," 
    // "zonal wind," "merid wind," "mixing ratio," etc.
    // 
    // We'll do something minimal:
    //  1) A fake date/time line
    //  2) 'ZUVTHDMR'
    //  3) groundAlt, groundPresPa, groundThetaV, groundMix
    //  4) windCount, wind lines (z, u, v)
    //  5) tempCount, (z, TH, mix)
    // 
    // We'll guess a barometric formula to get p(hPa)-> Pa, guess "thetaV", guess "mix" from dewpt.
    // If you want real meteorology, you'd do the correct formulas.

    if (dataArr.length < 1) {
      return "RSOU\n(no data)";
    }

    // We'll sort by altitude
    let sorted = [...dataArr].sort((a,b) => a.hght - b.hght);
    // Ground is first
    let ground = sorted[0];

    // We'll do a naive barometric re-conversion from p(hPa) => p(Pa)
    let pPa = (ground.press ?? 1000) * 100;
    let groundAlt  = ground.hght ?? 0;
    
    // We'll guess that "mix" can be derived from dew point & total p => mixing ratio 
    // (the inverse of your dewpointFromMixingRatio). This is approximate:
    function dewptToMix(dwptC, p_hPa) {
      if (dwptC == null || p_hPa <= 0) return 0.0;
      // Reverse the Magnus formula used on server
      // e = 6.112*exp(17.67*Td/(243.5+Td)), then w = 0.622*e/(p-e)
      let e = 6.112*Math.exp((17.67*dwptC)/(243.5+dwptC)); // hPa
      if (e>=p_hPa) e = p_hPa-1e-3; // clamp
      let w = 0.622*e/(p_hPa - e); // kg/kg
      return w;
    }

    // We'll guess we can invert T(°C)-> T(K)->theta_v
    // T(K) = T(°C)+273.15
    // theta_v = T / [ (p/1000)^{-Rd/Cp} * (1+0.61w) ]??? Actually the reverse 
    // from your server code => approximate:
    function approximateThetaV(tempC, p_hPa, w) {
      let T = tempC + 273.15; 
      if (p_hPa <= 0) return 300; 
      let Rd_over_Cp = 0.2857; 
      // T = theta_v / [ (1000/p)^(Rd/Cp)* (1+0.61w ) ]
      // => theta_v = T * (1000/p)^(Rd/Cp) * (1+0.61w)
      return T * Math.pow(1000/p_hPa, Rd_over_Cp) * (1+0.61*w);
    }

    // Build arrays for windBlock and tempBlock
    let windBlock = [];
    let tempBlock = [];

    for (let i=0; i<sorted.length; i++) {
      let row = sorted[i];
      let z = row.hght ?? 0;
      let p_hPa = row.press ?? 1000;
      // Convert wdir/wspd to (u,v)
      // if wdir=0 means from north => let's do 
      //   u = wspd * sin(wdir in radians)
      //   v = wspd * cos(wdir in radians)
      // but the sign conventions vary in meteorology. We'll pick a typical one:
      let dirRad = (row.wdir??0)*(Math.PI/180);
      // "from" direction means wind flows (u,v) outward from that angle. 
      // Many define u=positive east, v=positive north. 
      // A simple approach: 
      let wspd = row.wspd ?? 0;
      let u = wspd * Math.sin(dirRad);
      let v = wspd * Math.cos(dirRad);

      windBlock.push({ z, u, v });

      // For temperature/humidity:
      let tC = row.temp ?? 15;
      let dwC = row.dwpt ?? 10;
      let w = dewptToMix(dwC, p_hPa);
      let thV = approximateThetaV(tC, p_hPa, w);

      tempBlock.push({ z, thetaV: thV, mix: w });
    }

    // ground lines:
    //  groundAlt
    //  groundPressPa
    //  groundThetaV
    //  groundMix
    let groundW = dewptToMix(ground.dwpt??10, ground.press??1000);
    let groundT = approximateThetaV(ground.temp??15, ground.press??1000, groundW);
    let groundPa = (ground.press??1000)*100;

    let lines = [];
    lines.push("RSOU");
    lines.push("2023 01 01 00");       // dummy date/time
    lines.push("'ZUVTHDMR'");         // your kind
    lines.push(String(groundAlt));     // altitude
    lines.push(String(groundPa));      // pressure in Pa
    lines.push(String(groundT.toFixed(2)));   // approximate ground TH
    lines.push((groundW.toExponential(3)));   // ground mix, e.g. "1.234e-03"

    // WInd block
    lines.push(String(windBlock.length));
    windBlock.forEach(wd => {
      lines.push(`${wd.z.toFixed(1)}  ${wd.u.toFixed(2)}  ${wd.v.toFixed(2)}`);
    });

    // T/H block
    lines.push(String(tempBlock.length));
    tempBlock.forEach(td => {
      let zstr = td.z.toFixed(1);
      let thstr = td.thetaV.toFixed(2);
      // E-notation for the mixing ratio
      let mixStr = td.mix.toExponential(3);
      lines.push(`${zstr}  ${thstr}  ${mixStr}`);
    });

    // Possibly final line, e.g. "ZFRC" or anything else
    // lines.push("ZFRC");
    // lines.push("6"); 
    return lines.join("\n");
  }
});
</script>
    </body>
    </html>
    <?php
}