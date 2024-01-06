require("dotenv").config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const { connectDB } = require("./db/connection");
const User = require('./models/user');

const app = express();
const PORT = 3000;

app.use(express.json());

const isAdmin = (req, res, next) => {
  const userId = req.params.userId; 
  const user = User.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }


  if (admins.includes(user.id)) {
    req.userRole = 'Admin';
    return next();
  } else {
    return res.status(403).json({ error: 'Permission denied. Admin access required.' });
  }
};


const isOwner = (req, res, next) => {
  const userId = req.params.userId;
  const user = User.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }


  if (req.userRole === 'Admin' || userId === req.user.id) {
    return next();
  } else {
    return res.status(403).json({ error: 'Permission denied. You can only modify your own details.' });
  }
};


const generateToken = (userId, role) => {
  const token = jwt.sign({ userId, role }, process.env.SECRET_KEY, { expiresIn: '1h' });
  return token;
};


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/profile-images');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });


app.post('/uploadProfileImage/:userId', isOwner, upload.single('profileImage'), async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.file) {
      // Update the user's profile image URL in the database
      user.profileImage = req.file.path;

      // Save the updated user to the database
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
// Route to create an Admin
app.post('/createAdmin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the user already exists
    if (User.some(user => user.email === email)) {
      return res.status(409).json({ error: 'User already exists.' });
    }

    // Encrypt the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new admin
    const newAdmin = {
      id: Math.random().toString(36).substr(2, 9), // Generate a random ID for the admin
      email,
      password: hashedPassword,
      role: 'Admin',
    };

    // Store the admin in your database or in-memory storage
    admins.push(newAdmin);

    return res.status(201).json({ message: 'Admin created successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.post('/login', async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    const user = findUser(emailOrPhone);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id, user.role);

    return res.status(200).json({ message: 'Login successful' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/signup', async (req, res) => {
  try {
    const { email, phone, name, profileImage, password } = req.body;

    // Ensure at least one of email or phone is provided
    if (!email && !phone) {
      return res.status(400).json({ error: 'At least one of email or phone must be provided.' });
    }

    // Check if the user already exists
    if (users.some(user => user.email === email || user.phone === phone)) {
      return res.status(409).json({ error: 'User already exists.' });
    }

    // Encrypt the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = {
      email,
      phone,
      name,
      profileImage,
      password: hashedPassword,
    };

    // Store the user in your database or in-memory storage
    User.push(newUser);

    return res.status(201).json({ message: 'User created successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/users', isAdmin ,async (req, res) => {
  try {
    // Fetch all users from the database
    const users = await User.find({}, { password: 0 }); // Exclude the password field

    return res.status(200).json(users);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.put('/modify/:userId',isAdmin, isOwner, async (req, res) => {
  try {
    const { name, profileImage } = req.body;
    const user = User.find(u => u.id === req.params.userId);
    user.name = name;
    user.profileImage = profileImage;

    return res.status(200).json({ message: 'User details modified successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

const findUser = (emailOrPhone) => {
  return User.find(user => user.email === emailOrPhone || user.phone === emailOrPhone);
};

app.delete('/delete/:userId', isAdmin, isOwner, (req, res) => {
  try {
    const userIndex = User.findIndex(u => u.id === req.params.userId);

    if (userIndex !== -1) {
      users.splice(userIndex, 1);
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
