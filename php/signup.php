<?php
ob_start();
require_once 'db_connect.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $fullName = trim($_POST['fullName'] ?? '');
    
    if (empty($fullName)) {
        echo json_encode(['status' => 'error', 'message' => 'Full name is required']);
        exit;
    }

    // Check for duplicate name
    $checkName = $conn->prepare("SELECT id FROM students WHERE full_name = ?");
    $checkName->bind_param('s', $fullName);
    $checkName->execute();
    
    if ($checkName->get_result()->num_rows > 0) {
        echo json_encode(['status' => 'error', 'message' => 'This name is already registered']);
        exit;
    }

    // Generate unique matric number
    $currentYear = date('Y');
    $matricNumber = "ODO/$currentYear/" . rand(1000, 9999);
    $defaultPassword = password_hash('odo123', PASSWORD_DEFAULT);

    // Insert new student
    $stmt = $conn->prepare("INSERT INTO students (full_name, matric_number, password) VALUES (?, ?, ?)");
    $stmt->bind_param('sss', $fullName, $matricNumber, $defaultPassword);
    
    if ($stmt->execute()) {
        echo json_encode([
            'status' => 'success', 
            'matricNumber' => $matricNumber,
            'redirect' => 'login.html'
        ]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Registration failed: ' . $conn->error]);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
}

ob_end_flush();
?>