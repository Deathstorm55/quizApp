<?php
ob_start();
require_once 'db_connect.php';

ini_set('display_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

header('Content-Type: application/json; charset=utf-8');

session_start();
$fullName = isset($_SESSION['fullName']) ? trim($_SESSION['fullName']) : '';

if (empty($fullName)) {
    error_log('fetch_results.php: No fullName in session');
    echo json_encode(array('status' => 'error', 'message' => 'User not authenticated', 'answers' => array()));
    ob_end_flush();
    exit;
}

// Fetch student results
$sql = "SELECT total_score, correct_answers, incorrect_answers FROM students WHERE full_name = ?";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    error_log('fetch_results.php: Failed to prepare statement for students - ' . $conn->error);
    echo json_encode(array('status' => 'error', 'message' => 'Database error: Unable to prepare statement', 'answers' => array()));
    ob_end_flush();
    exit;
}
$stmt->bind_param('s', $fullName);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows !== 1) {
    error_log('fetch_results.php: User not found in students table for fullName: ' . $fullName);
    echo json_encode(array('status' => 'error', 'message' => 'User not found', 'answers' => array()));
    ob_end_flush();
    exit;
}

$student = $result->fetch_assoc();
$stmt->close();

// Initialize summary statistics to 0 if null
$student['total_score'] = isset($student['total_score']) ? (int)$student['total_score'] : 0;
$student['correct_answers'] = isset($student['correct_answers']) ? (int)$student['correct_answers'] : 0;
$student['incorrect_answers'] = isset($student['incorrect_answers']) ? (int)$student['incorrect_answers'] : 0;

// Fetch individual answers
$sql = "SELECT question, selected_answer, correct_answer, is_correct FROM quiz_answers WHERE full_name = ? ORDER BY id DESC LIMIT 20";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    error_log('fetch_results.php: Failed to prepare statement for quiz_answers - ' . $conn->error);
    // Return partial data with summary stats
    $response = array(
        'status' => 'success',
        'score' => $student['total_score'],
        'correctAnswers' => $student['correct_answers'],
        'incorrectAnswers' => $student['incorrect_answers'],
        'answers' => array()
    );
    $json_output = json_encode($response, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('fetch_results.php: JSON encoding error - ' . json_last_error_msg());
        echo json_encode(array('status' => 'error', 'message' => 'JSON encoding error: ' . json_last_error_msg()));
    } else {
        echo $json_output;
    }
    ob_end_flush();
    exit;
}
$stmt->bind_param('s', $fullName);
$stmt->execute();
$result = $stmt->get_result();

$answers = array();
$calculatedCorrect = 0;
$calculatedIncorrect = 0;
while ($row = $result->fetch_assoc()) {
    $isCorrect = (bool)$row['is_correct'];
    $answers[] = array(
        'question' => $row['question'],
        'selected' => $row['selected_answer'],
        'correct' => $row['correct_answer'],
        'isCorrect' => $isCorrect
    );
    if ($isCorrect) {
        $calculatedCorrect++;
    } else {
        $calculatedIncorrect++;
    }
}
$stmt->close();

// Update students table if there's a discrepancy
if ($student['correct_answers'] !== $calculatedCorrect || $student['incorrect_answers'] !== $calculatedIncorrect) {
    error_log('fetch_results.php: Discrepancy detected - DB: ' . $student['correct_answers'] . '/' . $student['incorrect_answers'] . ', Calculated: ' . $calculatedCorrect . '/' . $calculatedIncorrect);
    $sql = "UPDATE students SET total_score = ?, correct_answers = ?, incorrect_answers = ? WHERE full_name = ?";
    $stmt = $conn->prepare($sql);
    if ($stmt) {
        $calculatedScore = $calculatedCorrect * 10; // 10 points per correct answer
        $stmt->bind_param('iiis', $calculatedScore, $calculatedCorrect, $calculatedIncorrect, $fullName);
        if ($stmt->execute()) {
            $student['total_score'] = $calculatedScore;
            $student['correct_answers'] = $calculatedCorrect;
            $student['incorrect_answers'] = $calculatedIncorrect;
            error_log('fetch_results.php: Updated students table for ' . $fullName);
        } else {
            error_log('fetch_results.php: Failed to update students table - ' . $conn->error);
        }
        $stmt->close();
    }
}

$conn->close();

$response = array(
    'status' => 'success',
    'score' => $student['total_score'],
    'correctAnswers' => $student['correct_answers'],
    'incorrectAnswers' => $student['incorrect_answers'],
    'answers' => $answers
);

error_log('fetch_results.php: Response - ' . json_encode($response));

$json_output = json_encode($response, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('fetch_results.php: JSON encoding error - ' . json_last_error_msg());
    echo json_encode(array('status' => 'error', 'message' => 'JSON encoding error: ' . json_last_error_msg()));
    ob_end_flush();
    exit;
}

echo $json_output;
ob_end_flush();
?>