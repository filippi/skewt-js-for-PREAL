<?php
// data.php
header("Content-Type: application/json");

// Optional: disable error reporting in production
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE & ~E_WARNING);
ini_set('display_errors', 0);

/* -----------------------------------------------------------------
   1) Check if we received raw text via POST for re-parsing
   ----------------------------------------------------------------- */
if (isset($_POST['raw_text'])) {
    // parse from the text in memory
    $rawText   = $_POST['raw_text'];
    $extension = isset($_POST['extension']) ? strtolower($_POST['extension']) : 'csv';

    $data = [];
    switch ($extension) {
        case 'json':
            $data = handleJsonString($rawText);
            break;
        case 'csv':
            $data = handleCsvString($rawText);
            break;
        case 'nam':
            $data = handleNamString($rawText);
            break;
        default:
            http_response_code(400);
            echo json_encode(["error" => "Unsupported extension: $extension"]);
            exit;
    }
    // Output the parsed data
    echo json_encode($data);
    exit; // Stop here
}

/* -----------------------------------------------------------------
   2) If no POST, fall back to GET ?file=...
   ----------------------------------------------------------------- */
if (!isset($_GET['file'])) {
    http_response_code(400);
    echo json_encode(["error" => "No file specified (GET 'file') and no raw_text (POST)."]);
    exit;
}

$file = basename($_GET['file']);
$directory = "data";
$path = "$directory/$file";

if (!file_exists($path)) {
    http_response_code(404);
    echo json_encode(["error" => "File not found."]);
    exit;
}

// Check if user wants a download
$download = isset($_GET['download']);

// Identify extension & parse from file
$fileExtension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
$data = [];

switch ($fileExtension) {
    case 'json':
        $data = handleJson($path);
        break;
    case 'csv':
        $data = handleCsv($path);
        break;
    case 'nam':
        $data = handleNam($path);
        break;
    default:
        http_response_code(400);
        echo json_encode(["error" => "Unsupported file type: $fileExtension"]);
        exit;
}

// Output the data
if ($download) {
    header('Content-Disposition: attachment; filename="parsed.json"');
}
echo json_encode($data);


/* -----------------------------------------------------------------
   Below are the same parse logic from your prior code
   (splitting out "string-based" vs "file-based" as needed).
   ----------------------------------------------------------------- */

/* -------------------------------
   JSON from file or string
------------------------------- */
function handleJson($path) {
    $json = file_get_contents($path);
    return handleJsonString($json);
}
function handleJsonString($raw) {
    $decoded = json_decode($raw, true);
    if ($decoded === null) {
        http_response_code(500);
        return ["error" => "Invalid JSON data."];
    }
    return $decoded;
}

/* -------------------------------
   CSV from file or string
------------------------------- */
function handleCsv($path) {
    $raw = @file_get_contents($path);
    if ($raw === false) {
        return ["error" => "Unable to read CSV file."];
    }
    return handleCsvString($raw);
}
function handleCsvString($rawText) {
    // We'll open a temporary stream, feed it to parseCsvFromHandle
    $temp = tmpfile();
    fwrite($temp, $rawText);
    fseek($temp, 0);
    $data = parseCsvFromHandle($temp);
    fclose($temp);
    return $data;
}
function parseCsvFromHandle($handle) {
    $data_blocks   = [];
    $current_block = [];
    $headers       = [];

    while (($row = fgetcsv($handle, 0, ",", "\\", "\\")) !== false) {
        if (isset($row[0]) && strtolower(trim($row[0])) === 'numer_sta') {
            if (!empty($current_block)) {
                $data_blocks[] = $current_block;
                $current_block = [];
            }
            // Skip next metadata lines + header line
            fgetcsv($handle, 0, ",", "\\", "\\");
            fgetcsv($handle, 0, ",", "\\", "\\");
            $headers = fgetcsv($handle, 0, ",", "\\", "\\");
            continue;
        }
        // Skip header line if encountered unexpectedly
        if (isset($row[0]) && strtolower(trim($row[0])) === 'p_niv') {
            continue;
        }
        // Collect data rows
        if (!empty($headers) && count($row) >= 6) {
            $current_block[] = [
                "press" => floatval($row[0]) / 100,    // Pa->hPa
                "hght"  => floatval($row[1]),         // m
                "temp"  => floatval($row[2]) - 273.15,// K->°C
                "dwpt"  => floatval($row[3]) - 273.15,// K->°C
                "wdir"  => floatval($row[4]),         // deg
                "wspd"  => floatval($row[5])          // m/s
            ];
        }
    }
    if (!empty($current_block)) {
        $data_blocks[] = $current_block;
    }
    if (!empty($data_blocks)) {
        return end($data_blocks);
    }
    return [];
}

