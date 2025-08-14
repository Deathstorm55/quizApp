<?php
require_once 'db_connect.php';

$sql = "SELECT * FROM questions ORDER BY RAND() LIMIT 50";
$result = $conn->query($sql);
$questions = [];

while ($row = $result->fetch_assoc()) {
    $questions[] = $row;
}

$conn->close();
header('Content-Type: application/json');
echo json_encode($questions);
?>