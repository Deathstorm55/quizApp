<?php
ob_start();
require_once 'db_connect.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $fullName = isset($_POST['fullName']) ? trim($_POST['fullName']) : '';
    
    if (empty($fullName)) {
        echo json_encode(array('status' => 'error', 'message' => 'Full name is required'));
        ob_end_flush();
        exit;
    }

    $checkName = $conn->prepare("SELECT id FROM students WHERE full_name = ?");
    if (!$checkName) {
        echo json_encode(array('status' => 'error', 'message' => 'Database error: Unable to prepare statement'));
        ob_end_flush();
        exit;
    }
    $checkName->bind_param('s', $fullName);
    $checkName->execute();
    $result = $checkName->get_result();
    
    if ($result->num_rows > 0) {
        echo json_encode(array('status' => 'error', 'message' => 'This name is already registered'));
        $checkName->close();
        ob_end_flush();
        exit;
    }
    $checkName->close();

    $currentYear = date('Y');
    $matricNumber = "ODO/$currentYear/" . rand(1000, 9999);
    $defaultPassword = password_hash('odo123', PASSWORD_DEFAULT);

    $stmt = $conn->prepare("INSERT INTO students (full_name, matric_number, password) VALUES (?, ?, ?)");
    if (!$stmt) {
        echo json_encode(array('status' => 'error', 'message' => 'Database error: Unable to prepare statement'));
        ob_end_flush();
        exit;
    }
    $stmt->bind_param('sss', $fullName, $matricNumber, $defaultPassword);
    
    if ($stmt->execute()) {
        echo json_encode(array(
            'status' => 'success', 
            'matricNumber' => $matricNumber,
            'redirect' => 'login.html'
        ));
    } else {
        echo json_encode(array('status' => 'error', 'message' => 'Registration failed: ' . $conn->error));
    }
    $stmt->close();
} else {
    echo json_encode(array('status' => 'error', 'message' => 'Invalid request method'));
}

$conn->close();
ob_end_flush();
?>