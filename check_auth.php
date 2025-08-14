<?php
ob_start();
session_start();
require_once 'php/db_connect.php';

header('Content-Type: application/json; charset=utf-8');

if (isset($_SESSION['fullName']) && !empty($_SESSION['fullName'])) {
    $fullName = $_SESSION['fullName'];
    $sql = "SELECT full_name FROM students WHERE full_name = ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(array('status' => 'error', 'message' => 'Database error: ' . $conn->error));
        ob_end_flush();
        exit;
    }
    $stmt->bind_param('s', $fullName);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        echo json_encode(array('status' => 'success'));
    } else {
        echo json_encode(array('status' => 'error', 'message' => 'User not found'));
    }
    $stmt->close();
} else {
    echo json_encode(array('status' => 'error', 'message' => 'Not authenticated'));
}

$conn->close();
ob_end_flush();
?>