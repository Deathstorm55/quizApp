<?php
ob_start();
require_once 'php/db_connect.php';

ini_set('display_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $fullName = isset($_POST['fullName']) ? trim($_POST['fullName']) : '';
    $password = isset($_POST['password']) ? $_POST['password'] : '';

    if (empty($fullName) || empty($password)) {
        echo json_encode(array('status' => 'error', 'message' => 'Full name and password are required'));
        ob_end_flush();
        exit;
    }

    $sql = "SELECT password FROM students WHERE full_name = ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        echo json_encode(array('status' => 'error', 'message' => 'Database error: Unable to prepare statement'));
        ob_end_flush();
        exit;
    }
    $stmt->bind_param('s', $fullName);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $row = $result->fetch_assoc();
        if (password_verify($password, $row['password'])) {
            session_start();
            $_SESSION['fullName'] = $fullName;
            echo json_encode(array('status' => 'success'));
        } else {
            echo json_encode(array('status' => 'error', 'message' => 'Incorrect password'));
        }
    } else {
        echo json_encode(array('status' => 'error', 'message' => 'User not found'));
    }

    $stmt->close();
    $conn->close();
} else {
    echo json_encode(array('status' => 'error', 'message' => 'Invalid request method'));
}

ob_end_flush();
?>