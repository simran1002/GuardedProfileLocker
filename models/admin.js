const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // You might have additional fields specific to admins
});

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
