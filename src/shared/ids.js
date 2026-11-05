const crypto = require('crypto');
exports.uid = prefix => prefix + '_' + crypto.randomBytes(8).toString('hex');