require("dotenv").config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const { body, validationResult } = require('express-validator');
const { connectDB } = require("./db/connection");
const User = require('./models/user');
const Admin = require('./models/admin');
const multer = require('multer');
const storage = require('./db/cloudinary');

const app = express();
const PORT = 3000;

app.use(express.json());

const isAdmin = async (req, res, next) => {
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'Admin') {
      req.userRole = 'Admin';
      return next();
    } else {
      return res.status(403).json({ error: 'Permission denied. Admin access required.' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};


const isOwner = async (req, res, next) => {
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.userRole === 'Admin' || userId === req.user.id) {
      return next();
    } else {
      return res.status(403).json({ error: 'Permission denied. You can only modify your own details.' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};


const generateToken = (userId, role) => {
  const token = jwt.sign({ userId, role }, process.env.SECRET_KEY, { expiresIn: '1h' });
  return token;
};

const upload = multer({ storage });

app.post('/uploadProfileImage/:userId', upload.single('profileImage'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.file) {
      user.profileImage = req.file.path;

      await user.save();

      return res.status(200).json({ message: 'Profile image uploaded successfully', imageUrl: req.file.path });
    } else {
      return res.status(400).json({ error: 'No file uploaded' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/createAdmin', async (req, res) => {
  try {
    const { email, password } = req.body;

const existingAdmin = await Admin.findOne({ email: email });

if (existingAdmin) {
  return res.status(409).json({ error: 'Admin already exists.' });
}

    const hashedPassword = await bcrypt.hash(password, 10);


    const newAdmin = new Admin({
      email,
      password: hashedPassword,
    });

    await newAdmin.save();

    return res.status(201).json({ message: 'Admin created successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    const user = await Admin.findOne({ $or: [{ email: emailOrPhone }, { phone: emailOrPhone }] });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id, user.role);

    return res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/signup', isOwner, async (req, res) => {
  try {
    const { email, phone, name, profileImage, password } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ error: 'At least one of email or phone must be provided.' });
    }

   const existingUser = await User.findOne({ $or: [{ email: email }, { phone: phone }] });

   if (existingUser) {
     return res.status(409).json({ error: 'User already exists.' });
   }

    const hashedPassword = await bcrypt.hash(password, 10);

const newUser = new User({
  email,
  phone,
  name,
  profileImage,
  password: hashedPassword,
});

await newUser.save();

    return res.status(201).json({ message: 'User created successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/users', isOwner, async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 });

    return res.status(200).json({ users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.put('/modify/:userId', isOwner, async (req, res) => {
  try {
    const { name, profileImage } = req.body;

    const user = await User.findByIdAndUpdate(req.params.userId, { name, profileImage }, { new: true });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ message: 'User details modified successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.delete('/delete/:userId', isOwner, async (req, res) => {
  try {
    const deletedUser = await User.findOneAndDelete({ _id: req.params.userId });

    if (deletedUser) {
      return res.status(200).json({ message: 'User account deleted successfully' });
    } else {
      return res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
