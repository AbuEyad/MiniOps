const router = require('express').Router();
const { asyncHandler } = require('../../utils/http');
const c = require('./sales.controller');

router.get('/', asyncHandler(c.list));
router.post('/', asyncHandler(c.create));
router.delete('/:id', asyncHandler(c.remove));

module.exports = router;