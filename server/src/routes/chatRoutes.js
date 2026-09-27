import { Router } from 'express';
import { chat } from '../controllers/chatController.js';
import { createChatRateLimiter } from '../services/rateLimiter.js';

const router = Router();
router.post('/', createChatRateLimiter(), chat);
export default router;
