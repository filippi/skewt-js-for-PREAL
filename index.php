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
    (function(){
      var skewt = new SkewT('#mySkewt');
      var textArea = document.getElementById('textInput');
      var parseButton = document.getElementById('parseButton');

      // 1) Initial load & display from data.php?file=...
      fetchDataAndPlot("data.php?file=<?php echo urlencode($selectedFile); ?>");

      // 2) Also fetch the *raw* file content to show in textarea
      fetch('raw.php?file=<?php echo urlencode($selectedFile); ?>')
        .then(function(resp){ 
          if (!resp.ok) throw new Error("Failed to load raw text");
          return resp.text();
        })
        .then(function(text){
          textArea.value = text;
        })
        .catch(function(err){
          console.error(err);
          alert("Error loading raw text: " + err);
        });

      // 3) When user clicks "Parse", we send the text to data.php in "raw parse" mode
      parseButton.addEventListener('click', function(){
        var rawText = textArea.value || "";
        // We'll do a POST with raw_text + extension
        var formData = new FormData();
        formData.append('raw_text', rawText);
        formData.append('extension', '<?php echo $extension; ?>');

        fetch('data.php', {
          method: 'POST',
          body: formData
        })
        .then(function(resp){
          if (!resp.ok) {
            throw new Error('Parse request failed: ' + resp.status + ' ' + resp.statusText);
          }
          return resp.json();
        })
        .then(function(jsonData){
          // Clear and re-plot
          skewt.plot(jsonData);
        })
        .catch(function(err){
          console.error("Error re-parsing raw text:", err);
          alert("Error re-parsing raw text: " + err);
        });
      });

      function fetchDataAndPlot(url) {
        fetch(url)
          .then(function(resp){
            if (!resp.ok) throw new Error("Data fetch failed " + resp.status);
            return resp.json();
          })
          .then(function(json){
            skewt.plot(json);
          })
          .catch(function(err){
            console.error(err);
            alert("Failed to fetch or parse data: " + err);
          });
      }
    })();
    </script>
    </body>
    </html>
    <?php
}