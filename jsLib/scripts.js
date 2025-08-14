
const { jsPDF } = window.jspdf;

// Access autoTable from the global scope
const autoTable = window.jspdfAutoTable;


// Your code here

document.addEventListener('DOMContentLoaded', () => {
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

    let timeLeft = 600; // 10 minutes in seconds
    let timerInterval;
    let currentQuestions = Array.isArray(window.questions) ? window.questions : 
                     (typeof questions !== 'undefined' && Array.isArray(questions)) ? questions : []; // Ensure currentQuestions is an array
    let currentQuestionIndex = 0;
    let userAnswers = [];
    let score = 0;
    let correctAnswers = 0;
    let incorrectAnswers = 0;

    // Debug: Log questions to verify they are loaded
    console.log('Questions loaded:', window.questions);

    // Check authentication status on page load
    if (authMessage) {
        fetch('check_auth.php', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        })
            .then(response => {
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
            })
            .then(data => {
                if (!data || data.status !== 'success') {
                    authMessage.classList.remove('hidden');
                    authMessage.textContent = data?.message || 'Please log in to access the quiz.';
                    authMessage.style.color = '#dc2626';
                    if (assessmentForm) assessmentForm.classList.add('hidden');
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                }
            })
            .catch(error => {
                console.error('Error checking auth:', error);
                authMessage.classList.remove('hidden');
                authMessage.textContent = `Error: ${error.message}`;
                authMessage.style.color = '#dc2626';
                if (assessmentForm) assessmentForm.classList.add('hidden');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            });
    }

    // Fetch student scores for admin dashboard
    if (resultsTable) {
        fetch('fetch_student_scores.php')
            .then(response => {
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
            })
            .then(data => {
                if (!data || data.status !== 'success') {
                    resultsTable.innerHTML = `<p>${data?.message || 'No student scores available.'}</p>`;
                    return;
                }
                let tableHtml = '<table class="results-table"><thead><tr><th>Student Name</th><th>Matric Number</th><th>Total Score</th><th>Correct Answers</th><th>Incorrect Answers</th><th>Last Quiz Date</th></tr></thead><tbody>';
                data.students.forEach(student => {
                    tableHtml += `<tr><td>${student.full_name}</td><td>${student.matric_number}</td><td>${student.total_score}</td><td>${student.correct_answers}</td><td>${student.incorrect_answers}</td><td>${student.last_quiz_date || 'N/A'}</td></tr>`;
                });
                tableHtml += '</tbody></table>';
                resultsTable.innerHTML = tableHtml;
            })
            .catch(error => {
                console.error('Error fetching student scores:', error);
                resultsTable.innerHTML = '<p>Error loading student scores.</p>';
            });
    }

    // Print results to PDF
    if (printResultsBtn) {
        printResultsBtn.addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Set document properties
            doc.setProperties({
                title: 'Igbara Quiz App - Student Results',
                subject: 'Quiz Results',
                author: 'Igbara Quiz App',
                keywords: 'quiz, results, students',
                creator: 'Igbara Quiz App'
            });
    
            // Add header
            doc.setFontSize(18);
            doc.setTextColor(40, 53, 147); // Dark blue color
            doc.text('Igbara Quiz App - Student Results', 105, 20, { align: 'center' });
            
            // Add subtitle
            doc.setFontSize(12);
            doc.setTextColor(81, 81, 81); // Dark gray
            doc.text('Student Performance Report', 105, 30, { align: 'center' });
            
            // Add date
            const today = new Date();
            doc.setFontSize(10);
            doc.text(`Report generated: ${today.toLocaleDateString()}`, 105, 40, { align: 'center' });
            
            // Add line separator
            doc.setDrawColor(200, 200, 200);
            doc.line(20, 45, 190, 45);
    
            // Table styling
            const headers = [
                { title: "Student Name", dataKey: "name" },
                { title: "Matric No.", dataKey: "matric" },
                { title: "Score", dataKey: "score" },
                { title: "Correct", dataKey: "correct" },
                { title: "Incorrect", dataKey: "incorrect" },
                { title: "Last Attempt", dataKey: "date" }
            ];
    
            // Prepare data
            const table = document.querySelector('#resultsTable table');
            if (table) {
                const rows = table.querySelectorAll('tr');
                const data = [];
                
                // Skip header row (index 0)
                for (let i = 1; i < rows.length; i++) {
                    const cells = rows[i].querySelectorAll('td');
                    data.push({
                        name: cells[0].textContent,
                        matric: cells[1].textContent,
                        score: cells[2].textContent,
                        correct: cells[3].textContent,
                        incorrect: cells[4].textContent,
                        date: cells[5].textContent
                    });
                }
    
                // AutoTable options
                doc.autoTable({
                    head: [headers.map(h => h.title)],
                    body: data.map(row => [
                        row.name,
                        row.matric,
                        { content: row.score, styles: { textColor: row.score > 70 ? [0, 128, 0] : [255, 0, 0] } },
                        row.correct,
                        row.incorrect,
                        row.date
                    ]),
                    startY: 50,
                    styles: {
                        fontSize: 9,
                        cellPadding: 3,
                        overflow: 'linebreak',
                        halign: 'center'
                    },
                    headStyles: {
                        fillColor: [40, 53, 147], // Dark blue header
                        textColor: 255, // White text
                        fontStyle: 'bold'
                    },
                    alternateRowStyles: {
                        fillColor: [240, 240, 240] // Light gray alternate rows
                    },
                    columnStyles: {
                        0: { halign: 'left', cellWidth: 40 }, // Name
                        1: { cellWidth: 40 }, // Matric
                        2: { cellWidth: 20 }, // Score
                        3: { cellWidth: 20 }, // Correct
                        4: { cellWidth: 20 }, // Incorrect
                        5: { cellWidth: 30 } // Date
                    }
                });
                
                // Add footer
                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(10);
                    doc.setTextColor(150);
                    doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
                    doc.text('© Igbara Quiz App', 195, 285, { align: 'right' });
                }
            } else {
                doc.setFontSize(12);
                doc.text('No results to print.', 105, 60, { align: 'center' });
            }
    
            doc.save('student_results.pdf');
        });
    }

 





    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            scoreModal.classList.add('hidden');
        });
    }

    if (addQuestionBtn) {
        addQuestionBtn.addEventListener('click', () => {
            questionModal.classList.remove('hidden');
        });
    }

    if (closeQuestionModalBtn) {
        closeQuestionModalBtn.addEventListener('click', () => {
            questionModal.classList.add('hidden');
        });
    }

    if (questionForm) {
        questionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(questionForm);
            fetch('upload_question.php', {
                method: 'POST',
                body: formData
            })
                .then(response => {
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
                })
                .then(data => {
                    if (!data || data.status !== 'success') {
                        alert('Error uploading question: ' + (data?.message || 'No data returned'));
                        return;
                    }
                    questionModal.classList.add('hidden');
                    questionForm.reset();
                    alert('Question uploaded successfully!');
                })
                .catch(error => {
                    console.error('Error uploading question:', error);
                    alert(`Error uploading question: ${error.message}`);
                });
        });
    }

    // Results page handling
    if (document.getElementById('questionResults')) {
        const userName = localStorage.getItem('userName') || 'Student';
        document.getElementById('userName').textContent = userName;
        fetch('fetch_results.php')
            .then(response => {
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
            })
            .then(data => {
                if (!data || data.status !== 'success') {
                    document.getElementById('questionResults').innerHTML = `<p>${data?.message || 'No results available.'}</p>`;
                    return;
                }
                document.getElementById('totalScore').textContent = data.score;
                document.getElementById('correctAnswers').textContent = data.correctAnswers;
                document.getElementById('incorrectAnswers').textContent = data.incorrectAnswers;
                document.getElementById('accuracyRate').textContent = `${Math.round((data.correctAnswers / (data.correctAnswers + data.incorrectAnswers) || 1) * 100)}%`;
                const questionResults = document.getElementById('questionResults');
                data.answers.forEach((answer, index) => {
                    const resultDiv = document.createElement('div');
                    resultDiv.className = `question-result ${answer.isCorrect ? 'correct' : 'incorrect'}`;
                    resultDiv.innerHTML = `
                        <p>Question ${index + 1}: ${answer.question}</p>
                        <p>Your Answer: ${answer.selected}</p>
                        ${!answer.isCorrect ? `<p>Correct Answer: ${answer.correct}</p>` : ''}
                    `;
                    questionResults.appendChild(resultDiv);
                });
            })
            .catch(error => {
                console.error('Error fetching results:', error);
                document.getElementById('questionResults').innerHTML = '<p>Error loading results.</p>';
            });
    }

});