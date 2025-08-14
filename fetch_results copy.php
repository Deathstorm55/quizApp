<?php
ob_start();
require_once 'db_connect.php';

ini_set('display_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

header('Content-Type: application/json');

session_start();
$fullName = $_SESSION['fullName'] ?? '';

if (empty($fullName)) {
    echo json_encode(['status' => 'error', 'message' => 'User not authenticated']);
    ob_end_flush();
    exit;
}

// Fetch student results
$sql = "SELECT total_score, correct_answers, incorrect_answers FROM students WHERE full_name = ?";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo json_encode(['status' => 'error', 'message' => 'Database error: Unable to prepare statement']);
    ob_end_flush();
    exit;
}
$stmt->bind_param('s', $fullName);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows !== 1) {
    echo json_encode(['status' => 'error', 'message' => 'User not found']);
    ob_end_flush();
    exit;
}

$student = $result->fetch_assoc();
$stmt->close();

// Fetch individual answers
$sql = "SELECT question, selected_answer, correct_answer, is_correct FROM quiz_answers WHERE full_name = ? ORDER BY id DESC LIMIT 20";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo json_encode(['status' => 'error', 'message' => 'Database error: Unable to prepare statement']);
    ob_end_flush();
    exit;
}
$stmt->bind_param('s', $fullName);
$stmt->execute();
$result = $stmt->get_result();

$answers = [];
while ($row = $result->fetch_assoc()) {
    $answers[] = [
        'question' => $row['question'],
        'selected' => $row['selected_answer'],
        'correct' => $row['correct_answer'],
        'isCorrect' => (bool)$row['is_correct']
    ];
}
$stmt->close();
$conn->close();

echo json_encode([
    'status' => 'success',
    'score' => $student['total_score'],
    'correctAnswers' => $student['correct_answers'],
    'incorrectAnswers' => $student['incorrect_answers'],
    'answers' => $answers
]);

ob_end_flush();
?>