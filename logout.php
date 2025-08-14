<?php
ob_start();
session_start();
session_destroy();
header('Content-Type: application/json; charset=utf-8');
echo json_encode(array('status' => 'success'));
ob_end_flush();
?>