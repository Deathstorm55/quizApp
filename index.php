<?php
ob_start();
session_start();
require_once 'db_connect.php';

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

if (!isset($_SESSION['fullName']) || empty($_SESSION['fullName'])) {
    header('Location: login.html');
    ob_end_flush();
    exit;
}

$sessionSeed = crc32(session_id());
$conn->query("SET @seed = $sessionSeed");
$conn->query("SET SESSION rand_seed1 = @seed");
$conn->query("SET SESSION rand_seed2 = @seed");

$fullName = $_SESSION['fullName'];
$sql = "SELECT full_name FROM students WHERE full_name = ?";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    error_log('Database error in index.php: Unable to prepare statement - ' . $conn->error);
    echo json_encode(array('status' => 'error', 'message' => 'Database error: ' . $conn->error));
    ob_end_flush();
    exit;
}
$stmt->bind_param('s', $fullName);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows !== 1) {
    session_destroy();
    header('Location: login.html');
    ob_end_flush();
    exit;
}
$stmt->close();

$sql = "SELECT id, question, category, option_a, option_b, option_c, option_d, correct_answer 
        FROM questions 
        ORDER BY RAND() 
        LIMIT 40";
$result = $conn->query($sql);
if (!$result) {
    error_log('Database query error in index.php: ' . $conn->error);
    echo json_encode(array('status' => 'error', 'message' => 'Failed to fetch questions: ' . $conn->error));
    ob_end_flush();
    exit;
}

$questions = array();
while ($row = $result->fetch_assoc()) {
    $questions[] = array(
        'id' => $row['id'],
        'question' => $row['question'],
        'category' => $row['category'],
        'options' => array(
            'a' => $row['option_a'],
            'b' => $row['option_b'],
            'c' => $row['option_c'],
            'd' => $row['option_d']
        ),
        'correct_answer' => $row['correct_answer']
    );
}
$conn->close();

$questions_json = json_encode($questions, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
if (json_last_error() !== JSON_ERROR_NONE) {
    error_log('JSON encoding error in index.php: ' . json_last_error_msg());
    echo json_encode(array('status' => 'error', 'message' => 'Failed to encode questions: ' . json_last_error_msg()));
    ob_end_flush();
    exit;
}

error_log('Questions JSON output: ' . $questions_json);

ob_end_flush();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Igbara Quiz App</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <h1>🎓 Igbara Quiz App</h1>
        <p>Fun Revision Quizzes for Smart Teens!</p>
    </header>

    <section class="form-container">
        <p id="authMessage" class="hidden"></p>
        <form id="assessmentForm" class="<?php echo isset($_SESSION['fullName']) && !empty($_SESSION['fullName']) ? '' : 'hidden'; ?>">
            <div class="form-group">
                <label for="fullName">Your Name</label>
                <input type="text" id="fullName" name="fullName" value="<?php echo htmlspecialchars($_SESSION['fullName']); ?>" readonly>
            </div>
            <div class="form-group">
                <label>Quiz Mode</label>
                <p class="fixed-mode">10-Minute Quiz Session</p>
            </div>
            <button type="submit">Start Quiz 🚀</button>
        </form>
        <p class="signup-link">Not you? <a href="login.html">Log In as another user</a></p>
    </section>

    <section class="welcome-section hidden" id="welcomeSection">
        <h2>Welcome, <span id="userName"><?php echo htmlspecialchars($_SESSION['fullName']); ?></span>!</h2>
        <p>Ready to revise and shine?</p>
    </section>

    <section class="stats-section hidden" id="statsSection">
        <div class="stat">
            <p id="progress">0/<?php echo count($questions); ?></p>
            <p>Progress</p>
        </div>
        <div class="stat">
            <p id="timeLeft">600</p>
            <p>Time Left (Seconds)</p>
        </div>
    </section>

    <section class="controls-section hidden" id="controlsSection">
        <div class="controls">
            <button id="changeUser">👤 Log Out</button>
        </div>
    </section>

    <section class="question-section hidden" id="questionSection">
        <div class="question-header">
            <p>Question <span id="questionNumber">1</span> of <?php echo count($questions); ?></p>
            <p id="questionCategory">Revision Topic</p>
        </div>
        <div id="questionContent">
            <!-- Question content will be dynamically inserted here -->
        </div>
    </section>

    <section class="modal hidden" id="scoreModal">
        <div class="modal-content">
            <h3>📊 Quiz Progress</h3>
            <div id="scoreDetails">
                <!-- Score details will be dynamically inserted here -->
            </div>
            <button id="closeModal">Close</button>
        </div>
    </section>

    <script>
    window.questions = <?php 
        echo isset($questions_json) && !empty($questions_json) 
            ? $questions_json 
            : '[]';
    ?>;
    console.log('PHP->JS Questions:', window.questions);
    </script>
    <script src="scripts.js"></script>
</body>
</html>