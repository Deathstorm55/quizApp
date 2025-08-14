<?php
ob_start();
require_once 'db_connect.php';

ini_set('display_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $questionText = trim($_POST['questionText'] ?? '');
    $correctAnswer = trim($_POST['correctAnswer'] ?? '');
    $optionA = trim($_POST['optionA'] ?? '');
    $optionB = trim($_POST['optionB'] ?? '');
    $optionC = trim($_POST['optionC'] ?? '');
    $optionD = trim($_POST['optionD'] ?? '');
    $category = trim($_POST['category'] ?? '');

    // Validate inputs
    if (empty($questionText) || empty($correctAnswer) || empty($optionA) || empty($optionB) || empty($optionC) || empty($optionD) || empty($category)) {
        echo json_encode(['status' => 'error', 'message' => 'All fields are required']);
        ob_end_flush();
        exit;
    }

    // Ensure correct answer is one of the options
    if (!in_array($correctAnswer, [$optionA, $optionB, $optionC, $optionD])) {
        echo json_encode(['status' => 'error', 'message' => 'Correct answer must match one of the options']);
        ob_end_flush();
        exit;
    }

    // Insert question into database
    $sql = "INSERT INTO questions (question, correct_answer, option_a, option_b, option_c, option_d, category) VALUES (?, ?, ?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(['status' => 'error', 'message' => 'Database error: Unable to prepare statement']);
        ob_end_flush();
        exit;
    }
    $stmt->bind_param('sssssss', $questionText, $correctAnswer, $optionA, $optionB, $optionC, $optionD, $category);

    if ($stmt->execute()) {
        echo json_encode(['status' => 'success', 'message' => 'Question uploaded successfully']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Failed to upload question: ' . $conn->error]);
    }

    $stmt->close();
    $conn->close();
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
}

ob_end_flush();
?>