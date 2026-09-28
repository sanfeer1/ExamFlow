const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/authMiddleware');
const router = express.Router();

// --- AUTHENTICATION & PROFILE ---

router.post('/register', async (req, res) => {
    const { name, username, email, password, role } = req.body;
    try {
        const [existing] = await pool.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email or Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role === 'admin' ? 'admin' : 'student';

        const [result] = await pool.query(
            'INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
            [name, username, email, hashedPassword, userRole]
        );

        res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/login', async (req, res) => {
    const { identifier, password } = req.body; // frontend will send `identifier`
    const queryId = identifier || req.body.email; // fallback for backwards compatibility
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ? OR username = ?', [queryId, queryId]);
        if (users.length === 0) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        const [updatedUsers] = await pool.query('SELECT * FROM users WHERE id = ?', [user.id]);
        const freshUser = updatedUsers[0];

        const token = jwt.sign(
            { id: freshUser.id, role: freshUser.role, name: freshUser.name, username: freshUser.username },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Remove sensitive info before sending
        delete freshUser.password;
        res.json({ token, user: freshUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/profile', authMiddleware, async (req, res) => {
    const { 
        name, username, email, 
        profile_picture, mobile_number, dob, gender, 
        register_number, department, year_of_study, section, college_name,
        currentPassword, newPassword
    } = req.body;
    const userId = req.user.id;
    
    try {
        const [existing] = await pool.query('SELECT * FROM users WHERE (email = ? OR username = ?) AND id != ?', [email, username, userId]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email or Username already in use by another account' });
        }
        
        let passwordQuery = '';
        const formattedDob = (dob && typeof dob === 'string' && dob.trim() !== '') ? dob.trim() : null;
        let queryParams = [name, username, email, profile_picture, mobile_number, formattedDob, gender, register_number, department, year_of_study, section, college_name];
        
        if (newPassword && currentPassword) {
            const [currentUserArr] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
            const isMatch = await bcrypt.compare(currentPassword, currentUserArr[0].password);
            if (!isMatch) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            passwordQuery = ', password = ?';
            queryParams.push(hashedPassword);
        }
        
        queryParams.push(userId);
        
        await pool.query(
            `UPDATE users SET name = ?, username = ?, email = ?, profile_picture = ?, mobile_number = ?, dob = ?, gender = ?, register_number = ?, department = ?, year_of_study = ?, section = ?, college_name = ? ${passwordQuery} WHERE id = ?`, 
            queryParams
        );
        
        const [updatedUser] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        const finalUser = updatedUser[0];
        delete finalUser.password; // Don't send password hash back
        
        res.json({ message: 'Profile updated successfully', user: finalUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error updating profile' });
    }
});


// --- EXAMS ---

// Get all exams (public/students)
router.get('/exams', authMiddleware, async (req, res) => {
    try {
        const [exams] = await pool.query(`
            SELECT e.*, COUNT(q.id)::int as question_count
            FROM exams e
            LEFT JOIN questions q ON q.exam_id = e.id
            GROUP BY e.id
            ORDER BY e.created_at DESC
        `);
        res.json(exams);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get a specific exam
router.get('/exams/:id', authMiddleware, async (req, res) => {
    try {
        const [exams] = await pool.query('SELECT * FROM exams WHERE id = ?', [req.params.id]);
        if (exams.length === 0) return res.status(404).json({ error: 'Exam not found' });
        res.json(exams[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});


// --- QUESTIONS ---

// Get questions for a specific exam
router.get('/questions/exam/:examId', authMiddleware, async (req, res) => {
    try {
        const [questions] = await pool.query('SELECT * FROM questions WHERE exam_id = ?', [req.params.examId]);
        res.json(questions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});


// --- RESULTS ---

// Submit an exam result (server-side scoring)
router.post('/results', authMiddleware, async (req, res) => {
    const { exam_id, answers } = req.body; // answers: { questionId: selectedOption, ... }
    try {
        const [existing] = await pool.query('SELECT * FROM results WHERE user_id = ? AND exam_id = ?', [req.user.id, exam_id]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'You have already taken this exam.' });
        }

        // Fetch correct answers from DB (never trust client-side score)
        const [questions] = await pool.query('SELECT id, correct_option FROM questions WHERE exam_id = ?', [exam_id]);
        if (questions.length === 0) {
            return res.status(400).json({ error: 'No questions found for this exam.' });
        }

        let score = 0;
        const answerRows = [];
        questions.forEach(q => {
            const selected = answers ? (answers[q.id] || answers[String(q.id)] || null) : null;
            const isCorrect = Boolean(selected && selected === q.correct_option);
            if (isCorrect) score++;
            answerRows.push([q.id, selected || null, isCorrect]);
        });

        const [result] = await pool.query(
            'INSERT INTO results (user_id, exam_id, score, total_questions) VALUES (?, ?, ?, ?)',
            [req.user.id, exam_id, score, questions.length]
        );

        // Store per-question answers
        for (const [questionId, selectedOption, isCorrect] of answerRows) {
            await pool.query(
                'INSERT INTO answers (result_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?)',
                [result.insertId, questionId, selectedOption, isCorrect]
            );
        }

        res.status(201).json({ message: 'Result submitted successfully', resultId: result.insertId, score, total_questions: questions.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get results for a specific student
router.get('/results/student', authMiddleware, async (req, res) => {
    try {
        const [results] = await pool.query(`
            SELECT r.*, e.title 
            FROM results r
            JOIN exams e ON r.exam_id = e.id
            WHERE r.user_id = ?
            ORDER BY r.submitted_at DESC
        `, [req.user.id]);
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get detailed result (per-question breakdown) for a specific result
router.get('/results/:resultId/detail', authMiddleware, async (req, res) => {
    try {
        // Verify the result belongs to the requesting user
        const [results] = await pool.query('SELECT * FROM results WHERE id = ? AND user_id = ?', [req.params.resultId, req.user.id]);
        if (results.length === 0) return res.status(404).json({ error: 'Result not found.' });

        const result = results[0];

        const [detail] = await pool.query(`
            SELECT 
                q.id as question_id,
                q.question_text,
                q.option_a, q.option_b, q.option_c, q.option_d,
                q.correct_option,
                a.selected_option,
                a.is_correct
            FROM answers a
            JOIN questions q ON a.question_id = q.id
            WHERE a.result_id = ?
            ORDER BY q.id ASC
        `, [req.params.resultId]);

        res.json({ result, detail });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
