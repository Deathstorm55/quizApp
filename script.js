document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const assessmentForm = document.getElementById('assessmentForm');
    const welcomeSection = document.getElementById('welcomeSection');
    const statsSection = document.getElementById('statsSection');
    const controlsSection = document.getElementById('controlsSection');
    const questionSection = document.getElementById('questionSection');
    const scoreModal = document.getElementById('scoreModal');
    const userNameSpan = document.getElementById('userName');
    const shuffleQuestionsBtn = document.getElementById('shuffleQuestions');
    const resetAssessmentBtn = document.getElementById('resetAssessment');
    const scoreProgressBtn = document.getElementById('scoreProgress');
    const changeUserBtn = document.getElementById('changeUser');
    const closeModalBtn = document.getElementById('closeModal');
    const timeLeftSpan = document.getElementById('timeLeft');
    const addQuestionBtn = document.getElementById('addQuestion');
    const questionModal = document.getElementById('questionModal');
    const closeQuestionModalBtn = document.getElementById('closeQuestionModal');
    const questionForm = document.getElementById('questionForm');
    const resultsTable = document.getElementById('resultsTable');
    const printResultsBtn = document.getElementById('printResults');
    const authMessage = document.getElementById('authMessage');

    // Quiz State Variables
    let timeLeft = 600; // 10 minutes in seconds
    let timerInterval;
    let currentQuestions = Array.isArray(window.questions) ? window.questions : [];
    let currentQuestionIndex = 0;
    let userAnswers = [];
    let score = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let isSubmitting = false;

    // Debug: Verify questions are loaded
    console.log('Questions loaded:', currentQuestions);

    // Authentication Check
    const checkAuth = () => {
        if (!authMessage) return;

        fetch('check_auth.php', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        })
        .then(handleJSONResponse)
        .then(data => {
            if (!data || data.status !== 'success') {
                showAuthError(data?.message || 'Please log in to access the quiz.');
            }
        })
        .catch(error => {
            showAuthError(`Error: ${error.message}`);
        });
    };

    const showAuthError = (message) => {
        authMessage.classList.remove('hidden');
        authMessage.textContent = message;
        authMessage.style.color = '#dc2626';
        if (assessmentForm) assessmentForm.classList.add('hidden');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    };

    // Response Handler
    const handleJSONResponse = (response) => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            return response.text().then(text => {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    throw new Error(`Expected JSON, got ${contentType}: ${text.substring(0, 100)}`);
                }
            });
        }
        return response.json();
    };

    // Timer Functions
    const startTimer = () => {
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                submitQuiz();
            }
        }, 1000);
    };

    const updateTimerDisplay = () => {
        if (timeLeftSpan) {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timeLeftSpan.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }
    };

    // Question Display
    const displayQuestion = () => {
        if (!Array.isArray(currentQuestions) || currentQuestions.length === 0) {
            showNoQuestionsError();
            return;
        }

        const question = currentQuestions[currentQuestionIndex];
        const isLastQuestion = currentQuestionIndex === currentQuestions.length - 1;
        const questionContent = document.getElementById('questionContent');

        document.getElementById('questionNumber').textContent = currentQuestionIndex + 1;
        document.getElementById('questionCategory').textContent = question.category || 'General';

        questionContent.innerHTML = `
            <div class="question-text">
                <p>${question.question}</p>
            </div>
            <form id="answerForm">
                ${generateOptions(question)}
                <div class="question-actions">
                    ${generateNavigationButtons(isLastQuestion)}
                </div>
            </form>
            ${generateQuestionBoxes()}
        `;

        setupQuestionEventListeners(isLastQuestion);
    };

    const generateOptions = (question) => {
        return ['a', 'b', 'c', 'd'].map(option => `
            <label>
                <input type="radio" name="answer" value="${question.options[option]}" 
                    ${userAnswers[currentQuestionIndex]?.selected === question.options[option] ? 'checked' : ''}>
                ${question.options[option]}
            </label><br>
        `).join('');
    };

    const generateNavigationButtons = (isLastQuestion) => {
        return `
            ${currentQuestionIndex > 0 ? 
                `<button type="button" id="prevQuestion">← Previous</button>` : 
                `<button type="button" id="prevQuestion" disabled>← Previous</button>`}
            
            <button type="submit" id="submitAnswer">
                ${isLastQuestion ? 'Submit Quiz' : 'Submit Answer'}
            </button>
            
            ${!isLastQuestion ? 
                `<button type="button" id="nextQuestion">Next →</button>` : 
                ''}
        `;
    };

    const generateQuestionBoxes = () => {
        return `
            <div class="question-boxes">
                ${currentQuestions.map((_, index) => `
                    <div class="question-box 
                        ${index === currentQuestionIndex ? 'current' : ''}
                        ${userAnswers[index] ? 'answered' : 'unanswered'}"
                        data-index="${index}">
                        ${index + 1}
                    </div>
                `).join('')}
            </div>
        `;
    };

    const setupQuestionEventListeners = (isLastQuestion) => {
        // Question box navigation
        document.querySelectorAll('.question-box').forEach(box => {
            box.addEventListener('click', () => {
                saveCurrentAnswer();
                currentQuestionIndex = parseInt(box.dataset.index);
                displayQuestion();
            });
        });

        // Form submission
        document.getElementById('answerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            handleAnswer(isLastQuestion);
        });

        // Previous button
        const prevBtn = document.getElementById('prevQuestion');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                saveCurrentAnswer();
                currentQuestionIndex--;
                displayQuestion();
            });
        }

        // Next button
        const nextBtn = document.getElementById('nextQuestion');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const selected = document.querySelector('input[name="answer"]:checked');
                if (!selected) {
                    alert('Please select an answer before continuing.');
                    return;
                }
                saveCurrentAnswer();
                currentQuestionIndex++;
                displayQuestion();
            });
        }
    };

    const showNoQuestionsError = () => {
        clearInterval(timerInterval);
        const questionContent = document.getElementById('questionContent');
        questionContent.innerHTML = `
            <div class="error-message">
                <p>No questions available. Please try again later or contact the administrator.</p>
                <button id="retryLoadQuestions">Retry Loading Questions</button>
            </div>
        `;
        document.getElementById('retryLoadQuestions').addEventListener('click', () => {
            window.location.reload();
        });
    };

    // Answer Handling
    const saveCurrentAnswer = () => {
        const selectedOption = document.querySelector('input[name="answer"]:checked');
        const question = currentQuestions[currentQuestionIndex];
        
        if (selectedOption) {
            userAnswers[currentQuestionIndex] = {
                question: question.question,
                selected: selectedOption.value,
                correct: question.correct_answer,
                isCorrect: selectedOption.value === question.correct_answer
            };
        } else {
            userAnswers[currentQuestionIndex] = userAnswers[currentQuestionIndex] || null;
        }
    };

    const handleAnswer = (isLastQuestion) => {
        const selectedAnswer = document.querySelector('input[name="answer"]:checked');
        
        if (!selectedAnswer) {
            alert('Please select an answer before submitting.');
            return;
        }
    
        saveCurrentAnswer();
        updateQuizStats();
        
        if (isLastQuestion) {
            submitQuiz();
        } else {
            currentQuestionIndex++;
            displayQuestion();
        }
    };

    const updateQuizStats = () => {
        const isCorrect = userAnswers[currentQuestionIndex]?.isCorrect;
        
        if (isCorrect) {
            score += 10;
            correctAnswers++;
        } else if (isCorrect === false) {
            incorrectAnswers++;
        }
    
        document.getElementById('currentScore').textContent = score;
        document.getElementById('progress').textContent = `${currentQuestionIndex + 1}/${currentQuestions.length}`;
        
        const accuracy = correctAnswers > 0 ? 
            Math.round((correctAnswers / (correctAnswers + incorrectAnswers)) * 100) : 0;
        document.getElementById('accuracyRate').textContent = `${accuracy}%`;
    };

    // Quiz Submission
    const submitQuiz = () => {
        if (isSubmitting) return;
        isSubmitting = true;
        
        clearInterval(timerInterval);
        
        if (userAnswers.length === 0) {
            console.log('No answers to submit');
            isSubmitting = false;
            return;
        }

        // Show loading state
        const submitBtn = document.getElementById('submitAnswer');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }

        const formData = new FormData();
        formData.append('score', score);
        formData.append('correctAnswers', correctAnswers);
        formData.append('incorrectAnswers', incorrectAnswers);
        formData.append('answers', JSON.stringify(userAnswers));

        fetch('submit_quiz.php', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        })
        .then(handleJSONResponse)
        .then(data => {
            if (data.status === 'success') {
                // Store results temporarily in case redirect fails
                localStorage.setItem('quizResults', JSON.stringify({
                    score,
                    correctAnswers,
                    incorrectAnswers,
                    answers: userAnswers
                }));
                window.location.href = 'results.html';
            } else {
                throw new Error(data.message || 'Submission failed');
            }
        })
        .catch(error => {
            console.error('Submission error:', error);
            alert(`Error submitting quiz: ${error.message}`);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Quiz';
            }
            isSubmitting = false;
        });
    };

    // Initialize
    checkAuth();

    // Event Listeners
    if (assessmentForm) {
        assessmentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!Array.isArray(currentQuestions) || currentQuestions.length === 0) {
                showNoQuestionsError();
                return;
            }
            
            const fullName = document.getElementById('fullName').value.trim();
            if (!fullName) {
                alert('Please enter your name to start the quiz.');
                return;
            }

            userNameSpan.textContent = fullName;
            localStorage.setItem('userName', fullName);
            
            assessmentForm.classList.add('hidden');
            welcomeSection.classList.remove('hidden');
            statsSection.classList.remove('hidden');
            controlsSection.classList.remove('hidden');
            questionSection.classList.remove('hidden');
            
            startTimer();
            displayQuestion();
        });
    }

    if (shuffleQuestionsBtn) {
        shuffleQuestionsBtn.addEventListener('click', () => {
            currentQuestions = [...currentQuestions].sort(() => Math.random() - 0.5);
            currentQuestionIndex = 0;
            userAnswers = [];
            score = 0;
            correctAnswers = 0;
            incorrectAnswers = 0;
            resetStatsDisplay();
            displayQuestion();
        });
    }

    if (resetAssessmentBtn) {
        resetAssessmentBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset the quiz? All progress will be lost.')) {
                resetQuiz();
            }
        });
    }

    const resetQuiz = () => {
        clearInterval(timerInterval);
        assessmentForm.reset();
        assessmentForm.classList.remove('hidden');
        welcomeSection.classList.add('hidden');
        statsSection.classList.add('hidden');
        controlsSection.classList.add('hidden');
        questionSection.classList.add('hidden');
        timeLeft = 600;
        updateTimerDisplay();
        currentQuestionIndex = 0;
        userAnswers = [];
        score = 0;
        correctAnswers = 0;
        incorrectAnswers = 0;
        resetStatsDisplay();
    };

    const resetStatsDisplay = () => {
        document.getElementById('currentScore').textContent = '0';
        document.getElementById('progress').textContent = `0/${currentQuestions.length}`;
        document.getElementById('accuracyRate').textContent = '0%';
    };

    // [Keep other existing event listeners...]
    // Initialize any additional components
    if (resultsTable) loadStudentResults();
});

// Helper function to load student results (for admin dashboard)
function loadStudentResults() {
    fetch('fetch_student_scores.php', {
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (!data || data.status !== 'success') {
            resultsTable.innerHTML = `<p class="no-results">${data?.message || 'No student scores available.'}</p>`;
            return;
        }
        
        let tableHtml = `
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Student Name</th>
                        <th>Matric Number</th>
                        <th>Score</th>
                        <th>Correct</th>
                        <th>Incorrect</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.students.forEach(student => {
            tableHtml += `
                <tr>
                    <td>${student.full_name}</td>
                    <td>${student.matric_number}</td>
                    <td class="${student.total_score > 70 ? 'high-score' : 'low-score'}">${student.total_score}</td>
                    <td>${student.correct_answers}</td>
                    <td>${student.incorrect_answers}</td>
                    <td>${student.last_quiz_date || 'N/A'}</td>
                </tr>
            `;
        });
        
        tableHtml += '</tbody></table>';
        resultsTable.innerHTML = tableHtml;
    })
    .catch(error => {
        console.error('Error loading results:', error);
        resultsTable.innerHTML = '<p class="error-message">Error loading student scores. Please try again later.</p>';
    });
}