/* -------------------------------
   NAM from file or string
------------------------------- */
function handleNam($path) {
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return ["error" => "Unable to read NAM file."];
    }
    return parseNamLines($lines);
}
function handleNamString($rawText) {
    $lines = preg_split('/\r\n|\r|\n/', $rawText);
    $lines = array_map('trim', $lines);
    $lines = array_filter($lines, 'strlen');
    $lines = array_values($lines);
    return parseNamLines($lines);
}

/**
 * The main logic for "ZUVTHDMR".
 */
function parseNamLines($lines) {
    $lines = array_map('trim', $lines);

    // 1) Find "RSOU"
    $index = 0;
    for (; $index < count($lines); $index++) {
        if (strtoupper($lines[$index]) === 'RSOU') {
            break;
        }
    }
    if ($index >= count($lines)) {
        return ["error" => "NAM file not in expected RSOU format (no 'RSOU' found)."];
    }
    $index++; // skip RSOU

    // 2) Date/time (optional)
    $dateLine = isset($lines[$index]) ? $lines[$index] : "";
    $index++;

    // 3) KIND
    $kind = isset($lines[$index]) ? $lines[$index] : "";
    $index++;
    if (strpos(strtoupper($kind), 'ZUVTHDMR') === false) {
        return ["error" => "Unsupported KIND (expected ZUVTHDMR)."];
    }

    // 4) Ground-level lines
    if ($index + 3 >= count($lines)) {
        return ["error" => "NAM file format incomplete (ground-level lines)."];
    }
    $groundAlt      = floatval($lines[$index++]);
    $groundPresPa   = floatval($lines[$index++]);
    $groundThetaV   = parseSciFloat($lines[$index++]);
    $groundMix      = parseSciFloat($lines[$index++]);

    $groundPres_hPa = $groundPresPa / 100.0;

    // 5) Wind block
    if ($index >= count($lines)) {
        return ["error" => "NAM file format incomplete (wind count)."];
    }
    $nWind = intval($lines[$index++]);
    $windData = [];
    for ($i = 0; $i < $nWind; $i++) {
        if ($index >= count($lines)) break;
        $parts = preg_split('/\s+/', $lines[$index]);
        $index++;
        if (count($parts) < 3) {
            continue;
        }
        $z = floatval($parts[0]);
        $u = floatval($parts[1]);
        $v = floatval($parts[2]);
        $windData[] = compact('z','u','v');
    }

    // 6) Temp/humidity block
    if ($index >= count($lines)) {
        return ["error" => "NAM file format incomplete (temp/humidity count)."];
    }
    $nTemp = intval($lines[$index++]);
    $tempData = [];
    for ($i = 0; $i < $nTemp; $i++) {
        if ($index >= count($lines)) break;
        $parts = preg_split('/\s+/', $lines[$index]);
        $index++;
        if (count($parts) < 3) {
            continue;
        }
        $z      = floatval($parts[0]);
        $thetaV = parseSciFloat($parts[1]);
        $mix    = parseSciFloat($parts[2]);
        $tempData[] = [
            'z' => $z,
            'thetaV' => $thetaV,
            'mix' => $mix
        ];
    }

    // 7) Collect altitudes
    $allAlt = [$groundAlt];
    foreach ($windData as $wd) {
        $allAlt[] = $wd['z'];
    }
    foreach ($tempData as $td) {
        $allAlt[] = $td['z'];
    }
    $allAlt = array_unique($allAlt);
    sort($allAlt);

    // 8) Interpolate
    $R_over_Cp = 0.2857; // ~ Rd/Cp
    $final = [];
    foreach ($allAlt as $z) {
        // Pressure
        $p_hPa = ($z <= $groundAlt)
            ? $groundPres_hPa
            : ($groundPres_hPa * exp(-($z - $groundAlt)/8400.0));

        // Theta_v & mix
        $thetaV = ($z == $groundAlt)
            ? $groundThetaV
            : linearInterp($z, $tempData, 'thetaV', $groundAlt, $groundThetaV);
        $mix = ($z == $groundAlt)
            ? $groundMix
            : linearInterp($z, $tempData, 'mix', $groundAlt, $groundMix);

        // Actual T(K) from \theta_v => T(K)
        // T = thetaV / [ (1000/p)^(R_d/c_p) * (1+0.61*mix ) ]
        $tempK = null;
        if ($p_hPa > 0) {
            $tempK = $thetaV / ( pow(1000.0/$p_hPa, $R_over_Cp) * (1.0 + 0.61*$mix) );
        }
        $tempC = is_null($tempK) ? null : $tempK - 273.15;

        // Wind (u,v) => wspd, wdir
        $u = linearInterp($z, $windData, 'u', $groundAlt, 0.0);
        $v = linearInterp($z, $windData, 'v', $groundAlt, 0.0);
        $wspd = sqrt($u*$u + $v*$v);
        $wdir = rad2deg(atan2($u,$v));
        $wdir = fmod($wdir+360,360);

        // Dew point
        $dwptC = null;
        if (!is_null($tempK) && $p_hPa > 0 && $mix > 0) {
            $dwptC = dewpointFromMixingRatio($mix, $p_hPa);
        }

        $final[] = [
            'press' => round($p_hPa,3),
            'hght'  => $z,
            'temp'  => is_null($tempC)? null : round($tempC,2),
            'dwpt'  => is_null($dwptC)? null : round($dwptC,2),
            'wdir'  => round($wdir,2),
            'wspd'  => round($wspd,3)
        ];
    }
    return $final;
}

