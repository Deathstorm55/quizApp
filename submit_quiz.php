<?php
ob_start();
session_start();
require_once 'db_connect.php';

ini_set('display_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_log('submit_quiz.php: Invalid request method - ' . $_SERVER['REQUEST_METHOD']);
    echo json_encode(array('status' => 'error', 'message' => 'Invalid request method'));
    ob_end_flush();
    exit;
}

$fullName = isset($_POST['fullName']) ? trim($_POST['fullName']) : '';
$score = isset($_POST['score']) ? (int)$_POST['score'] : 0;
$correctAnswers = isset($_POST['correctAnswers']) ? (int)$_POST['correctAnswers'] : 0;
$incorrectAnswers = isset($_POST['incorrectAnswers']) ? (int)$_POST['incorrectAnswers'] : 0;
$answersJson = isset($_POST['answers']) ? $_POST['answers'] : '';

if (empty($fullName)) {
    error_log('submit_quiz.php: Missing fullName');
    echo json_encode(array('status' => 'error', 'message' => 'Full name is required'));
    ob_end_flush();
    exit;
}

$answers = json_decode($answersJson, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('submit_quiz.php: JSON decode error - ' . json_last_error_msg() . ' for answers: ' . substr($answersJson, 0, 100));
    echo json_encode(array('status' => 'error', 'message' => 'Invalid answers data: ' . json_last_error_msg()));
    ob_end_flush();
    exit;
}

if (!is_array($answers) || empty($answers)) {
    error_log('submit_quiz.php: Answers array is empty or invalid');
    echo json_encode(array('status' => 'error', 'message' => 'No valid answers provided'));
    ob_end_flush();
    exit;
}

// Validate submitted stats against answers
$calculatedCorrect = 0;
$calculatedIncorrect = 0;
foreach ($answers as $answer) {
    if (!isset($answer['question'], $answer['selected'], $answer['correct'], $answer['isCorrect'])) {
        error_log('submit_quiz.php: Invalid answer format - ' . json_encode($answer));
        continue;
    }
    if ($answer['isCorrect']) {
        $calculatedCorrect++;
    } else {
        $calculatedIncorrect++;
    }
}
$calculatedScore = $calculatedCorrect * 10; // 10 points per correct answer

if ($correctAnswers !== $calculatedCorrect || $incorrectAnswers !== $calculatedIncorrect || $score !== $calculatedScore) {
    error_log('submit_quiz.php: Stats mismatch - Submitted: score=' . $score . ', correct=' . $correctAnswers . ', incorrect=' . $incorrectAnswers .
              ', Calculated: score=' . $calculatedScore . ', correct=' . $calculatedCorrect . ', incorrect=' . $calculatedIncorrect);
    $score = $calculatedScore;
    $correctAnswers = $calculatedCorrect;
    $incorrectAnswers = $calculatedIncorrect;
}

// Log received data
error_log('submit_quiz.php: Received - fullName=' . $fullName . ', score=' . $score . ', correctAnswers=' . $correctAnswers . ', incorrectAnswers=' . $incorrectAnswers . ', answers=' . json_encode($answers));

// Begin transaction
$conn->begin_transaction();

try {
    // Verify user exists
    $sql = "SELECT full_name FROM students WHERE full_name = ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Database error: Unable to prepare user check statement - ' . $conn->error);
    }
    $stmt->bind_param('s', $fullName);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows !== 1) {
        throw new Exception('User not found: ' . $fullName);
    }
    $stmt->close();

    // Update students table
    $sql = "UPDATE students SET total_score = ?, correct_answers = ?, incorrect_answers = ?, last_quiz_date = NOW() WHERE full_name = ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Database error: Unable to prepare update statement - ' . $conn->error);
    }
    $stmt->bind_param('iiis', $score, $correctAnswers, $incorrectAnswers, $fullName);
    if (!$stmt->execute()) {
        throw new Exception('Failed to update student: ' . $conn->error);
    }
    $stmt->close();

    // Insert individual answers
    $sql = "INSERT INTO quiz_answers (full_name, question, selected_answer, correct_answer, is_correct) VALUES (?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('Database error: Unable to prepare answers insert statement - ' . $conn->error);
    }
    foreach ($answers as $answer) {
        $question = isset($answer['question']) ? trim($answer['question']) : '';
        $selected = isset($answer['selected']) ? trim($answer['selected']) : '';
        $correct = isset($answer['correct']) ? trim($answer['correct']) : '';
        $isCorrect = isset($answer['isCorrect']) && $answer['isCorrect'] ? 1 : 0;

        if (empty($question) || empty($selected) || empty($correct)) {
            error_log('submit_quiz.php: Skipping invalid answer - question=' . $question . ', selected=' . $selected . ', correct=' . $correct);
            continue;
        }

        $stmt->bind_param('sssss', $fullName, $question, $selected, $correct, $isCorrect);
        if (!$stmt->execute()) {
            throw new Exception('Failed to save answer: ' . $conn->error);
        }
    }
    $stmt->close();

    $conn->commit();
    error_log('submit_quiz.php: Successfully saved quiz results for ' . $fullName);
    echo json_encode(array('status' => 'success', 'message' => 'Quiz results saved successfully'));
} catch (Exception $e) {
    $conn->rollback();
    error_log('submit_quiz.php: Transaction failed - ' . $e->getMessage());
    echo json_encode(array('status' => 'error', 'message' => 'Failed to save quiz results: ' . $e->getMessage()));
}

$conn->close();
ob_end_flush();
?>