<?php
// data.php
header("Content-Type: application/json");

// Optional: Disable error reporting for production to prevent PHP warnings from corrupting JSON output
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE & ~E_WARNING);
ini_set('display_errors', 0);

if (!isset($_GET['file'])) {
    http_response_code(400);
    echo json_encode(["error" => "No file specified."]);
    exit;
}

$file = basename($_GET['file']); // Sanitize the file name to prevent directory traversal
$directory = "data";
$path = "$directory/$file";

if (!file_exists($path)) {
    http_response_code(404);
    echo json_encode(["error" => "File not found."]);
    exit;
}

$data_blocks = []; // Array to hold all data blocks
$current_block = []; // Array to hold the current data block
$headers = []; // To store column headers

// Open the CSV file for reading
if (($handle = fopen($path, "r")) !== false) {
    while (($row = fgetcsv($handle, 0, ",", "\\", "\\")) !== false) {
        // Detect the start of a new data block
        if (isset($row[0]) && strtolower(trim($row[0])) === 'numer_sta') {
            // If a previous block exists, save it
            if (!empty($current_block)) {
                $data_blocks[] = $current_block;
                $current_block = [];
            }

            // Read the next two metadata lines
            $metadata1 = fgetcsv($handle, 0, ",", "\\", "\\");
            $metadata2 = fgetcsv($handle, 0, ",", "\\", "\\");

            // Read the headers line
            $headers = fgetcsv($handle, 0, ",", "\\", "\\");

            // Continue to the next iteration to start collecting data rows
            continue;
        }

        // Skip the headers line if encountered unexpectedly
        if (isset($row[0]) && strtolower(trim($row[0])) === 'p_niv') {
            continue;
        }

        // Collect data rows if headers are defined and row has sufficient columns
        if (!empty($headers) && count($row) >= 6) {
            $current_block[] = [
                "press" => floatval($row[0]) / 100,          // Convert p_niv to hPa (pressure in millibars)
                "hght"  => floatval($row[1]),                // Altitude in meters
                "temp"  => floatval($row[2]) - 273.15,       // Convert Kelvin to Celsius
                "dwpt"  => floatval($row[3]) - 273.15,       // Convert Kelvin to Celsius
                "wdir"  => floatval($row[4]),                // Wind direction in degrees
                "wspd"  => floatval($row[5])                 // Wind speed in m/s
            ];
        }
    }

    // After reading all lines, save the last block
    if (!empty($current_block)) {
        $data_blocks[] = $current_block;
    }

    fclose($handle);
}

// Select the desired data block
// Assuming that the "up" run is the last data block
if (!empty($data_blocks)) {
    $data = end($data_blocks);
} else {
    $data = []; // No data found
}

// Return the transformed data as JSON
echo json_encode($data);
?>