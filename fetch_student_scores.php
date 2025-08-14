<?php
require_once 'php/db_connect.php';

$sql = "SELECT full_name, matric_number, total_score, correct_answers, incorrect_answers, last_quiz_date FROM students";
$result = $conn->query($sql);
$students = [];

if ($result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        $students[] = $row;
    }
    echo json_encode(['status' => 'success', 'students' => $students]);
} else {
    echo json_encode(['status' => 'error', 'message' => 'No student scores found']);
}

$conn->close();
?>