/* ----------------------------------------------------------------------------------
   Helpers
---------------------------------------------------------------------------------- */

/**
 * parseSciFloat() - handle scientific notation
 */
function parseSciFloat($str) {
    $fixed = preg_replace('/E([+-]?)(\d+)/i','E$1$2',$str);
    return floatval($fixed);
}

/**
 * linearInterp() - linearly interpolate a property $field by altitude.
 */
function linearInterp($z, $data, $field, $groundZ, $groundVal) {
    if (empty($data)) {
        return ($z == $groundZ) ? $groundVal : $groundVal;
    }
    // Check exact
    foreach ($data as $d) {
        if (abs($d['z'] - $z)<1e-6) {
            return $d[$field];
        }
    }
    // Sort by z
    usort($data,function($a,$b){return $a['z']<=>$b['z'];});

    // Clamp
    if ($z<$data[0]['z']) {
        return $data[0][$field];
    }
    if ($z>$data[count($data)-1]['z']) {
        return $data[count($data)-1][$field];
    }

    // Interpolate
    for ($i=0; $i<count($data)-1; $i++) {
        $z1 = $data[$i]['z'];
        $z2 = $data[$i+1]['z'];
        if ($z1<=$z && $z<=$z2) {
            $y1 = $data[$i][$field];
            $y2 = $data[$i+1][$field];
            if (abs($z2-$z1)<1e-9) return $y1;
            $t = ($z-$z1)/($z2-$z1);
            return $y1 + $t*($y2-$y1);
        }
    }
    return end($data)[$field];
}

/**
 * dewpointFromMixingRatio() - approximate Tdew (°C) from w (kg/kg) & p (hPa).
 */
function dewpointFromMixingRatio($w, $p_hPa) {
    // e = (w * p)/(0.622 + w)
    $e = ($w * $p_hPa)/(0.622 + $w);
    if ($e<=0) return null;
    // Tdew(C) = (243.5 * ln(e/6.112)) / (17.67 - ln(e/6.112))
    $lnTerm = log($e/6.112);
    $tdC = (243.5 * $lnTerm)/(17.67 - $lnTerm);
    return $tdC;
}