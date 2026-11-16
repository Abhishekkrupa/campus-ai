const express = require('express');
const c = require('../controllers/aiController');
const protect = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const router = express.Router();

router.get('/conversations', protect, c.conversations);
router.get('/conversations/:id', protect, c.conversationMessages);
router.get('/quizzes', protect, c.listQuizzes);

router.post('/chat', protect, aiLimiter, c.chat);
router.post('/summarize', protect, aiLimiter, c.summarize);
router.post('/questions', protect, aiLimiter, c.questions);
router.post('/flashcards', protect, aiLimiter, c.flashcards);
router.post('/quiz', protect, aiLimiter, c.quiz);
router.post('/study-plan', protect, aiLimiter, c.studyPlan);
router.post('/flashcards/save', protect, c.saveFlashcards);
router.post('/quiz/save', protect, c.saveQuiz);

// Creator content AI
router.post('/generate/post', protect, c.generatePost);
router.post('/generate/tags', protect, c.generateTags);
router.post('/generate/outline', protect, c.generateOutline);
router.post('/generate/description', protect, c.generateDescription);

module.exports = router;
