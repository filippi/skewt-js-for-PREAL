<?php
// index.php

// Function to safely get the list of CSV files
function getCsvFiles($dir = 'data') {
    $files = [];
    if (is_dir($dir)) {
        if ($dh = opendir($dir)) {
            while (($file = readdir($dh)) !== false) {
                if (pathinfo($file, PATHINFO_EXTENSION) === 'csv') {
                    $files[] = $file;
                }
            }
            closedir($dh);
        }
    }
    return $files;
}

$csvFiles = getCsvFiles();
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

<?php if (!isset($_GET['file'])): ?>
 <div class="file-list">
    <h2>Available CSV Files</h2>
    <ul>
        <?php
        if (empty($csvFiles)) {
            echo '<li>No CSV files found in the "data" directory.</li>';
        } else {
            // Sort the files by name
            sort($csvFiles);
            
            // Loop through sorted files
            foreach ($csvFiles as $file) {
                echo '<li class="file-item">';
                echo '<a href="?file=' . urlencode($file) . '">' . htmlspecialchars($file) . '</a>';
                echo '</li>';
            }
        }
        ?>
    </ul>
</div>
<?php else: 
    // Get the file parameter and sanitize it
    $selectedFile = basename($_GET['file']);
    if (!in_array($selectedFile, $csvFiles)) {
        echo "<p>Error: File not found.</p>";
        exit;
    }
    ?>
    <div>
        <a href="index.php">← Back to File List</a>
    </div>
    <h2>Displaying: <?php echo htmlspecialchars($selectedFile); ?></h2>
    <div id="mySkewt" class="skew-t"></div>

    <!-- Include Skew-T JS library -->
    <script src="dist/bundle.js"></script>
    <!-- Include D3.js if not bundled; but according to your library, D3 is bundled -->
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            // Initialize SkewT
            var skewt = new SkewT('#mySkewt');

            // Fetch the data using AJAX
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'data.php?file=<?php echo urlencode($selectedFile); ?>', true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            var soundingData = JSON.parse(xhr.responseText);
                            skewt.plot(soundingData);
                        } catch (e) {
                            console.error('Error parsing JSON:', e);
                            alert('Failed to parse data.');
                        }
                    } else {
                        console.error('Error fetching data:', xhr.statusText);
                        alert('Failed to fetch data.');
                    }
                }
            };
            xhr.send();
        });
    </script>
<?php endif; ?>

</body>
</html>