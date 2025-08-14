document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    var elements = {
        assessmentForm: document.getElementById('assessmentForm'),
        welcomeSection: document.getElementById('welcomeSection'),
        statsSection: document.getElementById('statsSection'),
        controlsSection: document.getElementById('controlsSection'),
        questionSection: document.getElementById('questionSection'),
        scoreModal: document.getElementById('scoreModal'),
        userNameSpan: document.getElementById('userName'),
        shuffleQuestionsBtn: document.getElementById('shuffleQuestions'),
        resetAssessmentBtn: document.getElementById('resetAssessment'),
        scoreProgressBtn: document.getElementById('scoreProgress'),
        changeUserBtn: document.getElementById('changeUser'),
        closeModalBtn: document.getElementById('closeModal'),
        timeLeftSpan: document.getElementById('timeLeft'),
        addQuestionBtn: document.getElementById('addQuestion'),
        questionModal: document.getElementById('questionModal'),
        closeQuestionModalBtn: document.getElementById('closeQuestionModal'),
        questionForm: document.getElementById('questionForm'),
        resultsTable: document.getElementById('resultsTable'),
        printResultsBtn: document.getElementById('printResults'),
        authMessage: document.getElementById('authMessage'),
        loginForm: document.getElementById('loginForm'),
        signupForm: document.getElementById('signupForm'),
        loginMessage: document.getElementById('loginMessage'),
        signupMessage: document.getElementById('signupMessage'),
        questionResults: document.getElementById('questionResults')
    };

    // Quiz State
    console.log('DOMContentLoaded - window.questions:', window.questions);

    var state = {
        timeLeft: 1800,
        timerInterval: null,
        currentQuestions: Array.isArray(window.questions) ? window.questions : [],
        currentQuestionIndex: 0,
        userAnswers: [],
        score: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        isSubmitting: false
    };

    console.log('Initial state.currentQuestions:', state.currentQuestions);

    // Utility Functions
    var utils = {
        handleJSONResponse: function(response) {
            return new Promise(function(resolve, reject) {
                if (!response.ok) {
                    response.text().then(function(errorText) {
                        reject(new Error('HTTP error! Status: ' + response.status + '. ' + errorText));
                    });
                    return;
                }

                var contentType = response.headers.get('content-type');
                if (contentType && contentType.indexOf('application/json') === -1) {
                    response.text().then(function(text) {
                        try {
                            resolve(JSON.parse(text));
                        } catch (e) {
                            reject(new Error('Expected JSON, got ' + contentType + ': ' + text.substring(0, 100)));
                        }
                    });
                    return;
                }
                response.json().then(resolve).catch(reject);
            });
        },
        showMessage: function(element, message, isError) {
            if (!element) return;
            element.className = element.className.replace('hidden', '');
            element.textContent = message;
            element.style.color = isError !== false ? '#dc2626' : '#16a34a';
        },
        formatTime: function(seconds) {
            var mins = Math.floor(seconds / 60);
            var secs = seconds % 60;
            return mins + ':' + (secs < 10 ? '0' : '') + secs;
        },
        getSessionData: function() {
            try {
                return JSON.parse(sessionStorage.getItem('quizData') || '{}');
            } catch (e) {
                return {};
            }
        },
        setSessionData: function(data) {
            if (sessionStorage) {
                sessionStorage.setItem('quizData', JSON.stringify(data));
            }
        }
    };

    // Authentication
    var auth = {
        check: function() {
            if (!elements.authMessage) return;

            fetch('check_auth.php', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            }).then(function(response) {
                return utils.handleJSONResponse(response);
            }).then(function(data) {
                if (!data || data.status !== 'success') {
                    throw new Error(data && data.message ? data.message : 'Please log in to access the quiz.');
                }
            }).catch(function(error) {
                utils.showMessage(elements.authMessage, error.message);
                if (elements.assessmentForm) {
                    elements.assessmentForm.className += ' hidden';
                }
                setTimeout(function() { window.location.href = 'login.html'; }, 2000);
            });
        },
        logout: function() {
            fetch('logout.php', {
                method: 'POST',
                credentials: 'include'
            }).then(function() {
                if (sessionStorage) {
                    sessionStorage.removeItem('quizData');
                }
                window.location.href = 'login.html';
            }).catch(function(error) {
                console.error('Logout failed:', error);
                alert('Logout failed. Please try again.');
            });
        }
    };

    // Quiz Functions
    var quiz = {
        initialize: function() {
            var savedState = utils.getSessionData();
            if (savedState.timeLeft) {
                state.timeLeft = savedState.timeLeft;
            }
            if (savedState.currentQuestionIndex) {
                state.currentQuestionIndex = savedState.currentQuestionIndex;
            }
            if (savedState.userAnswers) {
                state.userAnswers = savedState.userAnswers;
            }
            if (savedState.score) {
                state.score = savedState.score;
            }
            if (savedState.correctAnswers) {
                state.correctAnswers = savedState.correctAnswers;
            }
            if (savedState.incorrectAnswers) {
                state.incorrectAnswers = savedState.incorrectAnswers;
            }
        },
        startTimer: function() {
            if (elements.timeLeftSpan) {
                elements.timeLeftSpan.textContent = utils.formatTime(state.timeLeft);
            }
            state.timerInterval = setInterval(function() {
                state.timeLeft--;
                if (elements.timeLeftSpan) {
                    elements.timeLeftSpan.textContent = utils.formatTime(state.timeLeft);
                }

                utils.setSessionData({
                    timeLeft: state.timeLeft,
                    currentQuestionIndex: state.currentQuestionIndex,
                    userAnswers: state.userAnswers,
                    score: state.score,
                    correctAnswers: state.correctAnswers,
                    incorrectAnswers: state.incorrectAnswers
                });

                if (state.timeLeft <= 0) {
                    clearInterval(state.timerInterval);
                    quiz.submit();
                }
            }, 1000);
        },
        displayQuestion: function() {
            if (!Array.isArray(state.currentQuestions) || state.currentQuestions.length === 0) {
                quiz.showNoQuestionsError();
                return;
            }

            var question = state.currentQuestions[state.currentQuestionIndex];
            var isLastQuestion = state.currentQuestionIndex === state.currentQuestions.length - 1;
            var questionContent = document.getElementById('questionContent');

            document.getElementById('questionNumber').textContent = state.currentQuestionIndex + 1;
            document.getElementById('questionCategory').textContent = question.category || 'General';

            var optionsHtml = '';
            var opts = ['a', 'b', 'c', 'd'];
            for (var i = 0; i < opts.length; i++) {
                var opt = opts[i];
                optionsHtml += '<label>' +
                    '<input type="radio" name="answer" value="' + question.options[opt] + '"' +
                    (state.userAnswers[state.currentQuestionIndex] && state.userAnswers[state.currentQuestionIndex].selected === question.options[opt] ? ' checked' : '') +
                    '>' + question.options[opt] + '</label><br>';
            }

            questionContent.innerHTML =
                '<div class="question-text"><p>' + question.question + '</p></div>' +
                '<form id="answerForm">' + optionsHtml +
                '<div class="question-actions">' +
                '<button type="button" id="prevQuestion"' + (state.currentQuestionIndex === 0 ? ' disabled' : '') + '>← Previous</button>' +
                '<button type="submit" id="submitAnswer">' + (isLastQuestion ? 'Submit Quiz' : 'Submit Answer') + '</button>' +
                (!isLastQuestion ? '<button type="button" id="nextQuestion">Next →</button>' : '') +
                '</div></form>' +
                '<div class="question-boxes">' +
                state.currentQuestions.map(function(_, i) {
                    return '<div class="question-box ' +
                        (i === state.currentQuestionIndex ? 'current' : '') + ' ' +
                        (state.userAnswers[i] ? 'answered' : 'unanswered') +
                        '" data-index="' + i + '">' + (i + 1) + '</div>';
                }).join('') + '</div>';

            quiz.setupQuestionEventListeners(isLastQuestion);
        },
        setupQuestionEventListeners: function(isLastQuestion) {
            var boxes = document.querySelectorAll('.question-box');
            for (var i = 0; i < boxes.length; i++) {
                boxes[i].addEventListener('click', function() {
                    quiz.saveCurrentAnswer();
                    state.currentQuestionIndex = parseInt(this.getAttribute('data-index'), 10);
                    quiz.displayQuestion();
                });
            }

            var answerForm = document.getElementById('answerForm');
            answerForm.addEventListener('submit', function(e) {
                e.preventDefault();
                quiz.handleAnswer(isLastQuestion);
            });

            var prevBtn = document.getElementById('prevQuestion');
            if (prevBtn) {
                prevBtn.addEventListener('click', function() {
                    quiz.saveCurrentAnswer();
                    state.currentQuestionIndex--;
                    quiz.displayQuestion();
                });
            }

            var nextBtn = document.getElementById('nextQuestion');
            if (nextBtn) {
                nextBtn.addEventListener('click', function() {
                    if (!document.querySelector('input[name="answer"]:checked')) {
                        alert('Please select an answer before continuing.');
                        return;
                    }
                    quiz.saveCurrentAnswer();
                    state.currentQuestionIndex++;
                    quiz.displayQuestion();
                });
            }
        },
        saveCurrentAnswer: function() {
            var selectedOption = document.querySelector('input[name="answer"]:checked');
            var question = state.currentQuestions[state.currentQuestionIndex];

            if (selectedOption) {
                state.userAnswers[state.currentQuestionIndex] = {
                    question: question.question,
                    selected: selectedOption.value,
                    correct: question.correct_answer,
                    isCorrect: selectedOption.value === question.correct_answer
                };
            }
        },
        handleAnswer: function(isLastQuestion) {
            var selectedAnswer = document.querySelector('input[name="answer"]:checked');
            if (!selectedAnswer) {
                alert('Please select an answer before submitting.');
                return;
            }

            quiz.saveCurrentAnswer();
            quiz.updateStats();

            if (isLastQuestion) {
                quiz.submit();
            } else {
                state.currentQuestionIndex++;
                quiz.displayQuestion();
            }
        },
        updateStats: function() {
            var isCorrect = state.userAnswers[state.currentQuestionIndex] && state.userAnswers[state.currentQuestionIndex].isCorrect;

            if (isCorrect) {
                state.score += 10;
                state.correctAnswers++;
            } else if (isCorrect === false) {
                state.incorrectAnswers++;
            }

            var currentScore = document.getElementById('currentScore');
            if (currentScore) {
                currentScore.textContent = state.score;
            }
            var progress = document.getElementById('progress');
            if (progress) {
                progress.textContent = (state.currentQuestionIndex + 1) + '/' + state.currentQuestions.length;
            }
            var accuracyRate = document.getElementById('accuracyRate');
            if (accuracyRate) {
                var accuracy = state.correctAnswers > 0 ?
                    Math.round((state.correctAnswers / (state.correctAnswers + state.incorrectAnswers)) * 100) : 0;
                accuracyRate.textContent = accuracy + '%';
            }
        },
        submit: function() {
            if (state.isSubmitting) return;
            state.isSubmitting = true;

            clearInterval(state.timerInterval);

            if (state.userAnswers.length === 0) {
                console.log('No answers to submit');
                state.isSubmitting = false;
                return;
            }

            var submitBtn = document.getElementById('submitAnswer');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Submitting...';
            }
            var fullName = state.fullName || localStorage.getItem('userName') || prompt('Please enter your name:');
            if (!fullName) {
                alert('Cannot submit without a name');
                state.isSubmitting = false;
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit Quiz';
                }
                return;
            }

            // Log submitted data for debugging
            console.log('Submitting quiz data:', {
                fullName: fullName,
                score: state.score,
                correctAnswers: state.correctAnswers,
                incorrectAnswers: state.incorrectAnswers,
                answers: state.userAnswers
            });

            var formData = new FormData();
            formData.append('fullName', fullName);
            formData.append('score', state.score);
            formData.append('correctAnswers', state.correctAnswers);
            formData.append('incorrectAnswers', state.incorrectAnswers);
            formData.append('answers', JSON.stringify(state.userAnswers));
            var resultsData = {
                score: state.score,
                correctAnswers: state.correctAnswers,
                incorrectAnswers: state.incorrectAnswers,
                answers: state.userAnswers
            };

            localStorage.setItem('quizResults', JSON.stringify(resultsData));

            fetch('submit_quiz.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            }).then(function(response) {
                return utils.handleJSONResponse(response);
            }).then(function(data) {
                console.log('Submit response:', data);
                if (data.status === 'success') {
                    if (sessionStorage) {
                        sessionStorage.removeItem('quizData');
                    }
                    window.location.href = 'results.html';
                } else {
                    throw new Error(data.message || 'Submission failed');
                }
            }).catch(function(error) {
                console.error('Submission error:', error);
                alert('Error submitting quiz: ' + error.message);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit Quiz';
                }
                state.isSubmitting = false;
            });
        },
        showNoQuestionsError: function() {
            clearInterval(state.timerInterval);
            var questionContent = document.getElementById('questionContent');
            questionContent.innerHTML =
                '<div class="error-message">' +
                '<p>No questions available. Please try again later.</p>' +
                '<button id="retryLoadQuestions">Retry</button>' +
                '</div>';
            document.getElementById('retryLoadQuestions').addEventListener('click', function() {
                window.location.reload();
            });
        },
        reset: function() {
            clearInterval(state.timerInterval);
            if (elements.assessmentForm) {
                elements.assessmentForm.reset();
                elements.assessmentForm.className = elements.assessmentForm.className.replace(' hidden', '');
            }
            if (elements.welcomeSection) elements.welcomeSection.className += ' hidden';
            if (elements.statsSection) elements.statsSection.className += ' hidden';
            if (elements.controlsSection) elements.controlsSection.className += ' hidden';
            if (elements.questionSection) elements.questionSection.className += ' hidden';

            state.timeLeft = 600;
            if (elements.timeLeftSpan) elements.timeLeftSpan.textContent = utils.formatTime(state.timeLeft);
            state.currentQuestionIndex = 0;
            state.userAnswers = [];
            state.score = 0;
            state.correctAnswers = 0;
            state.incorrectAnswers = 0;

            var currentScore = document.getElementById('currentScore');
            if (currentScore) currentScore.textContent = '0';
            var progress = document.getElementById('progress');
            if (progress) progress.textContent = '0/' + state.currentQuestions.length;
            var accuracyRate = document.getElementById('accuracyRate');
            if (accuracyRate) accuracyRate.textContent = '0%';

            if (sessionStorage) {
                sessionStorage.removeItem('quizData');
            }
        },
        shuffleQuestions: function() {
            state.currentQuestions = state.currentQuestions.slice().sort(function() { return Math.random() - 0.5; });
            state.currentQuestionIndex = 0;
            state.userAnswers = [];
            state.score = 0;
            state.correctAnswers = 0;
            state.incorrectAnswers = 0;
            quiz.displayQuestion();
        }
    };

    // Form Handlers
    var forms = {
        handleAssessment: function(e) {
            e.preventDefault();
            if (!state.currentQuestions || state.currentQuestions.length === 0) {
                state.currentQuestions = Array.isArray(window.questions) ? window.questions : [];
            }

            if (!Array.isArray(state.currentQuestions)) {
                console.error('Questions is not an array:', state.currentQuestions);
                quiz.showNoQuestionsError();
                return;
            }

            if (state.currentQuestions.length === 0) {
                console.error('No questions available:', {
                    windowQuestions: window.questions,
                    stateQuestions: state.currentQuestions,
                    fromPHP: window.questions ? window.questions.length : 0
                });
                quiz.showNoQuestionsError();
                return;
            }

            var fullNameInput = document.getElementById('fullName');
            var fullName = fullNameInput && fullNameInput.value.trim();
            if (!fullName) {
                alert('Please enter your name to start the quiz.');
                return;
            }

            if (elements.userNameSpan) elements.userNameSpan.textContent = fullName;
            localStorage.setItem('userName', fullName);

            if (elements.assessmentForm) elements.assessmentForm.className += ' hidden';
            if (elements.welcomeSection) elements.welcomeSection.className = elements.welcomeSection.className.replace(' hidden', '');
            if (elements.statsSection) elements.statsSection.className = elements.statsSection.className.replace(' hidden', '');
            if (elements.controlsSection) elements.controlsSection.className = elements.controlsSection.className.replace(' hidden', '');
            if (elements.questionSection) elements.questionSection.className = elements.questionSection.className.replace(' hidden', '');

            quiz.startTimer();
            quiz.displayQuestion();
        },
        handleLogin: function(e) {
            e.preventDefault();
            if (!elements.loginForm || !elements.loginMessage) return;

            utils.showMessage(elements.loginMessage, 'Logging in...', false);

            var formData = new FormData(elements.loginForm);
            fetch('login.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            }).then(function(response) {
                return utils.handleJSONResponse(response);
            }).then(function(data) {
                if (!data || data.status !== 'success') {
                    throw new Error(data && data.message ? data.message : 'Login failed');
                }

                utils.showMessage(elements.loginMessage, 'Login successful! Redirecting...', false);
                var fullNameInput = elements.loginForm.querySelector('#fullName');
                localStorage.setItem('userName', fullNameInput ? fullNameInput.value : 'User');
                setTimeout(function() { window.location.href = 'index.php'; }, 1500);
            }).catch(function(error) {
                utils.showMessage(elements.loginMessage, error.message);
                console.error('Login error:', error);
            });
        },
        handleSignup: function(e) {
            e.preventDefault();
            if (!elements.signupForm || !elements.signupMessage) return;

            utils.showMessage(elements.signupMessage, 'Processing signup...', false);

            var currentYear = new Date().getFullYear();
            var randomId = Math.floor(1000 + Math.random() * 9000);
            var matricNumber = 'ODO/' + currentYear + '/' + randomId;

            var formData = new FormData(elements.signupForm);
            formData.append('matricNumber', matricNumber);

            fetch('signup.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            }).then(function(response) {
                return utils.handleJSONResponse(response);
            }).then(function(data) {
                if (!data || data.status !== 'success') {
                    throw new Error(data && data.message ? data.message : 'Signup failed');
                }

                utils.showMessage(
                    elements.signupMessage,
                    'Signup successful! Matric: ' + data.matricNumber + '. Redirecting...',
                    false
                );
                setTimeout(function() { window.location.href = 'login.html'; }, 3000);
            }).catch(function(error) {
                utils.showMessage(elements.signupMessage, error.message);
                console.error('Signup error:', error);
            });
        },
        handleQuestionUpload: function(e) {
            e.preventDefault();
            if (!elements.questionForm) return;

            var formData = new FormData(elements.questionForm);
            fetch('upload_question.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            }).then(function(response) {
                return utils.handleJSONResponse(response);
            }).then(function(data) {
                if (!data || data.status !== 'success') {
                    throw new Error(data && data.message ? data.message : 'Upload failed');
                }

                alert('Question uploaded successfully!');
                if (elements.questionModal) elements.questionModal.className += ' hidden';
                if (elements.questionForm) elements.questionForm.reset();
            }).catch(function(error) {
                alert('Error: ' + error.message);
                console.error('Upload error:', error);
            });
        }
    };

    // Results Handling
    var results = {
        loadStudentResults: function() {
            if (!elements.resultsTable) return;

            fetch('fetch_student_scores.php', {
                credentials: 'include'
            }).then(function(response) {
                return utils.handleJSONResponse(response);
            }).then(function(data) {
                if (!data || data.status !== 'success') {
                    elements.resultsTable.innerHTML = '<p>' + (data && data.message ? data.message : 'No results available.') + '</p>';
                    return;
                }

                var tableHtml = '<table class="results-table">' +
                    '<thead><tr><th>Student</th><th>Matric</th><th>Score</th><th>Correct</th><th>Incorrect</th><th>Date</th></tr></thead><tbody>';

                for (var i = 0; i < data.students.length; i++) {
                    var student = data.students[i];
                    tableHtml += '<tr>' +
                        '<td>' + student.full_name + '</td>' +
                        '<td>' + student.matric_number + '</td>' +
                        '<td class="' + (student.total_score > 70 ? 'high-score' : 'low-score') + '">' +
                        student.total_score + '</td>' +
                        '<td>' + student.correct_answers + '</td>' +
                        '<td>' + student.incorrect_answers + '</td>' +
                        '<td>' + (student.last_quiz_date || 'N/A') + '</td>' +
                        '</tr>';
                }

                tableHtml += '</tbody></table>';
                elements.resultsTable.innerHTML = tableHtml;
            }).catch(function(error) {
                console.error('Results error:', error);
                elements.resultsTable.innerHTML = '<p>Error loading results.</p>';
            });
        },
        printResults: function() {
            if (!window.jspdf || !elements.printResultsBtn) return;

            var jsPDF = window.jspdf.jsPDF;
            var doc = new jsPDF();

            doc.setProperties({
                title: 'Student Results',
                subject: 'Quiz Results',
                author: 'Quiz App'
            });

            doc.setFontSize(18);
            doc.text('Student Results Report', 105, 20, null, null, 'center');

            var table = elements.resultsTable && elements.resultsTable.querySelector('table');
            if (table) {
                var headers = [];
                var rows = [];

                var ths = table.querySelectorAll('thead th');
                for (var i = 0; i < ths.length; i++) {
                    headers.push(ths[i].textContent);
                }
                var trs = table.querySelectorAll('tbody tr');
                for (var i = 0; i < trs.length; i++) {
                    var row = [];
                    var tds = trs[i].querySelectorAll('td');
                    for (var j = 0; j < tds.length; j++) {
                        row.push(tds[j].textContent);
                    }
                    rows.push(row);
                }

                doc.autoTable({
                    head: [headers],
                    body: rows,
                    startY: 30,
                    styles: { fontSize: 10 },
                    headStyles: { fillColor: [40, 53, 147], textColor: 255 }
                });
            } else {
                doc.text('No results to print', 105, 30, null, null, 'center');
            }

            doc.save('student_results.pdf');
        },
        loadUserResults: function() {
            if (!elements.questionResults) {
                console.error('questionResults element not found');
                return;
            }

            var resultsData = window.quizResults;
            if (!resultsData) {
                results.fetchServerResults().then(function(data) {
                    console.log('Fetched results:', data);
                    displayResults(data);
                }).catch(function(error) {
                    console.error('Failed to fetch server results:', error);
                    elements.questionResults.innerHTML = '<p>Error loading results: ' + error.message + '</p>';
                });
            } else {
                console.log('Using window.quizResults:', resultsData);
                displayResults(resultsData);
            }

            function displayResults(data) {
                // Initialize defaults
                var score = 0;
                var correctAnswers = 0;
                var incorrectAnswers = 0;
                var answers = Array.isArray(data.answers) ? data.answers : [];

                // If status is not success, try to use answers to compute stats
                if (!data || data.status !== 'success') {
                    console.warn('Invalid or error response:', data);
                    if (answers.length > 0) {
                        for (var i = 0; i < answers.length; i++) {
                            if (answers[i].isCorrect) {
                                correctAnswers++;
                            } else {
                                incorrectAnswers++;
                            }
                        }
                        score = correctAnswers * 10; // 10 points per correct answer
                    }
                } else {
                    // Use summary stats if available
                    score = data.score !== undefined ? parseInt(data.score, 10) : 0;
                    correctAnswers = data.correctAnswers !== undefined ? parseInt(data.correctAnswers, 10) : 0;
                    incorrectAnswers = data.incorrectAnswers !== undefined ? parseInt(data.incorrectAnswers, 10) : 0;
                }

                // Update DOM elements
                var totalScoreElement = document.getElementById('totalScore');
                var correctAnswersElement = document.getElementById('correctAnswers');
                var incorrectAnswersElement = document.getElementById('incorrectAnswers');
                var accuracyRateElement = document.getElementById('accuracyRate');

                if (totalScoreElement) {
                    totalScoreElement.textContent = score;
                } else {
                    console.error('totalScore element not found');
                }
                if (correctAnswersElement) {
                    correctAnswersElement.textContent = correctAnswers;
                } else {
                    console.error('correctAnswers element not found');
                }
                if (incorrectAnswersElement) {
                    incorrectAnswersElement.textContent = incorrectAnswers;
                } else {
                    console.error('incorrectAnswers element not found');
                }
                if (accuracyRateElement) {
                    var accuracy = (correctAnswers + incorrectAnswers) > 0 ?
                        Math.round((correctAnswers / (correctAnswers + incorrectAnswers)) * 100) : 0;
                    accuracyRateElement.textContent = accuracy + '%';
                } else {
                    console.error('accuracyRate element not found');
                }

                // Display individual question results
                if (answers.length > 0) {
                    var answersHtml = '';
                    for (var i = 0; i < answers.length; i++) {
                        var answer = answers[i];
                        answersHtml += '<div class="question-result ' + (answer.isCorrect ? 'correct' : 'incorrect') + '">' +
                            '<p>Question ' + (i + 1) + ': ' + (answer.question || 'N/A') + '</p>' +
                            '<p>Your Answer: ' + (answer.selected || 'Unanswered') + '</p>' +
                            (answer.isCorrect ? '' : '<p>Correct Answer: ' + (answer.correct || 'N/A') + '</p>') +
                            '</div>';
                    }
                    elements.questionResults.innerHTML = answersHtml;
                } else {
                    elements.questionResults.innerHTML = '<p>No individual question results available.</p>';
                }
            }
        },
        fetchServerResults: function() {
            return fetch('fetch_results.php', {
                credentials: 'include'
            }).then(function(response) {
                return utils.handleJSONResponse(response);
            });
        }
    };

    // Modal Controls
    var modals = {
        showScoreModal: function() {
            if (!elements.scoreModal || !elements.scoreDetails) return;

            elements.scoreModal.className = elements.scoreModal.className.replace(' hidden', '');
            var scoreDetails = elements.scoreDetails;
            var answersHtml = '';
            for (var i = 0; i < state.userAnswers.length; i++) {
                var answer = state.userAnswers[i];
                answersHtml += '<div class="question-result ' + (answer && answer.isCorrect ? 'correct' : 'incorrect') + '">' +
                    '<p>Question ' + (i + 1) + ': ' + (answer && answer.question ? answer.question : '') + '</p>' +
                    '<p>Your Answer: ' + (answer && answer.selected ? answer.selected : 'Unanswered') + '</p>' +
                    (answer && !answer.isCorrect ? '<p>Correct: ' + answer.correct + '</p>' : '') +
                    '</div>';
            }

            scoreDetails.innerHTML =
                '<p>Total Score: ' + state.score + '</p>' +
                '<p>Correct: ' + state.correctAnswers + '</p>' +
                '<p>Incorrect: ' + state.incorrectAnswers + '</p>' +
                '<p>Accuracy: ' + (state.correctAnswers > 0 ?
                    Math.round((state.correctAnswers / (state.correctAnswers + state.incorrectAnswers)) * 100) : 0) + '%</p>' +
                '<h4>Details:</h4>' + answersHtml;
        },
        toggleQuestionModal: function(show) {
            if (!elements.questionModal) return;
            elements.questionModal.className = show ?
                elements.questionModal.className.replace(' hidden', '') :
                elements.questionModal.className + ' hidden';
        }
    };

    // Initialize
    auth.check();
    quiz.initialize();
    if (elements.resultsTable) results.loadStudentResults();
    if (elements.questionResults) results.loadUserResults();

    // Event Listeners
    if (elements.assessmentForm) {
        elements.assessmentForm.addEventListener('submit', forms.handleAssessment);
    }
    if (elements.shuffleQuestionsBtn) {
        elements.shuffleQuestionsBtn.addEventListener('click', quiz.shuffleQuestions);
    }
    if (elements.resetAssessmentBtn) {
        elements.resetAssessmentBtn.addEventListener('click', function() {
            if (confirm('Reset quiz? All progress will be lost.')) quiz.reset();
        });
    }
    if (elements.scoreProgressBtn) {
        elements.scoreProgressBtn.addEventListener('click', modals.showScoreModal);
    }
    if (elements.changeUserBtn) {
        elements.changeUserBtn.addEventListener('click', auth.logout);
    }
    if (elements.closeModalBtn) {
        elements.closeModalBtn.addEventListener('click', function() {
            if (elements.scoreModal) elements.scoreModal.className += ' hidden';
        });
    }
    if (elements.addQuestionBtn) {
        elements.addQuestionBtn.addEventListener('click', function() { modals.toggleQuestionModal(true); });
    }
    if (elements.closeQuestionModalBtn) {
        elements.closeQuestionModalBtn.addEventListener('click', function() { modals.toggleQuestionModal(false); });
    }
    if (elements.questionForm) {
        elements.questionForm.addEventListener('submit', forms.handleQuestionUpload);
    }
    if (elements.printResultsBtn) {
        elements.printResultsBtn.addEventListener('click', results.printResults);
    }
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', forms.handleLogin);
    }
    if (elements.signupForm) {
        elements.signupForm.addEventListener('submit', forms.handleSignup);
    }
});