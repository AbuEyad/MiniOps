const router = require('express').Router();
const { asyncHandler } = require('../../utils/http');
const c = require('./auth.controller');

router.post('/login', asyncHandler(c.login));
router.post('/logout', asyncHandler(c.logout));
router.get('/status', c.status);

module.exports = router;