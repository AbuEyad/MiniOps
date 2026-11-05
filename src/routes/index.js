const router = require('express').Router();

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/sales', require('../modules/sales/sales.routes'));

module.exports = router;