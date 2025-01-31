<?php
// raw.php
if (!isset($_GET['file'])) {
    http_response_code(400);
    echo "No file specified.";
    exit;
}

$file = basename($_GET['file']);
$path = "data/$file";

if (!file_exists($path)) {
    http_response_code(404);
    echo "File not found.";
    exit;
}

// Return file contents as text
header("Content-Type: text/plain");
echo file_get_contents($path);